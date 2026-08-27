const fechaISO = (value) => value ? new Date(value).toISOString().slice(0, 10) : null;

const sumarDiasLaborales = (inicio, horas, calendario, excepciones) => {
  if (!inicio) return null;
  const fecha = new Date(`${fechaISO(inicio)}T12:00:00Z`);
  const tipos = calendario
    ? [calendario.tipo_domingo, calendario.tipo_lunes, calendario.tipo_martes,
      calendario.tipo_miercoles, calendario.tipo_jueves, calendario.tipo_viernes,
      calendario.tipo_sabado].map(Number)
    : [0, 1, 1, 1, 1, 1, 0];
  const exMap = new Map((excepciones || []).map(e => [fechaISO(e.fecha), Number(e.hs_disponibles)]));
  let restante = Number(horas || calendario?.hs_jornada_estandar || 9);
  let guard = 3660;
  while (restante > 0 && guard-- > 0) {
    const excepcion = exMap.get(fechaISO(fecha));
    const tipo = tipos[fecha.getUTCDay()];
    const disponibles = excepcion ?? (tipo === 1
      ? Number(calendario?.hs_jornada_estandar || 9)
      : tipo === 2 ? Number(calendario?.hs_jornada_parcial || 0) : 0);
    if (disponibles > 0) restante -= disponibles;
    if (restante > 0) fecha.setUTCDate(fecha.getUTCDate() + 1);
  }
  return fechaISO(fecha);
};

const sumarDesfaseLaboral = (finPredecesora, horas, calendario, excepciones) => {
  if (!(Number(horas) > 0)) return fechaISO(finPredecesora);
  const siguiente = new Date(`${fechaISO(finPredecesora)}T12:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return sumarDiasLaborales(fechaISO(siguiente), horas, calendario, excepciones);
};

const construirProgramacion = (filas, calendario, excepciones) => {
  const mapa = new Map(filas.map(f => [Number(f.operacion_id), {
    ...f,
    operacion_id: Number(f.operacion_id),
    proyecto_id: Number(f.proyecto_id),
    dependencias: f.dependencias ? f.dependencias.split(',').map(Number) : []
  }]));
  const pendientes = new Set(mapa.keys());
  let guard = mapa.size + 1;

  while (pendientes.size && guard-- > 0) {
    let progreso = false;
    for (const id of [...pendientes]) {
      const op = mapa.get(id);
      const preds = op.dependencias.map(dep => mapa.get(dep)).filter(Boolean);
      if (preds.some(pred => pendientes.has(pred.operacion_id))) continue;
      const tieneFechaReal = Boolean(op.fecha_inicio_real || op.fecha_fin_real);
      const afectadaPorCadenaReal = preds.some(pred => pred.reprogramacion_activa);
      op.reprogramacion_activa = tieneFechaReal || Boolean(op.fecha_no_antes_del) || afectadaPorCadenaReal;
      if (!op.reprogramacion_activa) {
        op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_estimada);
        op.fecha_fin_reprog = fechaISO(op.fecha_fin_estimada);
      } else if (op.fecha_fin_real) {
        op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_real);
        op.fecha_fin_reprog = fechaISO(op.fecha_fin_real);
      } else if (op.fecha_inicio_real) {
        op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_real);
        op.fecha_fin_reprog = sumarDiasLaborales(op.fecha_inicio_real, op.duracion_hs, calendario, excepciones);
      } else {
        const finPred = preds
          .map(p => p.fecha_fin_reprog || fechaISO(p.fecha_fin_estimada))
          .filter(Boolean).sort().at(-1);
        const inicioPorDependencia = finPred
          ? sumarDesfaseLaboral(finPred, op.desfase_inicio_hs, calendario, excepciones)
          : null;
        const candidatosInicio = preds.length
          ? [inicioPorDependencia, fechaISO(op.fecha_no_antes_del)]
          : [fechaISO(op.fecha_no_antes_del), fechaISO(op.fecha_inicio_estimada)];
        op.fecha_inicio_reprog = candidatosInicio.filter(Boolean).sort().at(-1) || null;
        op.fecha_fin_reprog = sumarDiasLaborales(op.fecha_inicio_reprog, op.duracion_hs, calendario, excepciones);
      }
      op.fecha_inicio_estimada = fechaISO(op.fecha_inicio_estimada);
      op.fecha_fin_estimada = fechaISO(op.fecha_fin_estimada);
      op.fecha_inicio_real = fechaISO(op.fecha_inicio_real);
      op.fecha_fin_real = fechaISO(op.fecha_fin_real);
      op.fecha_no_antes_del = fechaISO(op.fecha_no_antes_del);
      pendientes.delete(id);
      progreso = true;
    }
    if (!progreso) break;
  }

  for (const id of pendientes) {
    const op = mapa.get(id);
    op.estado_codigo = 'BLOQUEADA';
    op.fecha_inicio_reprog = fechaISO(op.fecha_inicio_estimada);
    op.fecha_fin_reprog = fechaISO(op.fecha_fin_estimada);
  }
  return [...mapa.values()]
    .map(({ reprogramacion_activa, ...op }) => op)
    .sort((a, b) => a.secuencia - b.secuencia);
};

module.exports = { fechaISO, sumarDiasLaborales, sumarDesfaseLaboral, construirProgramacion };

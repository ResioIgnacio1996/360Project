const { sql } = require('../DB/dbConection');

const numero = valor => Number(valor || 0);
const redondear = valor => Number(numero(valor).toFixed(4));
const porcentaje = (valor, base) => base ? redondear(numero(valor) * 100 / numero(base)) : 0;
const fechaClave = valor => valor instanceof Date
  ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
  : String(valor || '').slice(0, 10);

function sumarEvento(mapa, fecha, importe) {
  const clave = fechaClave(fecha);
  if (!clave) return;
  mapa.set(clave, numero(mapa.get(clave)) + numero(importe));
}

async function obtener(pool, proyectoId) {
  const resultado = await pool.request().input('p', sql.BigInt, proyectoId).query(`
    SELECT p.proyecto_id,p.nombre,p.estado,
      COALESCE(NULLIF(c.razon_social,''),LTRIM(RTRIM(CONCAT(c.apellido,' ',c.nombre)))) cliente_nombre
    FROM Proyecto p LEFT JOIN Cliente c ON c.id_cliente=p.cliente_id
    WHERE p.proyecto_id=@p;

    SELECT o.operacion_id,o.precio_cliente,o.costo_responsable,
      o.cronograma_certificacion_fecha,o.numero_certificado_planificado,
      o.cronograma_certificacion_responsable_fecha,o.numero_certificado_responsable_planificado
    FROM Operacion o JOIN VersionPlan vp ON vp.version_id=o.version_id AND vp.es_activa=1
    WHERE o.proyecto_id=@p AND ISNULL(o.archivada,0)=0;

    SELECT fecha_certificacion,SUM(total) importe,COUNT(*) cantidad
    FROM CertificadoCliente
    WHERE proyecto_id=@p AND estado='EMITIDO'
    GROUP BY fecha_certificacion ORDER BY fecha_certificacion;

    SELECT fecha_certificacion,SUM(total) importe,COUNT(*) cantidad
    FROM CertificadoResponsable
    WHERE proyecto_id=@p AND estado='EMITIDO'
    GROUP BY fecha_certificacion ORDER BY fecha_certificacion;

    SELECT tipo,SUM(importe) importe
    FROM MovimientoFinancieroProyecto
    WHERE proyecto_id=@p AND estado='ACTIVO'
    GROUP BY tipo;
  `);

  if (!resultado.recordsets[0].length) {
    const error = new Error('Proyecto no encontrado');
    error.status = 404;
    throw error;
  }

  const operaciones = resultado.recordsets[1];
  const realCliente = resultado.recordsets[2];
  const realResponsable = resultado.recordsets[3];
  const movimientos = resultado.recordsets[4];
  const eventos = {
    planCliente: new Map(), realCliente: new Map(),
    planResponsable: new Map(), realResponsable: new Map()
  };

  for (const operacion of operaciones) {
    sumarEvento(eventos.planCliente, operacion.cronograma_certificacion_fecha, operacion.precio_cliente);
    sumarEvento(eventos.planResponsable, operacion.cronograma_certificacion_responsable_fecha, operacion.costo_responsable);
  }
  for (const certificado of realCliente) sumarEvento(eventos.realCliente, certificado.fecha_certificacion, certificado.importe);
  for (const certificado of realResponsable) sumarEvento(eventos.realResponsable, certificado.fecha_certificacion, certificado.importe);

  const fechas = [...new Set(Object.values(eventos).flatMap(mapa => [...mapa.keys()]))].sort();
  const acumulado = { planCliente: 0, realCliente: 0, planResponsable: 0, realResponsable: 0 };
  const curva = fechas.map(fecha => {
    acumulado.planCliente += numero(eventos.planCliente.get(fecha));
    acumulado.realCliente += numero(eventos.realCliente.get(fecha));
    acumulado.planResponsable += numero(eventos.planResponsable.get(fecha));
    acumulado.realResponsable += numero(eventos.realResponsable.get(fecha));
    const planClientePeriodo = numero(eventos.planCliente.get(fecha));
    const realClientePeriodo = numero(eventos.realCliente.get(fecha));
    const planResponsablePeriodo = numero(eventos.planResponsable.get(fecha));
    const realResponsablePeriodo = numero(eventos.realResponsable.get(fecha));
    const desvioCliente = acumulado.realCliente - acumulado.planCliente;
    const desvioResponsable = acumulado.realResponsable - acumulado.planResponsable;
    return {
      fecha,
      plan_cliente_periodo: redondear(planClientePeriodo), real_cliente_periodo: redondear(realClientePeriodo),
      plan_responsable_periodo: redondear(planResponsablePeriodo), real_responsable_periodo: redondear(realResponsablePeriodo),
      plan_cliente_acumulado: redondear(acumulado.planCliente), real_cliente_acumulado: redondear(acumulado.realCliente),
      plan_responsable_acumulado: redondear(acumulado.planResponsable), real_responsable_acumulado: redondear(acumulado.realResponsable),
      desvio_cliente: redondear(desvioCliente), desvio_cliente_pct: porcentaje(desvioCliente, acumulado.planCliente),
      desvio_responsable: redondear(desvioResponsable), desvio_responsable_pct: porcentaje(desvioResponsable, acumulado.planResponsable)
    };
  });

  const presupuestoCliente = operaciones.reduce((s, o) => s + numero(o.precio_cliente), 0);
  const costoResponsable = operaciones.reduce((s, o) => s + numero(o.costo_responsable), 0);
  const certificadoCliente = realCliente.reduce((s, c) => s + numero(c.importe), 0);
  const certificadoResponsable = realResponsable.reduce((s, c) => s + numero(c.importe), 0);
  const planificadoCliente = [...eventos.planCliente.values()].reduce((s, v) => s + numero(v), 0);
  const planificadoResponsable = [...eventos.planResponsable.values()].reduce((s, v) => s + numero(v), 0);
  const hoy = fechaClave(new Date());
  const planificadoClienteAHoy = [...eventos.planCliente].filter(([fecha]) => fecha <= hoy).reduce((s, [, v]) => s + numero(v), 0);
  const planificadoResponsableAHoy = [...eventos.planResponsable].filter(([fecha]) => fecha <= hoy).reduce((s, [, v]) => s + numero(v), 0);
  const certificadoClienteAHoy = [...eventos.realCliente].filter(([fecha]) => fecha <= hoy).reduce((s, [, v]) => s + numero(v), 0);
  const certificadoResponsableAHoy = [...eventos.realResponsable].filter(([fecha]) => fecha <= hoy).reduce((s, [, v]) => s + numero(v), 0);
  const ingresos = numero(movimientos.find(m => m.tipo === 'INGRESO')?.importe);
  const egresos = numero(movimientos.find(m => m.tipo === 'EGRESO')?.importe);
  const margenPlanificado = presupuestoCliente - costoResponsable;
  const margenCertificado = certificadoCliente - certificadoResponsable;

  return {
    proyecto: resultado.recordsets[0][0],
    resumen: {
      presupuesto_cliente: redondear(presupuestoCliente), costo_responsable: redondear(costoResponsable),
      margen_planificado: redondear(margenPlanificado), margen_planificado_pct: porcentaje(margenPlanificado, presupuestoCliente),
      planificado_cliente: redondear(planificadoCliente), planificado_responsable: redondear(planificadoResponsable),
      planificado_cliente_a_hoy: redondear(planificadoClienteAHoy), planificado_responsable_a_hoy: redondear(planificadoResponsableAHoy),
      sin_planificar_cliente: redondear(presupuestoCliente - planificadoCliente),
      sin_planificar_responsable: redondear(costoResponsable - planificadoResponsable),
      certificado_cliente: redondear(certificadoCliente), certificado_responsable: redondear(certificadoResponsable),
      margen_certificado: redondear(margenCertificado), margen_certificado_pct: porcentaje(margenCertificado, certificadoCliente),
      ingresos: redondear(ingresos), egresos: redondear(egresos), saldo_caja: redondear(ingresos - egresos),
      desvio_cliente: redondear(certificadoClienteAHoy - planificadoClienteAHoy),
      desvio_cliente_pct: porcentaje(certificadoClienteAHoy - planificadoClienteAHoy, planificadoClienteAHoy),
      desvio_responsable: redondear(certificadoResponsableAHoy - planificadoResponsableAHoy),
      desvio_responsable_pct: porcentaje(certificadoResponsableAHoy - planificadoResponsableAHoy, planificadoResponsableAHoy),
      fecha_corte_desvio: hoy
    },
    curva
  };
}

module.exports = { obtener };

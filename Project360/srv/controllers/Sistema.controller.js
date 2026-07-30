const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const fechaActual = (_req, res) => {
  const ahora = new Date();
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(ahora).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  res.json({
    fechaHora: `${fecha}T${partes.hour}:${partes.minute}:${partes.second}-03:00`,
    fecha,
    zonaHoraria: ZONA_HORARIA
  });
};

module.exports = { fechaActual };

const { randomUUID } = require('crypto');

const ID_HEADER = 'x-request-id';
const ID_VALIDO = /^[\x21-\x7e]{1,128}$/;
const longitudChunk = (chunk, encoding) => Buffer.isBuffer(chunk)
  ? chunk.length
  : Buffer.byteLength(chunk, typeof encoding === 'string' ? encoding : undefined);

const obtenerRequestId = req => {
  const recibido = req.get(ID_HEADER);
  return recibido && ID_VALIDO.test(recibido) ? recibido : randomUUID();
};

const observabilidadRequest = (req, res, next) => {
  const inicio = process.hrtime.bigint();
  const requestId = obtenerRequestId(req);
  let bytesEscritos = 0;
  const writeOriginal = res.write;
  const endOriginal = res.end;

  req.requestId = requestId;
  res.setHeader(ID_HEADER, requestId);

  res.write = function (chunk, encoding, callback) {
    if (chunk) bytesEscritos += longitudChunk(chunk, encoding);
    return writeOriginal.call(this, chunk, encoding, callback);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) bytesEscritos += longitudChunk(chunk, encoding);
    return endOriginal.call(this, chunk, encoding, callback);
  };

  res.once('finish', () => {
    const contentLength = Number(res.getHeader('content-length'));
    const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
    console.log(JSON.stringify({
      tipo: 'http_request',
      request_id: requestId,
      metodo: req.method,
      ruta: (req.originalUrl || req.url || '').split('?')[0],
      estado: res.statusCode,
      duracion_ms: Number(duracionMs.toFixed(2)),
      respuesta_bytes: Number.isFinite(contentLength) ? contentLength : bytesEscritos
    }));
  });

  next();
};

module.exports = { observabilidadRequest, obtenerRequestId };

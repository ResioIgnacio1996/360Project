const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { enteroEnv } = require('../DB/dbConection');
const {
  observabilidadRequest,
  obtenerRequestId
} = require('../middlewares/request-observability.middleware');

test('enteroEnv aplica límites y valor por defecto', () => {
  const nombre = 'TEST_PERFORMANCE_ENTERO';
  const anterior = process.env[nombre];
  try {
    process.env[nombre] = '12';
    assert.equal(enteroEnv(nombre, 5, 1, 20), 12);
    process.env[nombre] = '0';
    assert.equal(enteroEnv(nombre, 5, 1, 20), 5);
    process.env[nombre] = 'texto';
    assert.equal(enteroEnv(nombre, 5, 1, 20), 5);
  } finally {
    if (anterior === undefined) delete process.env[nombre];
    else process.env[nombre] = anterior;
  }
});

test('obtenerRequestId conserva un identificador válido y reemplaza uno inválido', () => {
  assert.equal(obtenerRequestId({ get: () => 'req-123' }), 'req-123');
  assert.match(obtenerRequestId({ get: () => 'valor\ninválido' }), /^[0-9a-f-]{36}$/);
});

test('observabilidadRequest registra estado, duración y tamaño sin query string', () => {
  const req = {
    method: 'GET',
    originalUrl: '/api/prueba?secreto=no-registrar',
    get: () => 'req-observabilidad'
  };
  const res = new EventEmitter();
  const headers = new Map();
  res.statusCode = 200;
  res.setHeader = (nombre, valor) => headers.set(nombre, valor);
  res.getHeader = nombre => headers.get(nombre);
  res.write = () => true;
  res.end = () => true;

  const mensajes = [];
  const logOriginal = console.log;
  console.log = mensaje => mensajes.push(JSON.parse(mensaje));
  try {
    let continuo = false;
    observabilidadRequest(req, res, () => { continuo = true; });
    res.end('respuesta');
    res.emit('finish');

    assert.equal(continuo, true);
    assert.equal(headers.get('x-request-id'), 'req-observabilidad');
    assert.equal(mensajes.length, 1);
    assert.equal(mensajes[0].ruta, '/api/prueba');
    assert.equal(mensajes[0].respuesta_bytes, Buffer.byteLength('respuesta'));
    assert.equal(mensajes[0].estado, 200);
    assert.equal(typeof mensajes[0].duracion_ms, 'number');
  } finally {
    console.log = logOriginal;
  }
});

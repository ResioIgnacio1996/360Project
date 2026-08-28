const test = require('node:test');
const assert = require('node:assert/strict');
const { paginacion } = require('../controllers/AvanceOperacion.controller');

test('Avances aplica límites paginados seguros y valores por defecto', () => {
  assert.deepEqual(paginacion({}, 5), { pagina: 1, limite: 5, offset: 0 });
  assert.deepEqual(paginacion({ pagina: '3', limite: '10' }, 5), { pagina: 3, limite: 10, offset: 20 });
  assert.deepEqual(paginacion({ pagina: '-2', limite: '500' }, 5), { pagina: 1, limite: 100, offset: 0 });
  assert.deepEqual(paginacion({ pagina: 'texto', limite: '0' }, 10), { pagina: 1, limite: 10, offset: 0 });
});

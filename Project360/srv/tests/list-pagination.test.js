'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parsePagedQuery, pagedResponse, parseOptionalDate, parseOptionalId } = require('../utils/list-pagination');

const sorts = { fecha: 'x.fecha', numero: 'x.numero' };

test('conserva el contrato legacy si no se solicita paginacion', () => {
    assert.deepEqual(parsePagedQuery({}, sorts, 'fecha'), { paged: false });
});

test('aplica defaults y resuelve solo columnas de whitelist', () => {
    assert.deepEqual(parsePagedQuery({ page: '2' }, sorts, 'fecha'), {
        paged: true, page: 2, pageSize: 10, offset: 20,
        sort: 'fecha', orderBy: 'x.fecha', direction: 'DESC'
    });
});

test('rechaza pagina, limite, sort y direccion invalidos', () => {
    for (const query of [
        { page: '-1' }, { page: '1.5' }, { pageSize: '101' },
        { page: '0', sort: 'fecha; DROP TABLE x' },
        { page: '0', direction: 'sideways' }
    ]) assert.throws(() => parsePagedQuery(query, sorts, 'fecha'), error => error.statusCode === 400);
});

test('genera envelope y elimina la columna tecnica de total', () => {
    assert.deepEqual(pagedResponse([{ id: 1, __total: 11 }], 1, 10), {
        data: [{ id: 1 }],
        page: { index: 1, size: 10, total: 11, totalPages: 2 }
    });
    assert.deepEqual(pagedResponse([], 0, 10).page.totalPages, 0);
    assert.deepEqual(pagedResponse([], 3, 10, 21).page, {
        index: 3, size: 10, total: 21, totalPages: 3
    });
});

test('valida fechas calendario e identificadores opcionales', () => {
    assert.equal(parseOptionalDate('2024-02-29', 'fechaDesde'), '2024-02-29');
    assert.equal(parseOptionalId('8', 'proyectoId'), 8);
    assert.throws(() => parseOptionalDate('2024-02-30', 'fechaDesde'), error => error.statusCode === 400);
    assert.throws(() => parseOptionalId('0', 'proyectoId'), error => error.statusCode === 400);
});

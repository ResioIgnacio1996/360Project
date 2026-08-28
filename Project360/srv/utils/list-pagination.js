'use strict';

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

const parsePositiveInteger = (value, field, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (!/^\d+$/.test(String(value))) {
        const error = new Error(`${field} debe ser un entero positivo`);
        error.statusCode = 400;
        throw error;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
        const error = new Error(`${field} excede el rango permitido`);
        error.statusCode = 400;
        throw error;
    }
    return parsed;
};

const parseOptionalId = (value, field) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = parsePositiveInteger(value, field);
    if (parsed < 1) {
        const error = new Error(`${field} debe ser mayor a cero`);
        error.statusCode = 400;
        throw error;
    }
    return parsed;
};

const parseOptionalDate = (value, field) => {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    const date = match && new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (!match || date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) {
        const error = new Error(`${field} debe ser una fecha valida YYYY-MM-DD`);
        error.statusCode = 400;
        throw error;
    }
    return text;
};

const parsePagedQuery = (query, sortColumns, defaultSort, forcedFilters = {}) => {
    const paged = hasOwn(query, 'page') || hasOwn(query, 'pageSize');
    if (!paged) return { paged: false, ...forcedFilters };

    const page = parsePositiveInteger(query.page, 'page', 0);
    const pageSize = parsePositiveInteger(query.pageSize, 'pageSize', 10);
    if (pageSize < 1 || pageSize > 100) {
        const error = new Error('pageSize debe estar entre 1 y 100');
        error.statusCode = 400;
        throw error;
    }
    if (page * pageSize > 2147483647) {
        const error = new Error('La pagina solicitada excede el rango permitido');
        error.statusCode = 400;
        throw error;
    }

    const sort = String(query.sort || defaultSort);
    if (!hasOwn(sortColumns, sort)) {
        const error = new Error('Criterio de ordenamiento invalido');
        error.statusCode = 400;
        throw error;
    }

    const direction = String(query.direction || 'desc').toLowerCase();
    if (!['asc', 'desc'].includes(direction)) {
        const error = new Error('Direccion de ordenamiento invalida');
        error.statusCode = 400;
        throw error;
    }

    return {
        paged: true,
        page,
        pageSize,
        offset: page * pageSize,
        sort,
        orderBy: sortColumns[sort],
        direction: direction.toUpperCase(),
        ...forcedFilters
    };
};

const pagedResponse = (recordset, page, pageSize, exactTotal) => {
    const total = Number(exactTotal ?? recordset[0]?.__total ?? 0);
    const data = recordset.map(({ __total, ...row }) => row);
    return {
        data,
        page: {
            index: page,
            size: pageSize,
            total,
            totalPages: total ? Math.ceil(total / pageSize) : 0
        }
    };
};

module.exports = { parsePagedQuery, pagedResponse, parseOptionalDate, parseOptionalId };

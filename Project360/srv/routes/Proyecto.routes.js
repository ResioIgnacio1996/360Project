
const express = require('express');
const router = express.Router();


const { verificarToken } = require('../middlewares/auth.middleware');

const {
    getProyectos,
    getProyectoById,
    createProyecto,
    updateProyecto,
    deleteProyecto
} = require('../controllers/Proyecto.controller');


// GET TODOS
router.get(
    '/',
    verificarToken,
    getProyectos
);


// GET POR ID
router.get(
    '/:id',
    verificarToken,
    getProyectoById
);


// CREATE
router.post(
    '/',
    verificarToken,
    createProyecto
);


// UPDATE
router.put(
    '/:id',
    verificarToken,
    updateProyecto
);


// DELETE
router.delete(
    '/:id',
    verificarToken,
    deleteProyecto
);

module.exports = router;
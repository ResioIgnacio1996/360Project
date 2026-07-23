// routes/Materiales.routes.js

const express = require('express');
const multer = require('multer');
const { conectarDB } = require('../DB/dbConection');
const { verificarToken } = require('../middlewares/auth.middleware');

const {
    extraerOrdenCompraDocumento
} = require('../controllers/materiales/procesoDocuemntos.controller');

const router = express.Router();

const getMateriales = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                m.id_material,
                m.nombre,
                m.descripcion,
                u.uom_id,
                u.nombre AS UoM
            FROM Materiales m
            INNER JOIN UOM u
                ON u.uom_id = m.uom_id
            ORDER BY m.nombre
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener materiales:', error);
        res.status(500).json({
            message: 'Error al obtener materiales',
            error: error.message
        });
    }
};

const getUom = async (req, res) => {
    try {
        const pool = await conectarDB();

        const result = await pool.request().query(`
            SELECT
                uom_id,
                nombre
            FROM UOM
            ORDER BY nombre
        `);

        res.json(result.recordset);
    } catch (error) {
        console.error('Error al obtener UOM:', error);
        res.status(500).json({
            message: 'Error al obtener UOM',
            error: error.message
        });
    }
};


// ======================================================
// CONFIGURACIÓN MULTER
// ======================================================
//
// Este middleware permite recibir:
//
// ✔ PDF
// ✔ JPG
// ✔ JPEG
// ✔ PNG
// ✔ WEBP
//
// Los archivos se almacenan temporalmente en memoria
// para enviarlos directamente a OpenAI.
//
// No se guardan físicamente en el servidor.
//

const upload = multer({

    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const tiposPermitidos = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        if (!tiposPermitidos.includes(file.mimetype)) {

            return cb(
                new Error(
                    'Solo se permiten PDF, JPG, JPEG, PNG y WEBP'
                ),
                false
            );
        }

        cb(null, true);
    }
});


// ======================================================
// DOCUMENTOS DE MATERIALES
// ======================================================
//
// POST /api/materiales/documento
//
// Recibe:
//
// - Orden de compra PDF
// - Orden de compra escaneada
// - Foto de orden de compra
// - Remitos
// - Presupuestos
//
// Campo esperado:
//
// ordenCompra
//
// Angular:
//
// const formData = new FormData();
//
// formData.append(
//     'ordenCompra',
//     archivo
// );
//
// Flujo:
//
// Angular
//      ↓
// Drag & Drop
//      ↓
// Multer
//      ↓
// OpenAI
//      ↓
// Extracción de datos
//      ↓
// JSON estructurado
//

router.post(
    '/documento',
    verificarToken,
    upload.single('ordenCompra'),
    extraerOrdenCompraDocumento
);

router.get('/uom', verificarToken, getUom);
router.get('/', verificarToken, getMateriales);


// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = router;

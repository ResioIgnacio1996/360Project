// routes/Materiales.routes.js

const express = require('express');
const multer = require('multer');

const {
    extraerOrdenCompraDocumento
} = require('../controllers/materiales/procesoDocuemntos.controller');

const router = express.Router();


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
    upload.single('ordenCompra'),
    extraerOrdenCompraDocumento
);


// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = router;
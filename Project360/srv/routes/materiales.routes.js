// routes/Materiales.routes.js

const express = require('express');
const multer = require('multer');
const { conectarDB, sql } = require('../DB/dbConection');
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
            LEFT JOIN UOM u
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

const actualizarMaterial = async (req, res) => {
    const id = Number(req.params.id);
    const nombre = String(req.body?.nombre || '').trim().replace(/\s+/g, ' ');
    const uomId = Number(req.body?.uom_id);
    if (!Number.isInteger(id) || id <= 0 || !nombre || !Number.isInteger(uomId) || uomId <= 0) {
        return res.status(400).json({ message: 'Material, descripciÃ³n y unidad de medida son obligatorios' });
    }

    let transaction;
    try {
        const pool = await conectarDB();
        transaction = new sql.Transaction(pool);
        await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

        const uom = await new sql.Request(transaction)
            .input('uom_id', sql.BigInt, uomId)
            .query('SELECT uom_id,nombre FROM UoM WHERE uom_id=@uom_id');
        if (!uom.recordset.length) throw Object.assign(new Error('La unidad de medida no existe'), { statusCode: 400 });

        const material = await new sql.Request(transaction)
            .input('id', sql.BigInt, id)
            .query('SELECT id_material FROM Materiales WITH (UPDLOCK,HOLDLOCK) WHERE id_material=@id');
        if (!material.recordset.length) throw Object.assign(new Error('Material no encontrado'), { statusCode: 404 });

        const duplicado = await new sql.Request(transaction)
            .input('id', sql.BigInt, id)
            .input('nombre', sql.NVarChar(200), nombre)
            .query(`SELECT id_material,nombre FROM Materiales
                    WHERE id_material<>@id AND nombre_normalizado=dbo.fn_NormalizarClave(@nombre)`);
        if (duplicado.recordset.length) {
            throw Object.assign(new Error(`Ya existe el material ${duplicado.recordset[0].nombre}`), { statusCode: 409 });
        }

        await new sql.Request(transaction)
            .input('id', sql.BigInt, id)
            .input('nombre', sql.NVarChar(200), nombre)
            .input('uom_id', sql.BigInt, uomId)
            .query(`UPDATE Materiales SET nombre=@nombre,descripcion=@nombre,uom_id=@uom_id WHERE id_material=@id;
                    UPDATE b SET b.descripcion_libre=@nombre,b.uom_id=@uom_id,b.fecha_actualizacion=SYSDATETIME()
                    FROM BomOperacion b WHERE b.material_id=@id;
                    UPDATE c SET c.nombre=@nombre,c.unidad_medida=(SELECT nombre FROM UoM WHERE uom_id=@uom_id)
                    FROM Container c JOIN StockGeneral sg ON sg.stock_general_id=c.stock_general_id
                    WHERE sg.id_material=@id;`);

        await transaction.commit();
        res.json({ id_material: id, nombre, uom_id: uomId, UoM: uom.recordset[0].nombre });
    } catch (error) {
        if (transaction) try { await transaction.rollback(); } catch {}
        res.status(error.statusCode || 500).json({ message: error.message || 'Error al actualizar material' });
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
router.put('/:id', verificarToken, actualizarMaterial);


// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = router;

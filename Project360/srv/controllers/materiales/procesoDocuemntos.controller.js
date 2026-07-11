const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const tiposPermitidos = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
];

const promptExtraccion = `
Sos un asistente experto en lectura de ordenes de compra, remitos y presupuestos del rubro construccion.

Extrae los datos importantes del documento adjunto.

Devolve SOLO JSON valido, sin markdown ni explicacion.

Formato:

{
  "tipo_documento": null,
  "proveedor": {
    "razon_social": null,
    "cuit": null,
    "telefono": null,
    "email": null,
    "direccion": null
  },
  "orden_compra": {
    "numero": null,
    "fecha_emision": null,
    "fecha_entrega": null,
    "condicion_pago": null,
    "moneda": null,
    "subtotal": null,
    "iva": null,
    "total": null,
    "observaciones": null
  },
  "obra_o_proyecto": {
    "nombre": null,
    "ubicacion": null,
    "solicitante": null
  },
  "materiales": [
    {
      "codigo": null,
      "descripcion": null,
      "rubro": null,
      "unidad_medida": null,
      "cantidad": null,
      "precio_unitario": null,
      "subtotal": null
    }
  ],
  "datos_detectados": {
    "confianza_general": "alta | media | baja",
    "campos_faltantes": [],
    "advertencias": []
  }
}

Reglas:
- No inventes datos.
- Si un dato no esta, usar null.
- Normaliza fechas como YYYY-MM-DD cuando sea posible.
- Cantidades y precios deben ser numeros.
- Si hay varios materiales, listarlos todos.
- Si el documento no parece orden de compra, remito o presupuesto, indicalo en advertencias.
`;

const crearError = (message, statusCode = 500, raw = undefined) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.raw = raw;
    return error;
};

const validarArchivo = (file) => {
    if (!file) {
        throw crearError('Debe adjuntar un archivo', 400);
    }

    if (!tiposPermitidos.includes(file.mimetype)) {
        throw crearError('Formato no permitido. Solo PDF, JPG, JPEG, PNG o WEBP', 400);
    }
};

const procesarDocumentoMateriales = async (req) => {
    validarArchivo(req.file);

    const content = [
        {
            type: 'input_text',
            text: promptExtraccion
        }
    ];

    if (req.file.mimetype === 'application/pdf') {
        const archivoOpenAI = await client.files.create({
            file: await toFile(
                req.file.buffer,
                req.file.originalname,
                { type: req.file.mimetype }
            ),
            purpose: 'assistants'
        });

        content.push({
            type: 'input_file',
            file_id: archivoOpenAI.id
        });
    } else {
        const base64 = req.file.buffer.toString('base64');

        content.push({
            type: 'input_image',
            image_url: `data:${req.file.mimetype};base64,${base64}`
        });
    }

    const response = await client.responses.create({
        model: 'gpt-5.5',
        input: [
            {
                role: 'user',
                content
            }
        ]
    });

    try {
        return JSON.parse(response.output_text);
    } catch (error) {
        throw crearError(
            'OpenAI respondio, pero no se pudo convertir la respuesta a JSON',
            500,
            response.output_text
        );
    }
};

const normalizarRegistroCompraDocumento = (data, archivo) => ({
    archivo: {
        nombreOriginal: archivo.originalname,
        tipo: archivo.mimetype,
        tamanio: archivo.size
    },
    registroCompra: {
        numero: data?.orden_compra?.numero ?? '',
        fecha: data?.orden_compra?.fecha_emision ?? '',
        fechaEntrega: data?.orden_compra?.fecha_entrega ?? null,
        observaciones: data?.orden_compra?.observaciones ?? null,
        proyecto: null
    },
    proveedor: {
        idProveedor: null,
        razonSocial: data?.proveedor?.razon_social ?? '',
        cuit: data?.proveedor?.cuit ?? null,
        existe: false
    },
    detalle: Array.isArray(data?.materiales)
        ? data.materiales.map((item) => ({
            idMaterial: null,
            nombreMaterial: item.descripcion ?? '',
            descripcionOriginal: item.descripcion ?? '',
            cantidad: Number(item.cantidad) || 0,
            unidad: item.unidad_medida ?? '',
            existe: false
        }))
        : [],
    advertencias: data?.datos_detectados?.advertencias ?? []
});

const normalizarRemitoDocumento = (data, archivo) => ({
    archivo: {
        nombreOriginal: archivo.originalname,
        tipo: archivo.mimetype,
        tamanio: archivo.size
    },
    remito: {
        numero: data?.remito?.numero ?? data?.orden_compra?.numero ?? '',
        fecha: data?.remito?.fecha ?? data?.orden_compra?.fecha_emision ?? '',
        observaciones: data?.orden_compra?.observaciones ?? null
    },
    proveedor: {
        razonSocial: data?.proveedor?.razon_social ?? '',
        cuit: data?.proveedor?.cuit ?? null
    },
    detalle: Array.isArray(data?.materiales)
        ? data.materiales.map((item) => ({
            nombreMaterial: item.descripcion ?? '',
            descripcionOriginal: item.descripcion ?? '',
            cantidad: Number(item.cantidad) || 0,
            unidad: item.unidad_medida ?? ''
        }))
        : [],
    advertencias: data?.datos_detectados?.advertencias ?? []
});

const extraerOrdenCompraDocumento = async (req, res) => {
    try {
        const data = await procesarDocumentoMateriales(req);

        return res.json({
            message: 'Documento procesado correctamente',
            archivo: {
                nombre: req.file.originalname,
                tipo: req.file.mimetype,
                tamanio: req.file.size
            },
            data
        });
    } catch (error) {
        console.error('Error al procesar documento de materiales:', error);

        return res.status(error.statusCode || 500).json({
            message: 'Error al procesar documento de materiales',
            error: error.message,
            raw: error.raw
        });
    }
};

const extraerRegistroCompraDocumento = async (req, res) => {
    try {
        const data = await procesarDocumentoMateriales(req);

        return res.json({
            success: true,
            message: 'Documento procesado correctamente',
            data: normalizarRegistroCompraDocumento(data, req.file)
        });
    } catch (error) {
        console.error('Error al procesar documento de registro de compra:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: 'Error al procesar documento de registro de compra',
            error: error.message,
            raw: error.raw
        });
    }
};

const extraerRemitoDocumento = async (req, res) => {
    try {
        const data = await procesarDocumentoMateriales(req);

        return res.json({
            success: true,
            message: 'Documento procesado correctamente',
            data: normalizarRemitoDocumento(data, req.file)
        });
    } catch (error) {
        console.error('Error al procesar documento de remito:', error);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: 'Error al procesar documento de remito',
            error: error.message,
            raw: error.raw
        });
    }
};

module.exports = {
    extraerOrdenCompraDocumento,
    extraerRegistroCompraDocumento,
    extraerRemitoDocumento
};

// controllers/materiales/Materiales.controller.js

const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const extraerOrdenCompraDocumento = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                message: 'Debe adjuntar un archivo'
            });
        }

        const tiposPermitidos = [
            'application/pdf',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp'
        ];

        if (!tiposPermitidos.includes(req.file.mimetype)) {
            return res.status(400).json({
                message: 'Formato no permitido. Solo PDF, JPG, JPEG, PNG o WEBP'
            });
        }

        const prompt = `
Sos un asistente experto en lectura de órdenes de compra, remitos y presupuestos del rubro construcción.

Extraé los datos importantes del documento adjunto.

Devolvé SOLO JSON válido, sin markdown ni explicación.

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
- Si un dato no está, usar null.
- Normalizá fechas como YYYY-MM-DD cuando sea posible.
- Cantidades y precios deben ser números.
- Si hay varios materiales, listarlos todos.
- Si el documento no parece orden de compra, remito o presupuesto, indicarlo en advertencias.
`;

        let content = [
            {
                type: 'input_text',
                text: prompt
            }
        ];

        if (req.file.mimetype === 'application/pdf') {
            const archivoOpenAI = await client.files.create({
                file: await toFile(
                    req.file.buffer,
                    req.file.originalname,
                    {
                        type: req.file.mimetype
                    }
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

        let data;

        try {
            data = JSON.parse(response.output_text);
        } catch (error) {
            return res.status(500).json({
                message: 'OpenAI respondió, pero no se pudo convertir la respuesta a JSON',
                raw: response.output_text
            });
        }

        return res.json({
            message: 'Documento procesado correctamente',
            archivo: {
                nombre: req.file.originalname,
                tipo: req.file.mimetype,
                tamaño: req.file.size
            },
            data
        });

    } catch (error) {
        console.error('Error al procesar documento de materiales:', error);

        return res.status(500).json({
            message: 'Error al procesar documento de materiales',
            error: error.message
        });
    }
};

module.exports = {
    extraerOrdenCompraDocumento
};
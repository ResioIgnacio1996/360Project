# Entrega de cambios - Costos y Certificaciones

Fecha de ejecución: 24/08/2026  
Estado técnico: implementado, migrado y validado

## 1. Alcance resuelto

Se implementaron los siete cambios solicitados y las definiciones posteriores aprobadas:

1. Carga masiva de costos mediante CSV junto al botón **Actualizar**.
2. Cambio de nombre a **Costos Operaciones**.
3. Cambio de columna a **Avance Operación**.
4. Cambio de pestaña a **Certificación a Cliente**.
5. Corte por fecha según las fechas vigentes de Programación.
6. Nueva metodología de corte por operación.
7. Conservación simultánea de edición manual e importación CSV.

La certificación continúa siendo exclusivamente al cliente y utiliza `Operacion.precio_cliente`. El costo responsable se carga y audita, pero no genera todavía certificados a contratistas.

## 2. Importación CSV

### Formato

```csv
secuencia,precio_cliente,costo_responsable
100,15000,6000
200,25000.50,12000
```

También se admite `;` como delimitador y coma decimal.

### Flujo implementado

1. El usuario elige el archivo.
2. El backend valida proyecto activo, plan activo y todas las filas.
3. La vista previa muestra operación, etapa, valores anteriores, nuevos y errores.
4. La confirmación solo queda habilitada si no existe ningún error.
5. La importación actualiza todas las filas dentro de una transacción serializable.
6. Cada campo realmente modificado genera auditoría con motivo `Importación CSV`.

### Reglas validadas

- Cabeceras exactas y en el orden acordado.
- Archivo no vacío y límite de 5 MB.
- Secuencia entera positiva.
- Operación existente en proyecto y plan activo.
- Operación no archivada.
- Secuencia no repetida.
- Precio y costo no negativos, con hasta cuatro decimales.
- Si una fila falla, no se aplica ninguna modificación.
- Una fila sin cambios es válida y no genera auditoría artificial.

### API

- `POST /api/economia-operaciones/proyectos/:proyectoId/importacion/preview`
- `POST /api/economia-operaciones/proyectos/:proyectoId/importacion`

Ambos reciben:

```json
{
  "contenido_csv": "secuencia,precio_cliente,costo_responsable\n100,15000,6000"
}
```

## 3. Certificación por fecha

El conjunto de operaciones ya no se determina por `AvanceOperacion.fecha_registro`.

Se extrajo la lógica de cálculo de Programación a un servicio común y se reutiliza desde ambos módulos. La fecha efectiva aplicada es la fecha de inicio reprogramada calculada; si no hay reprogramación activa, el mismo algoritmo devuelve la fecha estimada.

Regla de inclusión:

```text
fecha_inicio_vigente <= fecha_certificacion
```

Por lo tanto:

- Se excluyen las operaciones cuyo inicio está después del corte.
- Se incluye una operación que comenzó antes y atraviesa el corte.
- El avance cero no excluye una operación que corresponde por Programación.
- El avance físico de referencia continúa siendo el último registrado hasta la fecha documental.

## 4. Certificación por operación

Se incorporó `POR_OPERACION`.

Regla:

```text
operacion.secuencia <= operacion_corte.secuencia
```

La operación elegida debe pertenecer al proyecto, a la versión activa y no estar archivada. La fecha documental sigue siendo obligatoria y se conserva el cálculo por delta contra certificados anteriores.

## 5. Delta y visualización

Todas las operaciones que corresponden al corte aparecen en el preview:

- `delta > 0`: etiqueta **A CERTIFICAR** y resaltado positivo.
- `delta = 0`: etiqueta **SIN DELTA** y visual atenuada.

Se mantiene:

```text
delta = porcentaje_actual - porcentaje_anterior
importe = precio_cliente_vigente × delta / 100
```

No se permite emitir un certificado si todas sus líneas tienen delta cero.

## 6. Base de datos

La migración idempotente fue actualizada y aplicada correctamente.

Cambio agregado a `CertificadoCliente`:

```sql
operacion_corte_id BIGINT NULL
```

Restricciones agregadas/actualizadas:

- `metodo_corte IN ('POR_FECHA','POR_OPERACION')`.
- `POR_FECHA` exige `operacion_corte_id IS NULL`.
- `POR_OPERACION` exige `operacion_corte_id IS NOT NULL`.
- Clave foránea desde `operacion_corte_id` a `Operacion.operacion_id`.

El script de verificación confirmó columna, tablas, permisos, índices, trigger y restricciones.

## 7. API de certificación

Endpoint nuevo:

- `POST /api/certificados-cliente/proyectos/:proyectoId/preview`

Ejemplo por fecha:

```json
{
  "metodo_corte": "POR_FECHA",
  "fecha_certificacion": "2026-08-24",
  "operacion_corte_id": null
}
```

Ejemplo por operación:

```json
{
  "metodo_corte": "POR_OPERACION",
  "fecha_certificacion": "2026-08-24",
  "operacion_corte_id": 194
}
```

Se conservó temporalmente el endpoint anterior `/preview-fecha` como alias compatible para no romper clientes existentes.

El listado y el detalle ahora informan metodología y operación de corte.

## 8. Archivos principales modificados o agregados

### Backend

- `srv/services/ProgramacionFechas.service.js`
- `srv/services/CertificacionCliente.service.js`
- `srv/services/ImportacionCostos.service.js`
- `srv/controllers/Programacion.controller.js`
- `srv/controllers/CertificadoCliente.controller.js`
- `srv/controllers/EconomiaOperacion.controller.js`
- `srv/routes/CertificadoCliente.routes.js`
- `srv/routes/EconomiaOperacion.routes.js`
- `srv/DB/migrations/20260821_costos_certificaciones_fase1.sql`

### Frontend

- `360Front/src/app/features/costos/costos-certificaciones.ts`
- `360Front/src/app/features/costos/costos-certificaciones.html`
- `360Front/src/app/features/costos/costos-certificaciones.css`
- `360Front/src/app/features/costos/costos-certificaciones.spec.ts`
- `360Front/src/app/core/services/costos/costos.service.ts`

### Pruebas y documentación

- `srv/tests/reglas-costos.test.js`
- `srv/scripts/validar-cambios-costos-20260824.js`
- `srv/scripts/validar-api-costos-20260824.js`
- `srv/scripts/verificar-costos-fase1.js`
- `output/MANUAL_USUARIO_COSTOS_CERTIFICACIONES_FASE1.md`
- `output/DEFINICIONES_APROBADAS_CAMBIOS_COSTOS_CERTIFICACIONES.md`
- `output/ENTREGA_CAMBIOS_COSTOS_CERTIFICACIONES_20260824.md`

## 9. Validaciones ejecutadas

### Pruebas unitarias

Resultado: **25/25 aprobadas**.

Incluyen:

- Primera certificación y certificados posteriores.
- Cálculo del delta.
- Precio cero.
- Ajustes manuales y motivos.
- Retrocesos y límites de porcentaje.
- Preview obsoleto.
- Proyecto inactivo y proyecto sin cliente.
- Corte por fecha.
- Corte por operación.
- CSV con coma o punto y coma.
- Cabeceras inválidas y secuencias repetidas.

### Compilación frontend

Resultado: **correcta, sin errores de TypeScript ni plantilla**.

Persisten tres advertencias de presupuesto de tamaño globales del proyecto: bundle inicial, CSS de Avance de Operaciones y CSS de Programación. No fueron producidas por errores funcionales de este cambio.

### Pruebas de componente frontend

Resultado: **3/3 aprobadas**.

- Render de **Costos Operaciones**, **Certificación a Cliente**, **Avance Operación** y **Cargar CSV**.
- Envío correcto de metodología, fecha documental y operación para `POR_OPERACION`.
- Diferenciación de filas y etiquetas **SIN DELTA / A CERTIFICAR**.

### Integración con base real

Resultado: **correcto** sobre el proyecto de prueba `TEST1` (`proyecto_id=7`).

- Corte por fecha: 3 operaciones incluidas para 24/08/2026.
- Corte por operación hasta secuencia 2000: 23 operaciones incluidas.
- CSV válido sin cambios: aceptado sin auditoría artificial.
- CSV con una fila inválida: transacción revertida completa.
- Preview alterado: rechazado como desactualizado.
- Certificados persistidos por las pruebas: 0.
- Cambios económicos ficticios persistidos: 0.

### Prueba HTTP de endpoints y permisos

Resultado: **correcto**.

- Solicitud sin token: rechazada con HTTP 401.
- Token temporal de prueba para administrador activo: aceptado sin modificar su contraseña.
- Consulta de permisos: devolvió las cinco acciones esperadas.
- Costos Operaciones: HTTP 200.
- Preview por fecha: HTTP 200.
- Preview por operación: HTTP 200.
- Preview de CSV: HTTP 200.
- Historial de certificados: HTTP 200.

## 10. Desvíos respecto de lo acordado

No hubo desvíos de reglas de negocio.

Se tomaron dos decisiones técnicas compatibles con lo aprobado:

1. Se mantuvo `/preview-fecha` como alias de compatibilidad, aunque el frontend nuevo utiliza el endpoint genérico `/preview`.
2. Los nombres internos existentes `EconomiaOperacion` se conservaron en archivos, servicios y endpoints. El cambio de nombre solicitado se aplicó a la interfaz y documentación, tal como se había definido.

## 11. Pendiente de validación visual autenticada

El navegador local confirmó que la aplicación responde en `http://localhost:4200/` y muestra el login. No existe una contraseña de testing documentada ni una sesión autenticada disponible, por lo que no se ingresaron credenciales ni se alteraron contraseñas para forzar el acceso.

La funcionalidad quedó validada mediante compilación, pruebas unitarias y pruebas contra la base real. Para completar una última inspección visual autenticada, debe iniciarse sesión en el navegador local con un usuario que posea los permisos de Costos y Certificaciones.

## 12. Certificados emitidos durante este trabajo

No se emitió ningún certificado. Las pruebas de emisión se realizaron forzando un preview obsoleto y verificando el rollback, sin dejar registros persistidos.

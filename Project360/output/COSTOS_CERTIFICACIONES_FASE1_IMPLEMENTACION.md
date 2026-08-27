# Costos y Certificaciones - Fase 1

## Contratos consumidos sin modificación

- `Proyecto`: se valida `activo = 1`, `eliminado = 0`, `estado = ACTIVO` y cliente asociado.
- `Programacion`: se leen únicamente operaciones de la versión activa con `archivada = 0`, junto con etapa, secuencia y responsable.
- `AvanceOperacion`: `fecha_registro` es la fecha efectiva. Si hay varios eventos el mismo día, prevalece `fecha_creacion DESC, avance_id DESC`. Sin evento aplicable, el avance es 0%.
- `Usuario`, `Rol`, `Accion`, `Entidad` y `Accion_Rol`: se reutilizan para auditoría y autorización.
- Certificar no escribe en Proyecto, Programación, Avances, Compras, BOM, Stock ni Materiales.

## Modelo agregado

- `Operacion`: `precio_cliente`, `costo_responsable`, usuario/fecha de actualización y `economia_row_version`.
- `HistorialEconomiaOperacion`: una fila por campo económico modificado, con anterior, nuevo, motivo, usuario y fecha.
- `CertificadoCliente`: cabecera emitida por proyecto y fecha.
- `CertificadoClienteDetalle`: fotografía inmutable de avance, porcentajes, delta, precio e importe por operación.
- Trigger: bloquea cambios posteriores de `responsable_id` si la operación integra un certificado emitido.

## API

Todas las rutas requieren JWT y el permiso indicado.

| Método | Ruta | Permiso | Uso |
|---|---|---|---|
| GET | `/api/economia-operaciones/proyectos/:proyectoId/operaciones` | `COSTOS_VER` | Economía del plan activo |
| PATCH | `/api/economia-operaciones/operaciones/:operacionId` | `ECONOMIA_OPERACION_EDITAR` | Actualiza precio/costo y audita |
| GET | `/api/economia-operaciones/operaciones/:operacionId/historial` | `COSTOS_VER` | Historial económico |
| POST | `/api/certificados-cliente/proyectos/:proyectoId/preview-fecha` | `CERTIFICADO_CLIENTE_PREVIEW` | Preview temporal |
| POST | `/api/certificados-cliente/proyectos/:proyectoId` | `CERTIFICADO_CLIENTE_EMITIR` | Emisión transaccional |
| GET | `/api/certificados-cliente/proyectos/:proyectoId` | `CERTIFICADO_CLIENTE_VER` | Listado histórico |
| GET | `/api/certificados-cliente/proyectos/:proyectoId/:certificadoId` | `CERTIFICADO_CLIENTE_VER` | Detalle histórico |

### Edición económica

```json
{"precio_cliente": 12000, "costo_responsable": 6500, "motivo": "Actualización acordada"}
```

### Preview

```json
{"fecha_certificacion": "2026-08-21"}
```

Cada línea devuelve un objeto `base` opaco para detectar cambios de precio, avance o certificado anterior.

### Emisión

```json
{
  "fecha_certificacion": "2026-08-21",
  "observaciones": "Certificación mensual",
  "lineas": [{
    "operacion_id": 1,
    "porcentaje_actual": 50,
    "motivo_modificacion": "Porcentaje acordado en reunión",
    "base": {"economia_version":"0x...","avance_id":10,"avance_fisico_referencia":55,"detalle_anterior_id":null,"porcentaje_anterior":0}
  }]
}
```

El servidor ignora importes, precio, delta, total y porcentaje anterior enviados por el cliente. Bajo aislamiento `SERIALIZABLE`, vuelve a leer y bloquear la base, compara el preview y guarda cabecera/detalles en una sola transacción.

## Pruebas manuales

1. Configurar los cinco permisos del módulo para el rol que corresponda (la migración los asigna automáticamente a roles llamados Admin o Administrador).
2. Abrir un proyecto activo y entrar en **Costos y Certificaciones**.
3. Editar precio/costo y comprobar motivo e historial.
4. Registrar avances con fechas diferentes desde el módulo existente.
5. Generar un preview entre ambas fechas y comprobar el avance reconstruido.
6. Modificar un porcentaje: el motivo pasa a ser obligatorio.
7. Emitir y abrir el detalle histórico.
8. Cambiar el precio, emitir un delta posterior y comprobar que el certificado anterior no cambia.
9. Intentar una fecha anterior, un porcentaje menor al anterior y un certificado de delta totalmente cero.
10. Generar un preview, modificar precio o avance en otra sesión e intentar emitir: debe pedir regenerarlo.

## Verificación

- Migración: `node scripts/aplicar-migracion-costos.js`
- Esquema: `node scripts/verificar-costos-fase1.js`
- Reglas: `npm test`
- Frontend: `npm run build` en `360Front`.

## Decisiones y desvíos documentados

- El prompt denomina `fecha_efectiva`; el esquema existente utiliza `AvanceOperacion.fecha_registro`. Se adopta esa columna sin modificar Avances.
- El prompt solicita `row_version` en Operación, pero un nombre genérico puede colisionar con futuras extensiones. Se creó `economia_row_version`, exclusivo de concurrencia económica.
- Las rutas sugeridas se montaron bajo recursos separados (`economia-operaciones` y `certificados-cliente`) para conservar el aislamiento y los contratos existentes.
- Los permisos solicitados se representaron con el modelo real `Accion + Entidad`; no se inventó un segundo sistema de autorización.
- Los certificados con importe total cero pueden emitirse si existe algún delta positivo en operaciones de precio cero; solo se rechaza cuando todos los deltas son cero, tal como exige la regla funcional.
- No se implementaron estados de borrador/rechazo, anulaciones, numeración comercial, certificados a contratistas, materiales, rentabilidad, impuestos, PDF ni demás elementos fuera de Fase 1.

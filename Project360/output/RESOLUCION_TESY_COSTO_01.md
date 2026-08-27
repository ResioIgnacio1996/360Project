# Resolución del reporte TESY_COSTO_01

Fecha de resolución: 21/08/2026

## 1. Fecha desplazada por zona horaria

**Estado:** corregido.

- La fecha inicial del formulario ahora se construye con año, mes y día locales. Ya no utiliza `toISOString()`, que podía avanzar al día UTC siguiente.
- Las fechas SQL `DATE` del listado y detalle se muestran como fechas de calendario `DD/MM/YYYY` sin pasarlas por el `DatePipe` de Angular.
- La fecha enviada y almacenada continúa siendo `YYYY-MM-DD`.

## 2. Segundo preview bloqueado por motivo

**Estado:** corregido.

La construcción del preview ya no reutiliza la validación de modificación manual. Si el avance físico es menor que el porcentaje certificado anterior, propone el acumulado anterior y calcula delta cero sin exigir motivo. Al emitir, la modificación se compara contra esa sugerencia válida y no contra el avance físico, evitando que una línea arrastrada sin cambios vuelva a exigir el motivo del certificado anterior. El motivo se valida únicamente cuando el usuario modifica la sugerencia actual.

Se agregó la prueba automatizada:

`segundo preview respeta el acumulado anterior sin exigir motivo`

## 3. Usuario de auditoría

**Estado:** comportamiento confirmado como correcto.

La base contiene:

- Login: `IRE`.
- Nombre visible: `ignacio`.
- `usuario_id`: 1.

El historial y el certificado #1 fueron registrados con `usuario_id = 1`. La interfaz muestra el nombre visible `ignacio`, por lo que no hubo atribución a otro usuario.

## 4. Todas las operaciones marcadas como certificadas

**Estado:** corregido.

- Se mantienen todas las operaciones dentro del detalle del certificado para preservar la fotografía completa exigida por la Fase 1.
- Una operación solo aparece con estado `CERTIFICADA` cuando su detalle tiene `porcentaje_actual > 0` o `delta > 0`.
- El bloqueo de cambio de responsable utiliza el mismo criterio.
- Las líneas históricas completamente en cero no bloquean al responsable.

El trigger actualizado se aplicó en la base mediante la migración idempotente.

## 5. Codificación del manual

**Estado:** corregido.

El manual se conserva en UTF-8 y ahora incluye BOM para que los editores de Windows detecten explícitamente la codificación. Se verificó que el contenido no contiene secuencias dañadas como `Ã`, `â` o `Â`.

## Verificaciones ejecutadas

- Migración idempotente aplicada correctamente.
- Verificación de tablas, columnas, permisos, índices y trigger: correcta.
- Pruebas backend: 17 aprobadas, 0 fallidas.
- Compilación Angular: correcta.
- Verificación directa de la identidad de auditoría: correcta.
- Segundo preview real sobre las 19 operaciones: correcto.
- Operaciones archivadas: excluidas correctamente.
- Responsable de operación con reconocimiento positivo: bloqueado correctamente.
- Responsable de línea histórica completamente en cero: modificación permitida dentro de prueba transaccional con rollback.
- Precio cliente y costo responsable: confirmados como `DECIMAL(19,4)`.
- Observaciones: 1.000 caracteres aceptados y más de 1.000 rechazados en backend.
- Motivos: más de 500 caracteres rechazados en backend.

La compilación conserva únicamente las advertencias de presupuesto preexistentes del bundle inicial y de los CSS de Programación y Avances.

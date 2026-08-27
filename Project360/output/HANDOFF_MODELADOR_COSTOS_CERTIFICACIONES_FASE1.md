# Handoff para modelador

## Módulo Costos y Certificaciones - Fase 1

Fecha del documento: 22/08/2026

Este documento resume la implementación, las decisiones funcionales, los cambios de base de datos, las correcciones surgidas durante testing y el estado final de validación del módulo **Costos y Certificaciones** de OBRA360.

---

## 1. Objetivo implementado

La Fase 1 permite:

- Cargar precio cliente y costo responsable por operación.
- Auditar todas las modificaciones económicas.
- Reconstruir el avance físico de cada operación para una fecha de corte.
- Generar un preview temporal sin persistir documentos.
- Ajustar manualmente el porcentaje a certificar con justificación.
- Emitir certificados al cliente aplicando la regla del delta.
- Conservar una fotografía histórica de precios, porcentajes e importes.
- Consultar el listado y detalle de certificados emitidos.
- Evitar duplicaciones y emisiones basadas en previews desactualizados.
- Mantener Costos separado de Programación, Avances, Compras, Materiales y Stock.

---

## 2. Separación funcional

### Fuente productiva

- `Proyecto`: obra, estado y cliente.
- `VersionPlan`, `EtapaOperacion` y `Operacion`: estructura del plan activo.
- `AvanceOperacion`: avance físico histórico.
- `ResponsableOperacion`: responsable operativo.

### Fuente económica

- Campos económicos agregados en `Operacion`.
- `HistorialEconomiaOperacion`.
- `CertificadoCliente`.
- `CertificadoClienteDetalle`.

### Efectos expresamente evitados

Emitir un certificado no modifica:

- Avance físico.
- Estado productivo de la operación.
- Fechas del cronograma.
- Dependencias.
- Programación.
- Compras.
- Remitos.
- BOM.
- Materiales.
- Containers.
- Stock.

---

## 3. Reglas de negocio implementadas

### 3.1. Proyecto

- Todo certificado pertenece a un único proyecto.
- El proyecto debe existir.
- Debe estar activo.
- Debe tener `estado = ACTIVO`.
- No puede estar eliminado.
- Debe tener un cliente asociado.
- No se permite certificar una fecha anterior al último certificado emitido.
- Se permite la misma fecha que el último certificado si existe un delta nuevo.

### 3.2. Operaciones incluidas

- Se utiliza exclusivamente la versión activa del plan.
- Se incluyen todas las operaciones vigentes.
- Se incluyen operaciones con avance cero, precio cero y delta cero.
- Se excluyen operaciones archivadas.
- La secuencia no se usa como filtro de corte.
- Una operación sin responsable puede participar.

### 3.3. Valores económicos

- `precio_cliente >= 0`.
- `costo_responsable >= 0`.
- Cero es un valor válido.
- Se almacenan como `DECIMAL(19,4)`.
- La interfaz los muestra con un decimal.
- Toda modificación requiere un motivo.
- El motivo admite hasta 500 caracteres.
- La actualización y el historial se guardan dentro de la misma transacción.
- Si los valores enviados son iguales a los existentes, se responde `No hubo cambios` y no se crea historial.

### 3.4. Avance físico histórico

La columna existente que funciona como fecha efectiva es:

```text
AvanceOperacion.fecha_registro
```

Para una operación y una fecha de corte se toma:

1. El último avance con `fecha_registro <= fecha_corte`.
2. Si hay varios avances el mismo día, se desempata por:
   - `fecha_creacion DESC`.
   - `avance_id DESC`.
3. Si no existe avance aplicable, se considera 0%.
4. Una carga retroactiva puede modificar previews futuros, pero nunca certificados ya emitidos.

### 3.5. Porcentaje sugerido

La sugerencia se calcula como:

```text
porcentaje_sugerido = MAX(avance_fisico_referencia, porcentaje_anterior)
```

El uso de `MAX` es necesario porque nunca se puede retroceder respecto del porcentaje ya certificado.

Ejemplo:

- Avance físico: 0%.
- Porcentaje certificado anterior: 20%.
- Sugerencia del segundo preview: 20%.
- Delta: 0%.
- No requiere repetir el motivo del certificado anterior.

### 3.6. Regla del delta

```text
porcentaje_anterior = último porcentaje_actual emitido para la operación
delta = porcentaje_actual - porcentaje_anterior
importe = precio_cliente_vigente × delta ÷ 100
```

Validaciones:

- Sin certificado anterior, el porcentaje anterior es 0%.
- El porcentaje actual no puede ser negativo.
- No puede ser menor al porcentaje anterior.
- No puede superar 100%.
- Un delta cero es válido dentro del preview y como línea de contexto.
- No puede emitirse un certificado si todas las líneas tienen delta cero.
- Puede existir un certificado con total monetario cero si hay delta positivo en una operación cuyo precio es cero.

### 3.7. Modificación manual

Una línea se considera modificada manualmente si el porcentaje ingresado difiere del `porcentaje_sugerido` actual.

No se compara únicamente contra el avance físico, porque el porcentaje anterior puede ser superior al avance de referencia.

Cuando hay modificación manual:

- Se exige motivo.
- El motivo admite hasta 500 caracteres.
- Se guarda `modificado_manualmente = 1`.
- Se conserva el motivo dentro del detalle emitido.

### 3.8. Cambio posterior de precio

- Los certificados anteriores conservan su precio aplicado e importe.
- El porcentaje anterior continúa desde el último certificado emitido.
- El nuevo precio se aplica solamente al delta futuro.

Ejemplo:

```text
Precio anterior: 1.000
Primer certificado acumulado: 40%
Primer importe: 400

Precio nuevo: 1.500
Nuevo acumulado: 70%
Delta nuevo: 30%
Nuevo importe: 450
```

### 3.9. Operación certificada y responsable

Todas las operaciones vigentes se conservan como líneas del certificado para mantener la fotografía completa del proyecto.

Sin embargo, una operación solamente se considera realmente `CERTIFICADA` cuando:

```text
porcentaje_actual > 0 OR delta > 0
```

Consecuencias:

- Una línea completamente en cero no aparece como certificada.
- Una línea completamente en cero no bloquea el cambio de responsable.
- Si la operación tuvo porcentaje certificado o delta positivo, no puede cambiarse su responsable.
- Para transferir trabajo restante a otro responsable debe crearse una nueva operación.

### 3.10. Observaciones

- Son opcionales.
- Se guardan en la cabecera.
- Longitud máxima: 1.000 caracteres.
- El límite se valida tanto en frontend como en backend.

---

## 4. Modelo de datos aplicado

### 4.1. Extensión de `Operacion`

```sql
precio_cliente DECIMAL(19,4) NOT NULL DEFAULT 0
costo_responsable DECIMAL(19,4) NOT NULL DEFAULT 0
economia_actualizada_por BIGINT NULL
economia_actualizada_en DATETIME2(0) NULL
economia_row_version ROWVERSION
```

Restricciones:

- Precio no negativo.
- Costo no negativo.
- FK de `economia_actualizada_por` hacia `Usuario`.

Se utilizó `economia_row_version` en lugar de un nombre genérico `row_version` para identificar claramente su uso en concurrencia económica.

### 4.2. `HistorialEconomiaOperacion`

Campos principales:

```text
historial_economia_id
operacion_id
campo_modificado
valor_anterior
valor_nuevo
motivo
usuario_id
fecha_modificacion
```

Valores admitidos para `campo_modificado`:

- `precio_cliente`.
- `costo_responsable`.

No se implementó borrado de historial.

### 4.3. `CertificadoCliente`

Campos:

```text
certificado_cliente_id
proyecto_id
metodo_corte
fecha_certificacion
total
estado
observaciones
creado_por
fecha_creacion
row_version
```

Valores de esta fase:

- `metodo_corte = POR_FECHA`.
- Estado operativo: `EMITIDO`.
- `RECHAZADO` queda preparado en la restricción, sin circuito funcional implementado.

### 4.4. `CertificadoClienteDetalle`

Campos:

```text
detalle_id
certificado_cliente_id
operacion_id
secuencia_aplicada
avance_fisico_referencia
porcentaje_anterior
porcentaje_actual
delta
precio_cliente_aplicado
importe
modificado_manualmente
motivo_modificacion
```

La combinación `certificado_cliente_id + operacion_id` es única.

Los detalles emitidos no se recalculan por cambios posteriores.

### 4.5. Trigger

Se creó:

```text
TR_Operacion_bloquear_responsable_certificado
```

Bloquea cambios de `responsable_id` cuando la operación tiene un detalle emitido con porcentaje o delta positivo.

No bloquea líneas históricas completamente en cero.

### 4.6. Índices

- `IX_Operacion_proyecto_archivada`.
- `IX_AvanceOperacion_operacion_fecha`.
- `IX_Certificado_proyecto_fecha`.
- `IX_CertificadoDetalle_operacion`.
- `IX_HistorialEconomia_operacion_fecha`.

### 4.7. Migración

Archivo:

```text
srv/DB/migrations/20260821_costos_certificaciones_fase1.sql
```

Características:

- Aditiva.
- Idempotente.
- Transaccional.
- Sin borrado de datos preexistentes.
- Aplicada en la base configurada.
- Ejecutada nuevamente para verificar idempotencia.

---

## 5. Seguridad

Se creó la entidad:

```text
COSTOS_CERTIFICACIONES
```

Permisos:

```text
COSTOS_VER
ECONOMIA_OPERACION_EDITAR
CERTIFICADO_CLIENTE_PREVIEW
CERTIFICADO_CLIENTE_EMITIR
CERTIFICADO_CLIENTE_VER
```

Integración:

- Se reutiliza el modelo existente `Accion + Entidad + Accion_Rol`.
- El backend valida cada endpoint.
- El frontend oculta acciones y secciones según permisos.
- La migración asigna automáticamente los permisos a roles llamados `Admin` o `Administrador`.

---

## 6. Endpoints implementados

| Método | Endpoint | Permiso |
|---|---|---|
| GET | `/api/economia-operaciones/permisos` | Usuario autenticado |
| GET | `/api/economia-operaciones/proyectos/:proyectoId/operaciones` | `COSTOS_VER` |
| PATCH | `/api/economia-operaciones/operaciones/:operacionId` | `ECONOMIA_OPERACION_EDITAR` |
| GET | `/api/economia-operaciones/operaciones/:operacionId/historial` | `COSTOS_VER` |
| POST | `/api/certificados-cliente/proyectos/:proyectoId/preview-fecha` | `CERTIFICADO_CLIENTE_PREVIEW` |
| POST | `/api/certificados-cliente/proyectos/:proyectoId` | `CERTIFICADO_CLIENTE_EMITIR` |
| GET | `/api/certificados-cliente/proyectos/:proyectoId` | `CERTIFICADO_CLIENTE_VER` |
| GET | `/api/certificados-cliente/proyectos/:proyectoId/:certificadoId` | `CERTIFICADO_CLIENTE_VER` |

### Preview

Entrada:

```json
{
  "fecha_certificacion": "2026-08-21"
}
```

El preview no inserta cabecera ni detalles.

Cada línea devuelve una base de concurrencia con:

- Versión económica.
- Avance utilizado.
- Identificador del evento de avance.
- Detalle certificado anterior.
- Porcentaje anterior.

### Emisión

El frontend envía:

- Fecha.
- Observaciones.
- Operación.
- Porcentaje actual elegido.
- Motivo, cuando corresponde.
- Base de concurrencia del preview.

El backend no confía en:

- Precio enviado.
- Porcentaje anterior enviado.
- Delta enviado.
- Importe enviado.
- Total enviado.

Todos esos valores se consultan o recalculan en servidor.

---

## 7. Concurrencia e integridad

La emisión utiliza:

```text
ISOLATION_LEVEL.SERIALIZABLE
UPDLOCK
HOLDLOCK
```

Flujo:

1. Iniciar transacción.
2. Bloquear proyecto y operaciones involucradas.
3. Validar proyecto.
4. Consultar nuevamente avance, precio y certificado anterior.
5. Comparar con la base del preview.
6. Rechazar si cambió cualquier dato relevante.
7. Recalcular porcentajes, delta, importes y total.
8. Insertar cabecera.
9. Insertar detalles.
10. Confirmar transacción.

Si falla cualquier punto, se ejecuta rollback y no queda un documento incompleto.

Se detectan como preview obsoleto:

- Cambio de precio o costo económico que modifica `economia_row_version`.
- Nuevo evento de avance aplicable.
- Cambio del avance de referencia.
- Emisión de otro certificado para la operación.
- Cambio del porcentaje anterior.
- Cambio del conjunto de operaciones vigentes.

---

## 8. Frontend implementado

Ruta:

```text
/proyectos/:id/costos
```

Acceso desde el hub del proyecto mediante la tarjeta:

```text
Costos y Certificaciones
```

### Pantallas

#### Economía de operaciones

- Lista del plan activo.
- Etapa, secuencia, operación y responsable.
- Avance actual.
- Precio cliente.
- Costo responsable.
- Estado de certificación.
- Edición económica.
- Historial de cambios.

#### Nueva certificación

- Fecha local de corte.
- Preview temporal.
- Avance físico de referencia.
- Porcentaje anterior.
- Porcentaje sugerido.
- Porcentaje editable.
- Diferencia.
- Delta.
- Precio.
- Importe.
- Motivo.
- Observaciones.
- Total.
- Emisión.

#### Certificados emitidos

- Listado de documentos.
- Fecha.
- Total.
- Usuario.
- Estado.
- Detalle histórico completo.

### Fechas

Corrección aplicada después del primer test:

- La fecha inicial se arma con año, mes y día de la zona local.
- No se usa `new Date().toISOString()` para el valor inicial.
- Los campos SQL `DATE` se presentan como fecha de calendario sin convertirlos en instantes UTC.
- Se evita el desplazamiento de `21/08/2026` a `20/08/2026` o `22/08/2026`.

---

## 9. Errores encontrados por testing y resolución

### Error 1: fecha desplazada

**Causa:** conversión entre fecha sin hora, UTC y zona local.

**Solución:** fecha local para el input y formateo calendario directo para SQL `DATE`.

### Error 2: segundo preview pedía motivo

**Causa:** el preview utilizaba la validación de modificación manual contra el avance físico.

**Solución:** el preview propone `MAX(avance, anterior)` sin exigir motivo.

### Error adicional encontrado durante corrección

La emisión posterior también podía exigir nuevamente el motivo cuando el acumulado anterior era mayor que el avance físico.

**Solución:** la modificación manual se compara contra el porcentaje sugerido actual, no exclusivamente contra el avance físico.

### Error 3: auditoría mostraba `ignacio` usando login `IRE`

**Resultado de investigación:** no era un error.

En la base:

```text
usuario_id: 1
login: IRE
nombre visible: ignacio
```

Historial y certificado #1 fueron atribuidos al `usuario_id = 1` correcto.

### Error 4: las 19 operaciones aparecían certificadas

**Causa:** el estado visual y el trigger consideraban cualquier aparición en el detalle, incluso líneas completamente en cero.

**Solución:** considerar certificada solamente una operación con `porcentaje_actual > 0 OR delta > 0`.

### Error 5: caracteres dañados en el manual

**Solución:** manual guardado en UTF-8 con BOM para compatibilidad con editores de Windows.

---

## 10. Datos del test funcional existente

Proyecto:

```text
IRE001
Cliente: BIAOTTO BRUNO
Operaciones vigentes: 19
```

Operación 100:

```text
Excavación y movimiento de suelos
Precio inicial: 10.000
Costo responsable: 6.000
Avance físico: 0%
Primer porcentaje certificado: 20%
Primer delta: 20%
Primer importe: 2.000
Precio actual posterior: 15.000
```

Certificado #1:

```text
Fecha almacenada: 2026-08-21
Operaciones con reconocimiento positivo: 1
Líneas de contexto completamente en cero: 18
Total: 2.000
```

Los 18 detalles en cero permanecen como fotografía contextual, pero no marcan esas operaciones como certificadas ni bloquean sus responsables.

---

## 11. Verificaciones ejecutadas

### Pruebas automatizadas

Resultado final:

```text
17 aprobadas
0 fallidas
```

Casos cubiertos:

1. Primera certificación.
2. Certificado posterior por delta.
3. Precio cero.
4. Certificar menos que el avance con motivo.
5. Rechazo de modificación manual sin motivo.
6. Rechazo de retroceso respecto del porcentaje anterior.
7. Rechazo de porcentaje superior a 100%.
8. Cambio de precio aplicado solamente al delta futuro.
9. Segundo preview respetando acumulado anterior sin motivo.
10. Emisión posterior conservando acumulado sin tratarlo como cambio manual.
11. Preview obsoleto por cambio de rowversion/precio.
12. Preview obsoleto por nuevo certificado anterior.
13. Rechazo de proyecto inactivo.
14. Rechazo de proyecto sin cliente.
15. Observaciones de exactamente 1.000 caracteres.
16. Rechazo de observaciones mayores a 1.000 caracteres.
17. Rechazo de motivos mayores a 500 caracteres.

### Auditoría contra base real

- Migración aplicada correctamente.
- Migración idempotente confirmada.
- Tablas nuevas presentes.
- Columnas económicas presentes.
- Permisos presentes.
- Índices presentes.
- Trigger presente.
- Segundo preview real generado con 19 líneas.
- Operaciones archivadas excluidas.
- `DECIMAL(19,4)` verificado directamente.
- Fecha del certificado #1 verificada como `2026-08-21`.
- Solo una operación reconocida como certificada.
- Dieciocho líneas conservadas como contexto cero.
- Responsable de operación certificada bloqueado.
- Responsable de línea cero permitido mediante prueba transaccional.
- Las pruebas de actualización de responsable hicieron rollback y no dejaron modificaciones.

### Frontend

- Compilación Angular correcta.
- Chunk diferido `costos-certificaciones` generado correctamente.
- Pantalla pública de login cargada en navegador local.
- El recorrido visual autenticado no se automatizó porque no se proporcionó contraseña del usuario de prueba.

### Advertencias de compilación no originadas por Costos

Persisten advertencias preexistentes:

- Bundle inicial por encima de 1,50 MB.
- CSS de Programación por encima del presupuesto.
- CSS de Avance de Operaciones por encima del presupuesto.

No impiden compilar.

---

## 12. Archivos principales agregados

### Base de datos

```text
srv/DB/migrations/20260821_costos_certificaciones_fase1.sql
```

### Backend

```text
srv/controllers/EconomiaOperacion.controller.js
srv/controllers/CertificadoCliente.controller.js
srv/services/EconomiaOperacion.service.js
srv/services/CertificacionCliente.service.js
srv/services/reglasCostos.js
srv/routes/EconomiaOperacion.routes.js
srv/routes/CertificadoCliente.routes.js
srv/middlewares/permiso.middleware.js
```

### Frontend

```text
360Front/src/app/core/services/costos/costos.service.ts
360Front/src/app/features/costos/costos-certificaciones.ts
360Front/src/app/features/costos/costos-certificaciones.html
360Front/src/app/features/costos/costos-certificaciones.css
```

### Pruebas y verificación

```text
srv/tests/reglas-costos.test.js
srv/scripts/aplicar-migracion-costos.js
srv/scripts/verificar-costos-fase1.js
srv/scripts/probar-costos-lectura.js
srv/scripts/auditar-casos-testing-costos.js
```

### Documentación

```text
output/COSTOS_CERTIFICACIONES_FASE1_IMPLEMENTACION.md
output/MANUAL_USUARIO_COSTOS_CERTIFICACIONES_FASE1.md
output/TESY_COSTO_01.md
output/RESOLUCION_TESY_COSTO_01.md
output/HANDOFF_MODELADOR_COSTOS_CERTIFICACIONES_FASE1.md
```

### Archivos existentes integrados

```text
srv/index.js
srv/package.json
360Front/src/app/app.routes.ts
360Front/src/app/features/proyectos/proyecto-home.ts
360Front/src/app/features/proyectos/proyecto-home.html
```

No se modificaron las reglas productivas de Programación, Avances, Materiales, BOM o Stock.

---

## 13. Comandos de verificación

### Backend

Desde `srv`:

```powershell
npm test
node scripts\verificar-costos-fase1.js
node scripts\probar-costos-lectura.js
node scripts\auditar-casos-testing-costos.js
```

### Migración

```powershell
node scripts\aplicar-migracion-costos.js
```

### Frontend

Desde `360Front`:

```powershell
npm run build
```

---

## 14. Alcance no implementado

Continúa fuera de Fase 1:

- Certificados a contratistas.
- Cuentas corrientes.
- Pagos.
- Cobranzas.
- Borradores.
- Numeración comercial.
- Anulación de certificados.
- Firma o aceptación del cliente.
- Adjuntos.
- PDF firmado.
- Impuestos.
- Conversión de monedas.
- Rentabilidad o margen.
- Plan financiero.
- Curva S.
- Integración automática con materiales, compras o stock.
- Operación ancla.
- Anticipos como entidad o circuito específico.

La posibilidad funcional de certificar por encima del avance físico permite representar un acuerdo comercial, pero no se creó un circuito separado de anticipos.

---

## 15. Pendientes de testing manual

Aunque las reglas fueron cubiertas automatizadamente, conviene que testing repita visualmente:

1. Segundo preview después del certificado #1.
2. Segundo certificado llevando la operación 100 de 20% a 70%.
3. Confirmación del importe de 7.500 × 50% si el precio vigente es 15.000 y el delta es 50%.
4. Visualización correcta de `21/08/2026` en listado y detalle.
5. Rechazo visual de certificado con todos los deltas en cero.
6. Regeneración obligatoria de preview después de modificar precio o avance en otra sesión.
7. Visibilidad de pestañas y botones con un rol sin permisos.
8. Proyecto pausado o inactivo.
9. Proyecto sin cliente.
10. Operación archivada.
11. Cambio de responsable de una operación certificada y de una línea cero.
12. Observaciones de exactamente 1.000 caracteres.

Para automatizar el recorrido visual autenticado hace falta una cuenta de testing o una sesión autenticada disponible; no se almacenaron ni alteraron contraseñas.

---

## 16. Estado final

El módulo se encuentra implementado, migrado, compilado y validado a nivel de reglas, servicios y base de datos.

Estado técnico actual:

```text
Migración: aplicada y verificada
Backend: correcto
Frontend: compila correctamente
Pruebas automatizadas: 17/17
Pruebas de base: correctas
Errores TESY_COSTO_01: corregidos
Datos temporales de prueba: rollback, sin persistencia
```


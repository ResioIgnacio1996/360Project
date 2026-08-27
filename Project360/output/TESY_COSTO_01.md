# Test de Costos 01

## Alcance

Prueba funcional realizada como usuario sobre el módulo **Costos y Certificaciones** de OBRA360, siguiendo el manual de Fase 1.

- Usuario de acceso: `ire`
- Proyecto: `IRE001`
- Cliente: `BIAOTTO BRUNO`
- Proyecto activo: sí
- Operaciones visibles: 19

## Pruebas realizadas correctamente

- Inicio de sesión y acceso al proyecto.
- Acceso a **Costos y Certificaciones**.
- Visualización de las tres secciones:
  - Economía de operaciones.
  - Nueva certificación.
  - Certificados emitidos.
- Carga y modificación de precio cliente y costo responsable.
- Validación visual de importes negativos.
- Registro obligatorio del motivo del cambio.
- Mensaje **No hubo cambios** al guardar valores sin modificaciones.
- Creación y consulta del historial económico.
- Generación del primer preview con las 19 operaciones.
- Ajuste manual del porcentaje certificado.
- Cálculo correcto del delta y del importe.
- Emisión y consulta del certificado #1.
- Conservación histórica del precio y del importe después de modificar el precio actual.
- Rechazo de una fecha anterior al último certificado.
- Cambio del estado de las operaciones a `CERTIFICADA` después de emitir.

## Datos utilizados

### Operación 100

- Operación: Excavación y movimiento de suelos.
- Precio inicial de prueba: `10.000`.
- Costo responsable: `6.000`.
- Motivo: `Prueba funcional del módulo de costos`.
- Avance físico: `0%`.
- Porcentaje certificado: `20%`.
- Delta: `20%`.
- Importe certificado: `2.000`.

Después de emitir se modificó el precio cliente a `15.000` con motivo auditado. El certificado anterior conservó correctamente el precio histórico de `10.000` y el importe de `2.000`.

## Errores encontrados

### 1. Fecha desplazada por zona horaria — crítico

#### Pasos para reproducir

1. Abrir **Nueva certificación**.
2. Seleccionar `21/08/2026`.
3. Generar el preview.
4. Emitir el certificado.
5. Consultar **Certificados emitidos**.

#### Resultado actual

- La fecha automática llegó a proponer `22/08/2026` cuando la fecha local era `21/08/2026`.
- El certificado emitido para `21/08/2026` aparece en el listado y el detalle como `20/08/2026`.
- Al validar una fecha anterior, el servidor sí informa que el último certificado corresponde a `2026-08-21`.

#### Resultado esperado

La fecha seleccionada, almacenada y mostrada debe ser siempre `21/08/2026`.

#### Observación técnica

El comportamiento es compatible con una conversión incorrecta entre fechas sin hora, UTC y la zona horaria local.

### 2. No se puede generar el segundo preview — crítico

#### Precondición

Existe un certificado con avance físico `0%` y porcentaje acumulado certificado `20%`, con motivo informado correctamente en el primer certificado.

#### Pasos para reproducir

1. Abrir **Nueva certificación** después de emitir el primer certificado.
2. Seleccionar la misma fecha o una fecha posterior válida.
3. Presionar **Generar preview** sin modificar porcentajes.

#### Resultado actual

El sistema no genera el preview y muestra:

```text
La modificacion manual requiere motivo
```

El error persiste después de presionar **Actualizar**. También se reprodujo usando la fecha posterior `22/08/2026`.

#### Resultado esperado

El preview debe generarse sin exigir motivos. El porcentaje sugerido debe respetar el acumulado anterior de `20%`. La validación del motivo corresponde a las líneas modificadas o a la emisión, no a la generación del preview.

### 3. Posible usuario incorrecto en auditoría

#### Pasos para reproducir

1. Iniciar sesión con el usuario `ire`.
2. Modificar el precio o costo de una operación.
3. Consultar el historial económico y el certificado emitido.

#### Resultado actual

Los cambios y el certificado aparecen atribuidos a `ignacio`.

#### Resultado esperado

Debe mostrarse el usuario autenticado `ire`, salvo que `ire` esté intencionalmente asociado al nombre visible `ignacio`.

### 4. Todas las operaciones quedan marcadas como CERTIFICADA

#### Pasos para reproducir

1. Emitir un certificado donde solamente la operación 100 tenga un delta positivo.
2. Volver a **Economía de operaciones**.

#### Resultado actual

Las 19 operaciones quedan marcadas como `CERTIFICADA`, incluyendo líneas con porcentaje, delta, precio e importe iguales a cero.

#### Riesgo

Esto puede bloquear el cambio de responsable de operaciones que no tuvieron reconocimiento económico real.

#### Resultado esperado recomendado

Revisar si solamente deben considerarse certificadas las operaciones con porcentaje certificado o delta positivo. Si incluir todas las líneas es intencional, ajustar la regla que impide cambiar responsables.

### 5. Codificación incorrecta del manual

El archivo Markdown del manual contiene caracteres dañados, por ejemplo:

- `cÃ³mo`
- `certificaciÃ³n`
- `â€œ`
- `â†“`

Debe guardarse y leerse como UTF-8.

## Pruebas que no pudieron completarse

El bloqueo del segundo preview impidió validar:

- Segundo certificado.
- Delta posterior de `20%` a `70%`.
- Aplicación del nuevo precio únicamente al delta futuro.
- Rechazo de un certificado con todos los deltas en cero.
- Preview desactualizado por concurrencia.

También quedaron pendientes por requerir otras configuraciones o usuarios:

- Roles sin permisos.
- Proyecto pausado o inactivo.
- Proyecto sin cliente.
- Operaciones archivadas.
- Cambio de responsable desde el módulo correspondiente.
- Observaciones de 1.000 caracteres.
- Verificación directa de cuatro decimales en la base de datos.

## Datos persistidos por la prueba

- Operación 100:
  - Precio cliente actual: `15.000`.
  - Costo responsable: `6.000`.
- Certificado #1:
  - Fecha reconocida por el servidor: `21/08/2026`.
  - Fecha mostrada por la interfaz: `20/08/2026`.
  - Porcentaje: `20%`.
  - Total: `2.000`.
- No se emitió un segundo certificado.

## Prioridad sugerida

1. Corregir el bloqueo del segundo preview.
2. Corregir el desplazamiento de fechas.
3. Revisar el estado `CERTIFICADA` para líneas con delta cero.
4. Confirmar el usuario utilizado por la auditoría.
5. Corregir la codificación UTF-8 del manual.

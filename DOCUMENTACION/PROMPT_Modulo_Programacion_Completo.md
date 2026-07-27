# PROMPT PARA DESARROLLADOR — Módulo de Programación APS + Avances
## OBRA360 — MES para Construcción
## Documento completo para implementación desde cero

---

## 1. CONTEXTO DEL PROYECTO

OBRA360 es un sistema MES (Manufacturing Execution System) adaptado para
estudios de arquitectura y constructoras medianas de Latinoamérica.
Opera desde desktop (Planificador) y tablet/móvil (Capataz en campo).

El módulo que hay que implementar cubre:
- La carga y gestión del plan de obra (BOP)
- El cronograma con Gantt comparativo
- El registro de avances por el Capataz
- La reprogramación automática en cascada

**Referencia visual obligatoria:**
- `/docs/prototipos/OBRA360_Programacion_v3.html` — pantalla de programación
- `/docs/prototipos/OBRA360_Avances_v5.html` — pantalla de avances del Capataz
- `CLAUDE.md` — decisiones de diseño globales

---

## 2. CONCEPTOS CLAVE DEL DOMINIO

### BOP (Plan de Obra)
Es el plan maestro del proyecto. Se carga desde un archivo Excel
(plantilla PC-PA-0001) con tres hojas: Etapas, Responsables y Operaciones.
Puede tener múltiples versiones (v1, v2, v3...) a medida que el Planificador
lo reimporta con cambios.

### Etapa
Agrupación de operaciones. Ej: "E1 - Excavación", "E2 - Estructura PB-P3".
Su avance se calcula automáticamente como la suma ponderada del avance
de sus operaciones. No tiene duración propia.

### Operación
Unidad mínima de planificación. Tiene duración en horas, dependencias
con otras operaciones, un responsable asignado y un tipo de avance.
Es la entidad central del módulo.

### Dependencia
Relación entre operaciones: la operación B no puede iniciar hasta que
la operación A esté completa. Se almacena en `op_dependencias`.
En el Excel viene como campo texto "Depende_De" separado por punto y coma
(ej: "200;300"), que se normaliza al importar.

### Calendario
Define los días laborables del proyecto y la jornada estándar.
Cada día puede ser: 0 = No laborable, 1 = Jornada completa, 2 = Jornada parcial.
Las excepciones puntuales (feriados, lluvia) se cargan en `excepciones_calendario`.

### Versión del Plan
Cada importación del Excel genera una versión (v1, v2...).
Solo una versión es activa por proyecto. Las anteriores se conservan
en historial para comparar.

### Roles
- **PLANIFICADOR**: carga el BOP, configura el calendario, puede editar
  duraciones y restricciones, ve el Gantt completo con las 3 líneas.
- **CAPATAZ**: solo ve y registra avances en sus operaciones asignadas.
  No puede modificar el plan.

---

## 3. ESTRUCTURA DE DATOS

### Tablas principales involucradas

```
empresas
proyectos               → 1 proyecto tiene 1 calendario
calendarios             → días laborables + jornada estándar
excepciones_calendario  → días puntuales especiales (feriados, lluvia)
versiones_plan          → historial de importaciones del BOP
responsables            → cuadrillas y subcontratistas
etapas                  → agrupaciones de operaciones
operaciones             → unidad mínima (tabla central)
op_dependencias         → relaciones predecesora → sucesora
bom_operacion           → materiales teóricos por operación
avance_registros        → historial inmutable de avances del Capataz
consumo_materiales      → materiales consumidos por registro de avance
historial_cambios_op    → auditoría de cambios del Planificador
historial_nmt           → auditoría de restricciones NMT
cache_reprogramacion    → fechas reprogramadas calculadas (caché)
estado_operacion        → catálogo: PENDIENTE/EN_CURSO/COMPLETA/BLOQUEADA/ATRASADA/ARCHIVADA
estado_etapa            → catálogo: PENDIENTE/EN_CURSO/COMPLETA
unidad_avance           → catálogo: PORCENTAJE/CANTIDAD/BINARIO
unidad_medida           → catálogo: kg/m²/m³/ml/unid/bolsas/lt/tn
```

### Atributos clave de la tabla operaciones

```sql
-- Identificación
secuencia           INT           -- número de orden, múltiplos de 100, único por proyecto
nombre              NVARCHAR(200)
descripcion         NVARCHAR(MAX) -- instrucciones de trabajo (texto libre desde Excel)
criterio_cierre     NVARCHAR(MAX) -- cuándo se considera terminada

-- Planificación
duracion_hs         DECIMAL(8,2)  -- horas de trabajo efectivo, > 0
desfase_inicio_hs   INT           -- horas de espera después de predecesoras, default 0
cantidad_meta       DECIMAL(10,2) -- solo si unidad_avance = CANTIDAD
peso_pct            DECIMAL(5,2)  -- peso sobre el avance de la etapa

-- Fechas INMUTABLES (baseline del plan original, nunca se sobreescriben)
fecha_inicio_estimada  DATE
fecha_fin_estimada     DATE

-- Fechas REALES (escritas una sola vez por el sistema)
fecha_inicio_real      DATE        -- al registrar el primer avance
fecha_fin_real         DATE        -- al llegar al 100%

-- Restricción NMT
fecha_nmt              DATE        -- "No Antes Del" — restricción de inicio manual
fecha_nmt_motivo       NVARCHAR(MAX) -- obligatorio si fecha_nmt no es null
fecha_nmt_creada_por   UUID        -- FK usuarios

-- Avance
pct_avance_actual      DECIMAL(5,2) -- 0 a 100
cantidad_acumulada     DECIMAL(10,2) -- solo para CANTIDAD

-- Control
estado_id              SMALLINT    -- calculado por el sistema, nunca por el usuario
archivada              BIT         -- TRUE si fue eliminada en reimportación con avances
```

---

## 4. FLUJO 1 — IMPORTACIÓN DEL BOP

### 4.1 Qué hace el usuario

El Planificador sube el archivo Excel PC-PA-0001 desde la pantalla
"Importar Datos del Proyecto". El archivo tiene 3 hojas obligatorias:
Etapas, Responsables y Operaciones.

### 4.2 Validaciones antes de procesar

```
Hoja Etapas:
  - Suma de peso_pct debe ser 100 ± 0.1
    Si no: normalizar automáticamente e informar al usuario
  - Código de etapa único por proyecto

Hoja Responsables:
  - Código único por empresa

Hoja Operaciones:
  - Campos obligatorios: Proyecto, Etapa, Secuencia, Nombre,
    Duracion_Hs, Unidad_Avance
  - Secuencia única por proyecto + versión
  - duracion_hs > 0
  - unidad_avance IN ('PORCENTAJE','CANTIDAD','BINARIO')
  - Si unidad_avance = 'CANTIDAD': cantidad_meta obligatoria y > 0
  - Depende_De: si contiene ';', parsear y verificar que todas las
    secuencias referenciadas existen en el mismo archivo
  - Detectar ciclos en dependencias (A depende de B y B depende de A)
    → no es bloqueante pero marcar como BLOQUEADA

Versión:
  - Si version_plan del Excel <= versión activa en BD:
    advertir al usuario pero no bloquear
  - Si version_plan > versión activa: ofrecer guardar la anterior en historial
```

### 4.3 Proceso de importación

```
1. Crear registro en versiones_plan con es_activa = TRUE
   Marcar la versión anterior como es_activa = FALSE

2. Insertar o actualizar etapas

3. Para cada operación del Excel:
   a. Insertar en tabla operaciones
   b. Parsear campo Depende_De y crear registros en op_dependencias
   c. Generar N filas vacías en bom_operacion según campo Cant_Materiales
      (sin_codigo = TRUE, material_id = NULL)

4. Si una operación existía en versión anterior y fue eliminada del nuevo Excel:
   - Si NO tiene avances: eliminar
   - Si TIENE avances: marcar archivada = TRUE, conservar todo
     Aparece en la tabla con estilo diferenciado (badge ARCHIVADA)

5. Ejecutar motor de cálculo de fechas estimadas (ver Sección 5)

6. Invalidar caché de reprogramación del proyecto

7. Registrar en log: usuario, fecha, versión, ops_nuevas,
   ops_modificadas, ops_archivadas
```

### 4.4 Errores en importación

Los errores deben indicar: número de fila exacto del Excel, nombre de
columna y valor problemático.

Ejemplo: `"Fila 14, columna Depende_De: la secuencia 999 no existe en este proyecto."`

Tipos de resultado:
- ✓ Sin errores → procesar y mostrar resumen
- ⚠ Solo advertencias → permitir continuar con confirmación del usuario
- ✗ Errores críticos → bloquear, mostrar tabla de errores, no importar

---

## 5. FLUJO 2 — MOTOR DE CÁLCULO DE FECHAS ESTIMADAS

Se ejecuta al importar el BOP y al modificar el calendario.

### 5.1 Función calcularFinLaboral

```
Entrada: fecha_inicio (DATE), horas_requeridas (DECIMAL), calendario_id

Para cada día avanzando desde fecha_inicio:
  1. Buscar en excepciones_calendario para ese día
     SI existe → usar hs_disponibles del registro
  2. Sino, leer el día de la semana del calendario:
     0 → 0 horas (no laborable, saltear)
     1 → hs_jornada_estandar
     2 → hs_jornada_parcial
  3. Restar horas disponibles del día a horas_restantes
  4. Cuando horas_restantes <= 0 → ese día es la fecha_fin

Retorna: fecha_fin (DATE)
```

### 5.2 Algoritmo BFS de fechas estimadas

```
1. Ordenar operaciones por secuencia ASC
2. Identificar raíces: ops sin registros en op_dependencias
   como operacion_id
3. Para raíces:
      fecha_inicio_estimada = fecha_inicio_proyecto (del calendario)
4. BFS hacia adelante:
   Para cada operación con predecesoras:
      fecha_inicio_estimada = MAX(fecha_fin_estimada de TODAS sus predecesoras)
                            + desfase_inicio_hs convertido a días laborales
5. Para todas:
      fecha_fin_estimada = calcularFinLaboral(
          fecha_inicio_estimada, duracion_hs, calendario_id
      )
6. Persistir fecha_inicio_estimada y fecha_fin_estimada en operaciones
   ESTOS VALORES SON INMUTABLES DESDE ESTE MOMENTO
```

---

## 6. FLUJO 3 — CONFIGURACIÓN DEL CALENDARIO

### 6.1 Qué configura el Planificador

```
Datos generales:
  nombre, zona_horaria

Días laborables (TINYINT por día):
  0 = No laborable
  1 = Jornada completa → usa hs_jornada_estandar
  2 = Parcial → usa hs_jornada_parcial

Jornada estándar:
  hs_jornada_estandar, hora_inicio, hora_fin, hs_almuerzo

Jornada parcial (si algún día = 2):
  hs_jornada_parcial, hora_inicio_parcial, hora_fin_parcial

Excepciones puntuales (tabla excepciones_calendario):
  fecha, tipo (FERIADO/JORNADA_REDUCIDA/JORNADA_EXTENDIDA),
  hs_disponibles, motivo
```

### 6.2 Impacto al guardar el calendario

Si ya existe BOP cargado:
- Recalcular TODAS las fechas estimadas (motor BFS completo)
- Mostrar advertencia previa: "Este cambio recalculará las fechas de X operaciones"
- Requerir confirmación del usuario
- No recalcular operaciones con estado COMPLETA
- Invalidar caché de reprogramación

---

## 7. FLUJO 4 — PANTALLA DE PROGRAMACIÓN (PLANIFICADOR)

### 7.1 Estructura visual

La pantalla tiene dos secciones sincronizadas (ver HTML de referencia):

**Tabla APS (mitad superior):**
Columnas: SEQ · OPERACIÓN · ETAPA · DEP. · RESP.
· INI.EST. · FIN EST. · INI.REP. · FIN REP.
· INI.REAL · FIN REAL · DESVÍO · AVANCE · ESTADO

- Separadores visuales por etapa
- Filtros por etapa, estado, responsable
- Click en fila → abre panel lateral de detalle
- Badge NMT junto al nombre si la OP tiene fecha_nmt definida

**Gantt (mitad inferior):**
- Barra translúcida = estimado original (baseline)
- Barra sólida encima = reprogramado (o real si está completa)
- Flechas SVG de dependencia entre barras
- Línea vertical "HOY"
- Fondo coloreado: feriado=rojo, fin de semana=gris, jornada parcial=amarillo
- Click en barra → selecciona la fila correspondiente en la tabla

**Capas toggleables:**
Botones para mostrar/ocultar: ● ESTIMADO · ● REPROGRAMADO · ● REAL

### 7.2 Panel lateral de detalle de operación

Al hacer click en una operación:
- Encabezado: SEQ, nombre, etapa, estado (chip de color)
- Comparación de fechas en 3 columnas: ESTIMADO / REPROGRAMADO / REAL
- Atributos: responsable, duración, avance actual, duración restante,
  dependencias, criterio de cierre
- Si tiene fecha_nmt: mostrar con motivo
- Historial de avances: fecha, usuario, valor, delta
- Botones: EDITAR OP (solo Planificador) · RESTRICCIÓN NMT

### 7.3 Acciones del Planificador

**Editar duración de una operación:**
```
1. Abrir modal con duración actual y campo para nueva duración
2. Mostrar advertencia con impacto calculado antes de confirmar:
   "Nueva fecha fin: XX/XX. Afecta N operaciones sucesoras."
3. Al confirmar:
   a. Actualizar duracion_hs en operaciones
   b. Registrar en historial_cambios_op (motivo obligatorio)
   c. Invalidar caché
   d. Ejecutar BFS de reprogramación
```

**Definir restricción NMT:**
```
1. Abrir modal con selector de operación y date picker
2. Motivo es OBLIGATORIO
3. Mostrar advertencia con impacto:
   "Esta restricción retrasa el inicio X días. Afecta N sucesoras."
4. Al confirmar:
   a. Actualizar fecha_nmt, fecha_nmt_motivo, fecha_nmt_creada_por
   b. Insertar en historial_nmt
   c. Invalidar caché
   d. Ejecutar BFS
5. Botón "Quitar restricción": pone fecha_nmt = NULL
   También requiere motivo y registra en historial_nmt
```

**Agregar operación manual:**
```
1. Modal con campos: etapa, secuencia, nombre, depende_de,
   desfase_inicio_hs, duracion_hs, unidad_avance, cantidad_meta,
   responsable, criterio_cierre, descripcion
2. Al guardar:
   a. Validar secuencia única
   b. Insertar en operaciones
   c. Crear registros en op_dependencias
   d. Calcular fechas estimadas para la nueva OP y sus sucesoras
   e. Invalidar caché y ejecutar BFS
```

---

## 8. FLUJO 5 — PANTALLA DE AVANCES (CAPATAZ)

### 8.1 Tabla de operaciones del Capataz

Muestra las operaciones activas del proyecto con:
- Tabla filtrable tipo Excel (filtro por columna con dropdown y texto)
- Columnas: SEQ · OPERACIÓN · ETAPA · RESP. · ESTADO · AVANCE · FIN REPROG. · ACCIÓN
- Sin columna Proyecto (ya está contextualizado por el Hub del proyecto)
- Ordenamiento por defecto: ATRASADAS primero, luego EN CURSO, luego PUEDE INICIAR
- Badge "▶ INICIAR" pegado al nombre de la OP si estado = PUEDE_INICIAR
  Al tocar el badge → popup de confirmación antes de iniciar
- Botón flotante rojo "⚠" para reportar NC en cualquier momento

**Estados visibles para el Capataz:**
- ATRASADA (rojo) — en curso y fecha_fin_reprog < hoy
- EN_CURSO (naranja) — tiene avances, no llegó al 100%
- PUEDE_INICIAR (teal) — PENDIENTE con todas las predecesoras COMPLETAS

### 8.2 Pantalla de avance de una operación (3 subventanas)

Al seleccionar una operación se abre la pantalla de avance.
Tiene TRES COLUMNAS siempre visibles simultáneamente (ver HTML de referencia):

**COLUMNA 1 — Instrucciones de trabajo:**
- Criterio de cierre en recuadro azul al tope
- Campo `descripcion` de la operación como texto libre
  (lo que el Planificador escribió en el Excel, una celda de texto)
- Si está vacío: mostrar "Sin instrucciones cargadas"
- NO es una lista numerada — es texto corrido

**COLUMNA 2 — Registrar Avance:**

Si estado = PUEDE_INICIAR:
  - Mostrar botón grande "▶ INICIAR ESTA OPERACIÓN"
  - Al tocar: popup de confirmación → al confirmar → cambiar a EN_CURSO

Si estado = EN_CURSO:
  - Si es el PRIMER avance: mostrar campo "Fecha de inicio real"
    con fecha de hoy por defecto, editable (máximo: hoy, mínimo: fecha_inicio_estimada)
  - Según unidad_avance mostrar el control correspondiente:
    PORCENTAJE → slider 0-100% con display grande del porcentaje
    CANTIDAD   → botones +/- con display del acumulado y la meta
    BINARIO    → botón grande "Completar" (requiere foto obligatoria)
  - Mostrar cálculo en tiempo real:
    Avance anterior: X%
    Nuevo avance: Y%
    Duración restante estimada: Z hs  ← informativo, no afecta reprogramación
  - Botón "✓ REGISTRAR AVANCE"
  - Debajo: historial de avances anteriores de esta operación
    (fecha, hora, usuario, valor registrado, delta +X%)

**COLUMNA 3 — Consumo de Materiales:**
- Tabla con los materiales del BOM de la operación
- Columnas: MATERIAL · TEÓRICO · HOY · TOTAL AC. · UNID.
  TOTAL AC. = suma de todos los consumos anteriores del día (de historial)
  Se colorea: teal=ok, amarillo=cerca del límite, rojo=excedido
- Campo de entrada de cantidad para cada material
- Botón "✓ CONFIRMAR CONSUMO" (independiente del avance)
- Debajo: historial de consumos del día para esta operación
  agrupados por hora con subtotales
- Al pie del historial: TOTAL ACUMULADO por material con recuadro teal
- El consumo se puede registrar sin haber registrado avance

### 8.3 Reportar No Conformidad

Disponible en cualquier momento desde:
- Botón flotante "⚠" en la tabla de operaciones
- Botón "⚠ Reportar NC" en la pantalla de avance de la OP

Modal con: tipo, severidad, foto (obligatoria), descripción,
operación asociada, fecha límite de respuesta.

---

## 9. FLUJO 6 — MOTOR DE REPROGRAMACIÓN AUTOMÁTICA

### 9.1 Cuándo se dispara

Al insertar un registro en `avance_registros`.

### 9.2 Qué hace el trigger AFTER INSERT en avance_registros

```sql
-- a. Si es primer avance: escribir fecha_inicio_real
UPDATE operaciones SET
    fecha_inicio_real = inserted.fecha_inicio_real_declarada,
    estado_id = (SELECT estado_id FROM estado_operacion WHERE codigo = 'EN_CURSO'),
    updated_at = SYSDATETIMEOFFSET()
WHERE operacion_id = inserted.operacion_id
  AND inserted.es_primer_avance = 1;

-- b. Si avance = 100%: escribir fecha_fin_real y marcar COMPLETA
UPDATE operaciones SET
    fecha_fin_real = inserted.fecha_registro,
    pct_avance_actual = 100,
    estado_id = (SELECT estado_id FROM estado_operacion WHERE codigo = 'COMPLETA'),
    updated_at = SYSDATETIMEOFFSET()
WHERE operacion_id = inserted.operacion_id
  AND inserted.pct_avance_nuevo = 100;

-- c. Actualizar pct_avance_actual y cantidad_acumulada
UPDATE operaciones SET
    pct_avance_actual = inserted.pct_avance_nuevo,
    cantidad_acumulada = cantidad_acumulada + ISNULL(inserted.cantidad_hoy, 0),
    updated_at = SYSDATETIMEOFFSET()
WHERE operacion_id = inserted.operacion_id
  AND inserted.pct_avance_nuevo < 100;

-- d. Invalidar caché
UPDATE cache_reprogramacion SET es_valido = 0
WHERE proyecto_id = inserted.proyecto_id;
```

El BFS de reprogramación se ejecuta desde la **capa de aplicación**
en el siguiente request del Gantt, no dentro del trigger.

### 9.3 Fórmula de fechas reprogramadas por estado

Las fechas reprogramadas NO se guardan en `operaciones`.
Se calculan en runtime y se almacenan en `cache_reprogramacion`.

```
SI COMPLETA:
    fecha_inicio_reprog = fecha_inicio_real
    fecha_fin_reprog    = fecha_fin_real
    → Dato real definitivo, no recalcular

SI EN_CURSO:
    fecha_inicio_reprog = fecha_inicio_real
    fecha_fin_reprog    = calcularFinLaboral(
                              fecha_inicio_real,
                              duracion_hs,     ← duración COMPLETA, sin proporcionar
                              calendario_id
                          )
    → La duración completa desde el inicio real
    → El % de avance NO afecta este cálculo

SI PENDIENTE:
    fin_predecesora     = COALESCE(fecha_fin_real, fecha_fin_estimada)
    fecha_inicio_reprog = MAX(fin_predecesora de TODAS sus predecesoras,
                              fecha_nmt)
    fecha_fin_reprog    = calcularFinLaboral(
                              fecha_inicio_reprog,
                              duracion_hs,
                              calendario_id
                          )
```

### 9.4 BFS de propagación en cascada

```
Entrada: operacion_id que cambió su fecha_fin_reprog

Cola BFS = [sucesoras directas de operacion_id]

Mientras la cola no esté vacía:
    op_actual = sacar de la cola

    SI op_actual.estado = COMPLETA o EN_CURSO → saltear, no propagar

    Calcular nueva fecha_inicio_reprog para op_actual:
        fin_pred = COALESCE(fecha_fin_real, fecha_fin_estimada)
        para cada predecesora de op_actual
        nueva_inicio = MAX(fin_pred de todas las predecesoras, fecha_nmt)

    SI nueva_inicio = fecha_inicio_reprog anterior en caché:
        → PODA: no cambió, cortar esta rama, no agregar sus sucesoras a la cola

    SI nueva_inicio cambió:
        nueva_fin = calcularFinLaboral(nueva_inicio, duracion_hs, calendario_id)
        Actualizar en cache_reprogramacion
        Agregar sucesoras directas de op_actual a la cola BFS
```

### 9.5 Tabla de caché

```sql
CREATE TABLE cache_reprogramacion (
    cache_id            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID()
                            CONSTRAINT PK_cache PRIMARY KEY,
    proyecto_id         UNIQUEIDENTIFIER NOT NULL
                            REFERENCES proyectos(proyecto_id),
    operacion_id        UNIQUEIDENTIFIER NOT NULL
                            REFERENCES operaciones(operacion_id),
    fecha_inicio_reprog DATE             NOT NULL,
    fecha_fin_reprog    DATE             NOT NULL,
    calculado_en        DATETIMEOFFSET   NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    es_valido           BIT              NOT NULL DEFAULT 1,
    UNIQUE (proyecto_id, operacion_id)
);
```

**Flujo de consulta:**
```
Request del Gantt para proyecto X
    ↓
¿Existe caché válida (es_valido = 1) para proyecto X?
    SÍ → devolver datos cacheados
    NO → ejecutar BFS completo desde todas las ops con fecha_fin_real
         → persistir en cache_reprogramacion con es_valido = 1
         → devolver resultados
```

---

## 10. ESTADOS DE OPERACIÓN

Los estados los calcula y escribe el sistema. El usuario nunca los toca.

```
PENDIENTE   → EN_CURSO  : primer avance registrado (trigger)
EN_CURSO    → COMPLETA  : pct_avance = 100 (trigger)
EN_CURSO    → ATRASADA  : fecha_fin_reprog < GETDATE() y pct < 100
                          (calculado en runtime, NO persiste)
PENDIENTE   → BLOQUEADA : fecha_inicio_reprog <= GETDATE() y
                          alguna predecesora no es COMPLETA
                          (calculado en runtime, NO persiste)
CUALQUIERA  → ARCHIVADA : OP eliminada en reimportación con avances existentes
                          (escrito al reimportar)
```

**Para el Gantt y la tabla APS:**
Al construir la respuesta, calcular ATRASADA y BLOQUEADA en runtime
combinando el estado persistido con las fechas reprogramadas del caché.

---

## 11. AVANCE DE ETAPAS

El avance de cada etapa se recalcula cada vez que cambia el avance
de alguna de sus operaciones:

```
pct_avance_etapa = Σ (pct_avance_op × peso_pct_op) / 100
                   para todas las ops no ARCHIVADAS de la etapa

estado_etapa:
  PENDIENTE → todas sus ops son PENDIENTE o BLOQUEADA
  EN_CURSO  → al menos 1 op es EN_CURSO o COMPLETA
  COMPLETA  → todas sus ops son COMPLETA
```

Se actualiza en la tabla `etapas` al procesar el trigger de avance.

---

## 12. REIMPORTACIÓN DEL BOP (nueva versión)

```
1. Detectar version_plan del nuevo Excel
   SI <= versión activa: advertir, requerir confirmación
   SI > versión activa: ofrecer guardar versión anterior en historial

2. Mostrar tabla de diferencias antes de confirmar:
   NUEVA / MODIFICADA / ARCHIVADA | SEQ | Operación | Campo | Valor anterior | Valor nuevo

3. Al confirmar:
   a. Crear nueva versión en versiones_plan, marcar anterior como inactiva
   b. Procesar operaciones (insertar nuevas, actualizar modificadas)
   c. Ops eliminadas con avances → archivada = TRUE
   d. Recalcular fechas ESTIMADAS solo para ops PENDIENTES
      (COMPLETAS y EN_CURSO conservan sus fechas reales)
   e. Invalidar caché completa del proyecto
   f. Ejecutar BFS de reprogramación

4. Las fechas_inicio_real y fecha_fin_real NUNCA se modifican
   por una reimportación
```

---

## 13. RESUMEN DE REGLAS DE NEGOCIO CRÍTICAS

```
RN-01: fecha_inicio_estimada y fecha_fin_estimada son INMUTABLES
       una vez calculadas al importar el BOP. Nunca sobreescribir.

RN-02: estado_id en operaciones lo escribe únicamente el sistema
       mediante trigger o motor. Nunca el usuario directamente.

RN-03: avance_registros es una tabla de solo INSERT. Nunca UPDATE ni DELETE.
       Las correcciones se agregan con es_correccion = TRUE.

RN-04: El BFS de reprogramación solo afecta operaciones PENDIENTES.
       Las EN_CURSO y COMPLETAS no se recalculan sus fechas de inicio.

RN-05: Si fecha_nmt no es NULL, fecha_nmt_motivo debe ser NOT NULL.
       Validar en capa de aplicación Y en constraint de BD.

RN-06: Una operación ARCHIVADA sigue visible en la tabla con badge
       diferenciado. Sus avances se conservan.

RN-07: El % de avance NO afecta el cálculo de fecha_fin_reprog.
       fecha_fin_reprog = calcularFinLaboral(fecha_inicio_real,
                                             duracion_hs_completa,
                                             calendario)

RN-08: Cuando el Planificador cambia duracion_hs debe registrar motivo
       en historial_cambios_op (obligatorio).

RN-09: La suma de peso_pct de las operaciones de una etapa debe = 100.
       Si no: normalizar automáticamente e informar.

RN-10: ATRASADA y BLOQUEADA son estados calculados en runtime.
       No se persisten en la tabla operaciones.

RN-11: Para el capataz, una OP con estado PENDIENTE solo aparece
       como PUEDE_INICIAR si TODAS sus predecesoras están COMPLETAS.

RN-12: El consumo de materiales puede registrarse sin avance asociado
       (avance_id nullable en consumo_materiales).

RN-13: La foto es obligatoria al registrar avance BINARIO con pct = 100.

RN-14: fecha_inicio_real la puede editar el Capataz solo en el momento
       del primer avance (campo editable en la pantalla).
       Después solo el Planificador puede modificarla.
```

---

## 14. ENDPOINTS SUGERIDOS

```
POST /api/proyectos/:id/bop/importar
     → Importar Excel BOP, validar, calcular fechas estimadas

GET  /api/proyectos/:id/programacion
     → Tabla APS + fechas reprogramadas del caché
     → Si caché inválida: ejecutar BFS antes de responder

GET  /api/proyectos/:id/gantt
     → Igual que programacion pero optimizado para renderizado del Gantt

POST /api/operaciones/:id/avance
     → Insertar en avance_registros
     → Trigger escribe fechas reales + invalida caché

POST /api/operaciones/:id/consumo
     → Insertar en consumo_materiales

PATCH /api/operaciones/:id/duracion
      → Actualizar duracion_hs + historial_cambios_op + BFS

PATCH /api/operaciones/:id/nmt
      → Actualizar fecha_nmt + historial_nmt + BFS

GET  /api/operaciones/:id/historial-avances
     → Lista de avance_registros de la operación

GET  /api/operaciones/:id/historial-consumos
     → Consumos del día agrupados con totales por material

POST /api/proyectos/:id/calendario
     → Guardar/actualizar calendario → recalcular fechas estimadas

POST /api/proyectos/:id/calendario/excepciones
     → Agregar excepción puntual → recalcular si hay BOP cargado
```

---

## 15. REFERENCIA VISUAL

Abrir ambos archivos en el navegador antes de implementar cualquier pantalla:

**/docs/prototipos/OBRA360_Programacion_v3.html**
Muestra: navegación Home → Hub → Programación, tabla APS completa con
las 3 líneas de fechas, Gantt dual con flechas de dependencia SVG,
panel lateral de detalle, modales de NMT y edición de duración.
Interactivo: los botones de capas funcionan, se puede arrastrar en el Gantt,
el panel lateral se abre al hacer click en una operación.

**/docs/prototipos/OBRA360_Avances_v5.html**
Muestra: Home Projects → System Tools → Hub con módulos por rol
(toggle con el avatar JR/CA para ver diferencia Planificador/Capataz),
tabla de operaciones con filtros tipo Excel, pantalla de avance con
las 3 subventanas simultáneas, historial de avances y consumos,
popup de confirmación para iniciar operación.
Interactivo: los filtros funcionan en tiempo real, el slider de avance
actualiza el historial, el consumo de materiales acumula totales.

Los tokens de color, tipografía y espaciado están definidos en las
variables CSS `:root` de los HTML. Usar como referencia para el frontend.

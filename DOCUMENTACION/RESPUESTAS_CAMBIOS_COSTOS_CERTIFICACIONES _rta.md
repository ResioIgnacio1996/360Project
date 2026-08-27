# Respuestas sobre cambios en Costos y Certificaciones

Fecha: 24/08/2026

Este documento responde los siete puntos planteados para la evolución del módulo **Costos y Certificaciones**. En esta instancia se documentan las decisiones propuestas; no se modifica el código hasta cerrar las definiciones pendientes indicadas al final.

---

## 1. Botón para cargar operaciones y costos mediante CSV

### Estado actual

Actualmente no existe un botón para importar costos mediante CSV.

Los valores económicos se cargan manualmente, operación por operación, desde la pantalla existente.

### Cambio solicitado

Agregar en la pestaña **Costos Operaciones** un botón:

```text
Importar costos CSV
```

### Funcionamiento propuesto

1. El usuario abre un proyecto.
2. Ingresa a **Costos Operaciones**.
3. Presiona **Importar costos CSV**.
4. Selecciona el archivo.
5. El sistema valida todas las filas.
6. Se muestra un preview de importación con:
   - Operación encontrada.
   - Precio cliente anterior y nuevo.
   - Costo responsable anterior y nuevo.
   - Motivo.
   - Errores detectados.
7. El usuario confirma la importación.
8. El servidor actualiza las operaciones y registra el historial económico.

### Formato propuesto

```csv
secuencia,precio_cliente,costo_responsable,motivo
100,15000,6000,Actualización de presupuesto
200,25000,12000,Carga inicial
```

### Identificación de operaciones

La operación se localizaría utilizando:

```text
proyecto seleccionado + plan activo + secuencia
```

La secuencia debe ser única dentro del plan activo del proyecto.

### Validaciones propuestas

- Archivo CSV obligatorio.
- Cabeceras reconocidas.
- Secuencia válida.
- Operación existente en el proyecto y plan activo.
- Operación no archivada.
- Precio cliente numérico y mayor o igual a cero.
- Costo responsable numérico y mayor o igual a cero.
- Motivo obligatorio si algún valor cambia.
- Motivo con un máximo de 500 caracteres.
- No permitir secuencias duplicadas dentro del mismo archivo.
- Informar filas inválidas antes de aplicar cambios.

### Integridad

La importación debería ser transaccional:

- Si todas las filas son válidas, se actualiza todo.
- Si una fila es inválida, no se aplica ninguna modificación.
- Cada campo modificado genera su registro correspondiente en `HistorialEconomiaOperacion`.

La importación CSV sería una posibilidad adicional. No reemplazaría la edición manual existente.

---

RTA :
 a ) En la carga de csv que no pregunte motivo, que los cambios manuales solicite la razon de cambio
b) que el csv sea como decis, que vincule  lo que carga el csv con las operaciones del proyecto por medio de la secuencia y que en el preview, se vea el nombre de la operacion con el que macheo de las operaciones.
c )Te agrego que en las columnas, ademas de la operacion, se vea en la etapa a la cual pertenece cada operacion.
d) la validacion del proyecto activo no se si hace falta ya que no se va a ver el proyecto en el menu y si no se ve no puede cargar el csv ni realizar nada y se evitan validaciones al pedo
e ) que el boton importar csv se encuentre en la misma sona que el de "Actualizar" en la ventana que se llama "Economia de Operaciones" o "Costo Operaciones" como te digo en el punto siguiente.
## 2. Cambio de nombre de “Economía de Operaciones”

Cambiar:

```text
Economía de Operaciones
```

por:

```text
Costos Operaciones
```

El cambio debería aplicarse en:

- Nombre de la pestaña.
- Encabezado de la pantalla.
- Textos auxiliares relacionados.
- Manual de usuario.
- Documentación funcional.

No requiere modificar nombres de tablas o endpoints internos.

---
RTA: a) SI

## 3. Cambio de nombre de la columna “Avance”

Cambiar el encabezado:

```text
Avance
```

por:

```text
Avance Operación
```

El objetivo es dejar claro que representa el avance físico o productivo registrado desde **Avance de Operaciones**.

No representa el porcentaje certificado al cliente.

---
RTA: a) SI

## 4. Cambio de nombre de “Nueva certificación”

Cambiar la pestaña:

```text
Nueva certificación
```

por:

```text
Certificación a Cliente
```

RTA: a) SI

### Alcance actual

La certificación utiliza exclusivamente:

```text
Operacion.precio_cliente
```

No utiliza `costo_responsable` para calcular el certificado al cliente.

### Alcance posterior

La certificación a contratistas se implementaría en una fase futura, con sus propias reglas, documentos y permisos.

No debe mezclarse automáticamente con el certificado al cliente actual.

---

RTA: a) SI, POR AHORA DEFINAMOS ESTO DEL CLIENTE Y DESPUES VAMOS CON EL DE LOS CONTRATISTAS

## 5. Operaciones incluidas según la fecha de corte

### Estado actual

Actualmente el preview incluye todas las operaciones vigentes del plan activo, incluso operaciones:

- Sin avance.
- Con avance cero.
- Con delta cero.
- Con precio cero.

Ese comportamiento responde a la regla original de la Fase 1, que solicitaba incluir todas las operaciones vigentes y conservar una fotografía completa.

### Nuevo comportamiento solicitado

En la metodología **Por fecha de corte**, mostrar solamente las operaciones que hayan ingresado dentro de la fecha seleccionada.

### Interpretación propuesta

Una operación ingresa en el corte cuando posee al menos un evento en `AvanceOperacion` con:

```text
fecha_registro <= fecha de corte
```

Para cada operación incluida se utiliza el último evento aplicable, ordenado por:

```text
fecha_registro DESC
fecha_creacion DESC
avance_id DESC
```

### Ejemplos

#### Operación con avance anterior a la fecha

```text
Fecha del avance: 10/08/2026
Fecha de corte: 21/08/2026
Resultado: incluida
```

#### Operación con avance posterior a la fecha

```text
Fecha del avance: 25/08/2026
Fecha de corte: 21/08/2026
Resultado: excluida
```

#### Operación sin eventos de avance

```text
Resultado propuesto: excluida
```

### Punto pendiente

Debe confirmarse qué ocurre cuando existe un evento de avance registrado cuyo porcentaje continúa en 0%.

Las alternativas son:

1. Incluirla porque tuvo un evento dentro del corte.
2. Excluirla porque todavía no posee avance físico positivo.

### Relación con certificados anteriores

Debe mantenerse la regla del delta:

```text
delta = porcentaje_actual - porcentaje_anterior
```

Una operación que ya fue certificada no debe volver a cobrar el porcentaje anterior.

Si una operación posee porcentaje certificado anterior, debe definirse si continúa apareciendo como línea informativa aunque no tenga un nuevo avance dentro del corte. La recomendación es incluirla únicamente si:

- Tiene un avance aplicable al corte; o
- Tiene un nuevo delta pendiente; o
- Es necesario mostrarla para explicar un porcentaje certificado anterior superior al avance físico reconstruido.

Este punto modifica la regla original que exigía incluir todas las operaciones vigentes, por lo que debe quedar aprobado expresamente.

---
RTA : a) es muy simple lo que te pedi, de la fecha de corte para atras teniendo en cuenta la fecha de planiicacion o estimada en caso de que no tenga de reprogramacion, de esa fecha de corte hacia atras, incluyendo la operacion u operaciones que queden en el medio de la fecha de corte, si la operacion tiene o no avance no importa si tiene avance cero se multiplicara el costo por 0, pero en la preview quiero que se vea eso de la fecha de corte "hacia atras" por asi decirlo. 

## 6. Metodología por corte de operación

### Estado actual

Actualmente solo está implementada la metodología:

```text
POR_FECHA
```

La metodología por operación ancla había quedado fuera del alcance inicial de la Fase 1.

### Cambio solicitado

Agregar una segunda metodología:

```text
POR_OPERACION
```

### Funcionamiento propuesto

1. El usuario abre **Certificación a Cliente**.
2. Selecciona la metodología **Por operación de corte**.
3. El sistema muestra las operaciones vigentes del plan activo.
4. El usuario selecciona una operación de corte.
5. El preview incluye:
   - La operación seleccionada.
   - Todas las operaciones anteriores.
6. Para cada operación se consulta el porcentaje certificado anteriormente.
7. Se calcula solamente el delta pendiente.
8. El usuario revisa, modifica justificadamente y emite.

### Interpretación propuesta de “operaciones anteriores”

Utilizar:

```text
operacion.secuencia <= secuencia de la operación seleccionada
```

Ejemplo:

```text
Operación elegida: secuencia 400

Incluidas:
100
200
300
400

Excluidas:
500 en adelante
```

### Regla del delta

La modalidad no vuelve a certificar lo ya emitido:

```text
porcentaje_anterior = último porcentaje certificado
porcentaje_sugerido = MAX(avance físico, porcentaje anterior)
delta = porcentaje actual - porcentaje anterior
importe = precio cliente vigente × delta ÷ 100
```

### Selector de metodología

La pantalla podría presentar:

```text
Metodología
[ Por fecha de corte ▼ ]
```

Opciones:

```text
Por fecha de corte
Por operación de corte
```

Cuando se selecciona **Por fecha de corte**, se muestra el selector de fecha.

Cuando se selecciona **Por operación de corte**, se muestra el selector de operación.

### Datos que debería conservar el certificado

La cabecera ya posee `metodo_corte`. Para la nueva modalidad sería necesario guardar también la operación utilizada como corte, por ejemplo:

```text
operacion_corte_id BIGINT NULL
```

La cabecera debería cumplir:

- `POR_FECHA`: fecha de certificación obligatoria y operación de corte nula.
- `POR_OPERACION`: operación de corte obligatoria.

Debe definirse si la modalidad por operación también lleva una fecha documental de certificación. La recomendación es que sí, porque todo certificado necesita una fecha de emisión/certificación aunque su selección se realice mediante operación ancla.

---

## 7. Cómo se almacenan actualmente los costos

Sí, la tabla `Operacion` fue ampliada para almacenar los dos valores económicos.

Campos agregados:

```sql
precio_cliente DECIMAL(19,4) NOT NULL DEFAULT 0
costo_responsable DECIMAL(19,4) NOT NULL DEFAULT 0
economia_actualizada_por BIGINT NULL
economia_actualizada_en DATETIME2(0) NULL
economia_row_version ROWVERSION
```

### Precio cliente

Representa el valor total que se cobrará al cliente cuando la operación alcance el 100% certificado.

Se utiliza en **Certificación a Cliente**.

### Costo responsable

Representa el valor total reconocido al responsable o contratista de la operación.

Actualmente se almacena y audita, pero no se utiliza para generar certificados a contratistas.

### Formas de carga

#### Existente

Carga manual individual:

1. Abrir la operación.
2. Modificar precio cliente y/o costo responsable.
3. Informar el motivo.
4. Guardar.
5. Registrar historial.

#### Solicitada

Carga masiva mediante CSV:

```text
Carga manual individual
+
Carga masiva CSV
```

Ambas posibilidades deben permanecer disponibles.

---

## 8. Resumen de cambios solicitados

| Punto | Cambio | Estado actual | Definición propuesta |
|---|---|---|---|
| 1 | Importar costos CSV | No implementado | Botón, preview, validación y actualización transaccional |
| 2 | Renombrar pestaña | Economía de Operaciones | Costos Operaciones |
| 3 | Renombrar columna | Avance | Avance Operación |
| 4 | Renombrar certificación | Nueva certificación | Certificación a Cliente |
| 5 | Filtrar operaciones por fecha | Incluye todas las vigentes | Incluir operaciones con eventos de avance aplicables al corte |
| 6 | Corte por operación | No implementado | Selección de operación y secuencias anteriores con cálculo por delta |
| 7 | Almacenamiento de costos | Campos existentes y carga manual | Mantener carga manual y agregar CSV |

---

## 9. Definiciones pendientes antes de implementar

### Pregunta 1

En certificación por fecha, ¿una operación con un evento registrado pero con avance igual a 0% debe aparecer?

Opciones:

- Sí, porque tuvo actividad registrada dentro del corte.
- No, solamente deben aparecer operaciones con avance físico mayor a 0%.

RTA - Lo respondi arriba, la fecha de corte y certificacion no tiene que ver con la fecha en la que se registro avance, si no con la de estimacion o reprogramacion, se dicel a fecha de corte y se toman las operaciones dentro de esa fecha de corte y hacia atras

### Pregunta 2

En la metodología por operación, ¿se confirma que “operaciones anteriores” significa:

```text
secuencia menor o igual a la operación elegida dentro de todo el proyecto y plan activo
RTA - SI
```

### Pregunta 3

¿Se confirma el formato CSV?

```csv
secuencia,precio_cliente,costo_responsable,motivo
RTA - RESPUESTA ARRIBA, EL MOTIVO NO VA SOLAMENTE EN LA MODIFICACION MANUAL
```

### Pregunta 4 recomendada

En la metodología por operación, ¿el certificado debe conservar también una fecha documental seleccionada por el usuario?

La recomendación es mantenerla obligatoria.
RTA - SI 
### Pregunta 5 recomendada

En el filtro por fecha, ¿una operación previamente certificada debe continuar apareciendo cuando no tiene un nuevo avance dentro del corte?

La recomendación es mostrarla solamente si existe un delta pendiente o si resulta necesaria para explicar el acumulado anterior.

SI MUESTRAN TODAS LAS OPERACIONES HACIA ATRAS DE LA FECHA DE CORTE, SI EL DELTA DA 0 (OSEA QUE YA SE CERTIFICO AL 100) MARCALAS CON ALGUN COLOR O DIFERENCIALAS DE AQUELLAS QUE EL DELTA ES MAYOR A 0 Y ESTARIAN ENTRANDO EN EL PRECIO DE LA CERTIFICACION
---

## 10. Impacto de alcance

Los puntos 1, 5 y 6 amplían el alcance inicial:

- La importación CSV estaba fuera de la Fase 1 original.
- La Fase 1 original indicaba incluir todas las operaciones vigentes, incluso con avance cero.
- La operación ancla o corte por operación estaba fuera del alcance original.

La solicitud actual puede considerarse una ampliación funcional posterior de Costos y Certificaciones. Conviene versionarla como un nuevo incremento para conservar trazabilidad y evitar confundirla con las reglas ya probadas de la Fase 1.


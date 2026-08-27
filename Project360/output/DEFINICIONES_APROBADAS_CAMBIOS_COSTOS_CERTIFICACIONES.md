# Definiciones aprobadas para cambios en Costos y Certificaciones

Fecha: 24/08/2026

Este documento consolida las respuestas recibidas para la evolución del módulo **Costos y Certificaciones**. En esta instancia se documentan las reglas; no se modifica código de la aplicación.

---

## 1. Importación de costos mediante CSV

Se agregará un botón:

```text
Importar costos CSV
```

El botón se ubicará en la misma zona que el botón **Actualizar**, dentro de la pestaña **Costos Operaciones**.

### Formato del archivo

```csv
secuencia,precio_cliente,costo_responsable
100,15000,6000
200,25000,12000
```

### Reglas

- El CSV no solicitará motivo.
- El motivo continuará siendo obligatorio únicamente para modificaciones manuales.
- Para conservar la auditoría, los cambios provenientes del archivo podrán registrarse automáticamente con un motivo técnico como:

```text
Importación CSV
```

- La vinculación se realizará por:

```text
proyecto seleccionado + plan activo + secuencia
```

- El CSV no reemplaza la edición manual existente.
- Ambas modalidades deben permanecer disponibles:
  - Carga manual por operación.
  - Carga masiva mediante CSV.

### Preview de importación

Antes de confirmar, se deberá mostrar:

- Secuencia informada.
- Nombre de la operación encontrada.
- Etapa a la que pertenece la operación.
- Precio cliente anterior.
- Precio cliente nuevo.
- Costo responsable anterior.
- Costo responsable nuevo.
- Estado de validación.
- Errores detectados.

### Validaciones

- Archivo obligatorio.
- Cabeceras válidas.
- Secuencia numérica y válida.
- Operación existente dentro del proyecto y plan activo.
- Operación no archivada.
- Precio cliente numérico y mayor o igual a cero.
- Costo responsable numérico y mayor o igual a cero.
- Secuencia no duplicada dentro del archivo.
- Todas las filas deben validarse antes de confirmar.

### Integridad

La importación debe ser transaccional:

- Si todas las filas son válidas, se aplican todos los cambios.
- Si una fila es inválida, no se modifica ninguna operación.
- Cada valor modificado debe generar su registro de auditoría en `HistorialEconomiaOperacion`.

---

## 2. Cambio de nombre de “Economía de Operaciones”

Cambiar:

```text
Economía de Operaciones
```

por:

```text
Costos Operaciones
```

Aplicar el cambio en:

- Nombre de la pestaña.
- Encabezado de pantalla.
- Textos auxiliares.
- Manual de usuario.
- Documentación funcional.

No es necesario cambiar nombres internos de tablas o endpoints.

---

## 3. Cambio de nombre de la columna “Avance”

Cambiar:

```text
Avance
```

por:

```text
Avance Operación
```

Este valor representa el avance físico o productivo registrado desde **Avance de Operaciones**.

No representa el porcentaje certificado al cliente.

---

## 4. Cambio de nombre de la certificación

Cambiar la pestaña:

```text
Nueva certificación
```

por:

```text
Certificación a Cliente
```

### Alcance

Por ahora, la certificación utiliza exclusivamente:

```text
Operacion.precio_cliente
```

El `costo_responsable` se almacena y audita, pero todavía no genera certificados a contratistas.

La certificación a contratistas se definirá e implementará posteriormente como un circuito separado.

---

## 5. Metodología por fecha de corte

La fecha de corte no debe filtrar por la fecha en la que se registró el avance físico.

Debe utilizar las fechas provenientes de Programación.

### Fecha aplicable

Se utilizará:

1. Fecha reprogramada, cuando exista.
2. Fecha estimada, cuando no exista fecha reprogramada.

Conceptualmente:

```text
fecha_inicio_efectiva =
  fecha_inicio_reprogramada
  o, si no existe,
  fecha_inicio_estimada
```

### Regla de inclusión

Se incluyen las operaciones cuya fecha de inicio efectiva sea menor o igual a la fecha de corte.

```text
fecha_inicio_efectiva <= fecha_corte
```

También se incluye una operación que se encuentre en ejecución o atraviese la fecha seleccionada.

Ejemplo:

```text
Inicio: 10/08/2026
Fin:    30/08/2026
Corte:  21/08/2026
Resultado: incluida
```

### Avance físico

El avance físico no determina si la operación aparece o no.

Por lo tanto:

- Una operación con avance positivo puede aparecer.
- Una operación con avance cero también debe aparecer si está incluida por las fechas de Programación.
- Si el porcentaje aplicable es cero, el cálculo económico correspondiente será cero.

### Regla del delta

Debe mantenerse:

```text
porcentaje_anterior = último porcentaje certificado
delta = porcentaje_actual - porcentaje_anterior
importe = precio_cliente_vigente × delta ÷ 100
```

Una operación previamente certificada no vuelve a cobrar el porcentaje anterior.

---

## 6. Metodología por corte de operación

Se agregará una segunda metodología:

```text
POR_OPERACION
```

### Funcionamiento

1. El usuario abre **Certificación a Cliente**.
2. Selecciona **Por operación de corte**.
3. Elige una operación del plan activo.
4. El preview incluye la operación seleccionada y todas las anteriores.
5. Para cada operación se consulta el porcentaje certificado anteriormente.
6. Se calcula exclusivamente el delta pendiente.
7. El usuario revisa y emite.

### Regla de selección

Se confirma:

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

### Fecha documental

La metodología por operación también debe conservar una fecha documental obligatoria.

La selección de operaciones se realiza mediante la operación de corte, pero el certificado mantiene su fecha de certificación.

### Datos de cabecera

La cabecera deberá distinguir:

```text
metodo_corte = POR_FECHA
metodo_corte = POR_OPERACION
```

Para `POR_OPERACION` será necesario conservar la operación seleccionada, por ejemplo:

```text
operacion_corte_id BIGINT NULL
```

---

## 7. Visualización de operaciones según el delta

Todas las operaciones incluidas por la fecha u operación de corte deben mostrarse en el preview.

Se deben diferenciar visualmente:

### Operaciones con delta mayor a cero

```text
delta > 0
```

- Generan un nuevo importe.
- Entran económicamente en el certificado actual.
- Deben resaltarse como operaciones a certificar.

### Operaciones con delta igual a cero

```text
delta = 0
```

- No generan un importe nuevo.
- Pueden estar completamente certificadas o no tener porcentaje nuevo.
- Deben mostrarse con otro color, estilo o etiqueta.

Etiqueta sugerida:

```text
SIN DELTA
```

El total del certificado solamente se incrementa con operaciones cuyo delta e importe generen un valor nuevo.

---

## 8. Almacenamiento actual de costos

La tabla `Operacion` ya posee:

```sql
precio_cliente DECIMAL(19,4) NOT NULL DEFAULT 0
costo_responsable DECIMAL(19,4) NOT NULL DEFAULT 0
economia_actualizada_por BIGINT NULL
economia_actualizada_en DATETIME2(0) NULL
economia_row_version ROWVERSION
```

### Precio cliente

Es el valor total utilizado para **Certificación a Cliente**.

### Costo responsable

Es el valor total reconocido al responsable o contratista.

En esta etapa se carga y audita, pero no genera todavía certificados a contratistas.

---

## 9. Validación de proyecto activo

Aunque un proyecto inactivo no aparezca en el menú, se recomienda conservar la validación en backend.

Motivos:

- Un usuario podría ingresar directamente mediante una URL guardada.
- Un cliente externo podría llamar el endpoint sin utilizar el menú.
- El estado puede cambiar mientras una pantalla permanece abierta.
- Evita emitir documentos para proyectos que dejaron de estar activos.

La validación no afecta la experiencia normal y protege la integridad del certificado.

---

## 10. Consideración técnica sobre fechas reprogramadas

Antes de implementar el filtro por fecha debe revisarse cómo obtiene Programación las fechas reprogramadas.

Si la fecha reprogramada se calcula dinámicamente en lugar de almacenarse directamente en `Operacion`, Costos debe reutilizar exactamente el mismo cálculo.

No deben existir dos algoritmos diferentes para determinar la fecha reprogramada.

Objetivo:

```text
La fecha reprogramada mostrada en Programación
debe ser la misma utilizada por Certificación a Cliente.
```

---

## 11. Resumen final

| Punto | Definición aprobada |
|---|---|
| CSV | `secuencia,precio_cliente,costo_responsable`, sin motivo solicitado |
| Auditoría CSV | Motivo automático de importación |
| Matching CSV | Proyecto + plan activo + secuencia |
| Preview CSV | Mostrar operación y etapa encontradas |
| Ubicación del botón | Junto a Actualizar |
| Nombre de pestaña económica | Costos Operaciones |
| Columna de avance | Avance Operación |
| Nombre de certificación | Certificación a Cliente |
| Certificación actual | Solamente cliente |
| Corte por fecha | Según fecha reprogramada o estimada de Programación |
| Avance cero | Se muestra si la operación entra por fecha |
| Corte por operación | Secuencia menor o igual a la seleccionada |
| Fecha documental por operación | Obligatoria |
| Delta cero | Se muestra diferenciado visualmente |
| Contratistas | Fase posterior |


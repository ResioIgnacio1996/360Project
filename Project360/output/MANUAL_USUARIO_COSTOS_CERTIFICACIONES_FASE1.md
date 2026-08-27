# Manual de usuario

## Costos y Certificaciones - Fase 1

Este manual explica cómo usar el módulo **Costos y Certificaciones** de OBRA360 para:

- Cargar el precio que se cobra al cliente por cada operación.
- Registrar el costo reconocido al responsable de la operación.
- Importar ambos valores en forma masiva desde un archivo CSV validado previamente.
- Consultar quién modificó esos valores y por qué.
- Preparar una certificación a cliente por fecha de corte o por operación de corte.
- Ajustar justificadamente el porcentaje que se certificará.
- Emitir certificados sin cobrar dos veces el mismo porcentaje.
- Consultar certificados emitidos y sus valores históricos.

---

## 1. Conceptos importantes

### Avance físico

Es el porcentaje ejecutado informado desde **Avance de Operaciones**. Representa lo que realmente se realizó en la obra.

### Porcentaje certificado

Es el porcentaje acumulado reconocido económicamente al cliente. Puede ser igual o diferente del avance físico.

Modificar el porcentaje certificado no cambia el avance físico registrado por el Capataz.

### Precio cliente

Es el importe total que se cobrará al cliente cuando la operación alcance el 100% certificado.

### Costo responsable

Es el valor total reconocido para quien ejecuta la operación. En esta fase se registra y audita, pero todavía no genera certificados ni pagos a contratistas.

### Delta

Es la parte nueva que se certifica en el período:

```text
Delta = porcentaje acumulado actual - porcentaje acumulado anterior
```

El importe del período se calcula así:

```text
Importe = precio cliente vigente × delta ÷ 100
```

### Ejemplo

Una operación tiene un precio cliente de 10.000:

1. El primer certificado llega al 40%.
2. El importe es 4.000.
3. El siguiente certificado lleva el acumulado al 70%.
4. El nuevo delta es 30%, no 70%.
5. El importe del segundo período es 3.000.

De esta manera, el sistema evita cobrar dos veces el 40% ya certificado.

---

## 2. Requisitos para ingresar

Para utilizar el módulo se necesita:

1. Iniciar sesión en OBRA360.
2. Tener acceso al proyecto correspondiente.
3. Que el proyecto esté activo y no eliminado.
4. Que el proyecto tenga un cliente asociado.
5. Contar con los permisos correspondientes.

Los permisos disponibles son:

| Permiso | Habilita |
|---|---|
| `COSTOS_VER` | Ingresar y consultar la economía de las operaciones |
| `ECONOMIA_OPERACION_EDITAR` | Modificar precio cliente y costo responsable |
| `CERTIFICADO_CLIENTE_PREVIEW` | Generar previews por fecha o por operación |
| `CERTIFICADO_CLIENTE_EMITIR` | Confirmar y emitir certificados |
| `CERTIFICADO_CLIENTE_VER` | Consultar certificados emitidos |
| `CERTIFICADO_CLIENTE_ELIMINAR` | Eliminar de forma lógica y auditada el último certificado emitido |

Si una opción no aparece o el sistema informa que falta un permiso, se debe solicitar al administrador que revise el rol del usuario.

---

## 3. Cómo entrar al módulo

1. Ingresar a OBRA360.
2. Abrir la sección **Proyectos**.
3. Seleccionar el proyecto con el que se trabajará.
4. En **Módulos del proyecto**, seleccionar **Costos y Certificaciones**.

En la parte superior se muestra:

- Nombre del proyecto.
- Cliente asociado.
- Estado del proyecto.
- Botón **Actualizar**.

El módulo tiene tres secciones:

1. **Costos Operaciones**.
2. **Certificación a Cliente**.
3. **Certificados emitidos**.

Las opciones visibles dependen de los permisos del usuario.

---

## 4. Costos Operaciones

Esta pantalla muestra las operaciones vigentes del plan activo.

Para cada operación se informa:

- Secuencia.
- Etapa.
- Nombre de la operación.
- Responsable operativo.
- Avance Operación: avance físico/productivo, no porcentaje certificado.
- Precio cliente.
- Costo responsable.
- Estado de certificación.

Una operación puede tener responsable vacío y valores económicos iguales a cero.

### 4.1. Cargar o modificar valores económicos

1. Abrir **Economía de operaciones**.
2. Buscar la operación correspondiente.
3. Presionar el ícono de edición ubicado a la derecha.
4. Completar o modificar:
   - **Precio cliente**.
   - **Costo responsable**.
5. Escribir el **motivo del cambio**.
6. Presionar **Guardar y auditar**.

Los importes:

- Pueden ser cero.
- No pueden ser negativos.
- Se muestran con un decimal en pantalla.
- Se conservan con cuatro decimales en la base de datos.

Si ningún valor fue modificado, el sistema informa que no hubo cambios.

### 4.2. Motivo obligatorio

Cada vez que cambia el precio cliente o el costo responsable, debe escribirse un motivo.

Ejemplos válidos:

- “Actualización acordada con el cliente”.
- “Revisión de presupuesto aprobada”.
- “Corrección de valor cargado inicialmente”.

No conviene usar motivos ambiguos como “cambio”, “ajuste” o “corrección” sin explicar la razón.

### 4.3. Consultar el historial económico

Al abrir la edición de una operación, la parte inferior muestra su historial.

Cada registro informa:

- Campo modificado.
- Valor anterior.
- Valor nuevo.
- Motivo.
- Usuario responsable.
- Fecha y hora.

El historial no puede borrarse desde el módulo.

### 4.4. Operaciones ya certificadas

La etiqueta **CERTIFICADA** indica que la operación ya aparece en al menos un certificado emitido.

Después de certificar una operación:

- El precio cliente puede cambiar para deltas futuros.
- El costo responsable puede seguir actualizándose con auditoría.
- Los certificados anteriores no cambian.
- No se puede reemplazar el responsable de esa misma operación.

Si el trabajo restante debe asignarse a otro responsable, se debe crear una nueva operación siguiendo la regla de negocio definida.

### 4.5. Importar costos desde CSV

El botón **Cargar CSV** está junto a **Actualizar** y aparece a quienes poseen el permiso de edición económica.

El archivo debe tener exactamente estas cabeceras y este orden:

```csv
secuencia,precio_cliente,costo_responsable
100,15000,6000
200,25000.50,12000
```

También se admite punto y coma como separador; en ese caso puede utilizarse coma decimal:

```csv
secuencia;precio_cliente;costo_responsable
100;15000,50;6000
```

Pasos:

1. Abrir **Costos Operaciones**.
2. Presionar **Cargar CSV**.
3. Elegir el archivo `.csv`.
4. Revisar la vista previa: muestra secuencia, etapa, operación encontrada, valores anteriores, valores nuevos y errores.
5. Si figura alguna fila con error, cerrar la ventana, corregir el archivo y volver a cargarlo.
6. Si todas las filas son válidas, presionar **Confirmar importación**.
7. Verificar el mensaje con la cantidad de operaciones actualizadas.

La operación se identifica por proyecto seleccionado, plan activo y secuencia. No se solicita un motivo manual: cada campo realmente modificado queda auditado automáticamente con el motivo **Importación CSV**.

Los valores del CSV **reemplazan** los valores anteriores: no se suman ni se concatenan. La vista previa compara expresamente **valor anterior** contra **valor nuevo**. Como protección adicional, si un valor nuevo supera más de 100 veces un valor anterior distinto de cero, la fila se rechaza por posible error de separadores o concatenación. En ese caso no se importa ninguna fila; se debe corregir el CSV y volver a generar la vista previa.

La carga es indivisible. Si una sola fila tiene una secuencia inválida, está repetida, no pertenece al plan activo o contiene un valor incorrecto, no se actualiza ninguna operación.

---

## 5. Preparar una certificación a cliente

### 5.1. Certificar por fecha de corte

1. Abrir la pestaña **Certificación a Cliente**.
2. En **Metodología**, elegir **Por fecha de corte**.
3. Seleccionar la **fecha del certificado**.
4. Presionar **Generar preview**.

El sistema reutiliza las mismas fechas calculadas por Programación. Toma la fecha de inicio reprogramada cuando corresponde y, si no existe, la fecha de inicio estimada.

El sistema:

- Incluye solamente operaciones cuyo inicio vigente sea anterior o igual a la fecha seleccionada.
- Incluye una operación que comenzó antes y continúa ejecutándose en la fecha seleccionada.
- Incluye operaciones con avance cero cuando ingresan por su fecha de Programación.
- Excluye operaciones archivadas.
- No proyecta avances futuros.
- No guarda ningún dato al generar el preview.

No se permite seleccionar una fecha anterior al último certificado emitido del proyecto.

### 5.2. Certificar por corte de operación

1. Abrir **Certificación a Cliente**.
2. En **Metodología**, elegir **Por corte de operación**.
3. Seleccionar la operación que funcionará como límite.
4. Informar la fecha documental del certificado.
5. Presionar **Generar preview**.

El preview incluye la operación elegida y todas las del plan activo cuya secuencia sea menor o igual. Las posteriores quedan fuera. La fecha sigue siendo obligatoria para fechar el documento y determinar el avance físico de referencia, pero no decide qué operaciones se incluyen.

### 5.3. Información del preview

El preview muestra, para cada operación:

| Columna | Significado |
|---|---|
| Avance referencia | Avance físico registrado hasta la fecha elegida |
| Anterior | Último porcentaje acumulado efectivamente certificado |
| % a certificar | Nuevo porcentaje acumulado que se desea reconocer |
| Diferencia | Distancia entre la decisión económica y el avance físico |
| Delta | Porcentaje nuevo del período |
| Precio | Precio cliente vigente |
| Importe | Precio vigente multiplicado por el delta |

El porcentaje sugerido inicialmente es el avance físico de referencia, respetando el porcentaje ya certificado.

Todas las operaciones incluidas se muestran. Las filas **A CERTIFICAR** tienen delta positivo y generan un importe nuevo. Las filas **SIN DELTA** permanecen visibles, pero no incrementan el total.

### 5.4. Revisar las líneas

Antes de emitir, revisar especialmente:

- Que el avance de referencia corresponda a la fecha seleccionada.
- Que el porcentaje anterior sea correcto.
- Que el porcentaje a certificar represente el acuerdo comercial.
- Que el precio cliente esté actualizado.
- Que el delta y el importe sean coherentes.

El cálculo que aparece en la pantalla es informativo. Al emitir, el servidor vuelve a consultar y calcular todos los valores.

---

## 6. Modificar manualmente un porcentaje

El porcentaje a certificar puede ser diferente del avance físico.

### Caso 1: certificar menos que el avance

Ejemplo:

- Avance físico: 55%.
- Porcentaje anterior: 0%.
- Porcentaje acordado con el cliente: 50%.

Pasos:

1. Cambiar **% a certificar** de 55 a 50.
2. Revisar que la diferencia muestre -5%.
3. Escribir el motivo, por ejemplo: “Porcentaje acordado en reunión de obra”.

### Caso 2: certificar más que el avance

Puede reconocerse un porcentaje superior al avance físico si existe un acuerdo comercial.

Ejemplo:

- Avance físico: 0%.
- Porcentaje a certificar: 20%.
- Motivo: “Anticipo comercial acordado con el cliente”.

### Validaciones

El porcentaje:

- No puede ser negativo.
- No puede ser menor al último porcentaje certificado.
- No puede superar el 100%.
- Requiere motivo cuando difiere del avance físico.

Cambiar el porcentaje económico nunca modifica el avance físico.

---

## 7. Emitir el certificado

Después de revisar todas las líneas:

1. Completar **Observaciones** si corresponde.
2. Revisar el **Total del período**.
3. Presionar **Emitir certificado**.
4. Esperar la confirmación del sistema.

Las observaciones son opcionales y admiten hasta 1.000 caracteres.

### Qué hace el sistema al emitir

El servidor vuelve a verificar:

- Proyecto activo y con cliente.
- Operaciones vigentes.
- Avance físico a la fecha.
- Precio cliente vigente.
- Último porcentaje certificado.
- Porcentajes ingresados.
- Motivos obligatorios.
- Fecha cronológicamente válida.

Luego recalcula:

- Porcentaje anterior.
- Delta.
- Importe de cada línea.
- Total completo.

Finalmente guarda la cabecera y todos los detalles en una sola operación.

Si se produce un error, no queda un certificado incompleto.

### Preview desactualizado

Entre la generación del preview y la emisión puede ocurrir que otra persona:

- Registre o modifique un avance.
- Cambie el precio cliente.
- Emita otro certificado.

En ese caso, el sistema rechaza la emisión e informa que el preview quedó desactualizado.

Para continuar:

1. Leer el mensaje mostrado.
2. Volver a presionar **Generar preview**.
3. Revisar nuevamente todas las líneas.
4. Volver a emitir.

El sistema no acomoda silenciosamente los valores porque eso podría cambiar el documento económico que el usuario estaba confirmando.

### Certificado con delta cero

No puede emitirse un certificado cuando todas las operaciones tienen delta cero.

Sí puede emitirse un certificado cuyo importe total sea cero si existe un delta positivo en una operación con precio cliente igual a cero.

---

## 8. Consultar certificados emitidos

1. Abrir **Certificados emitidos**.
2. Buscar el certificado por número o fecha.
3. Seleccionar la tarjeta correspondiente.

El listado muestra:

- Identificador provisional.
- Fecha de certificación.
- Total.
- Usuario emisor.
- Estado.
- Metodología de corte.
- Operación límite, cuando el método fue por operación.

El detalle muestra por operación:

- Secuencia aplicada.
- Nombre de la operación.
- Avance físico de referencia.
- Porcentaje anterior.
- Porcentaje actual certificado.
- Delta.
- Precio cliente aplicado.
- Importe emitido.

Los valores son una fotografía histórica. Aunque posteriormente cambie el precio o la operación, el certificado conserva los importes con los que fue emitido.

### 8.1. Eliminar el último certificado

La eliminación está disponible únicamente para usuarios con el permiso correspondiente y solamente sobre el último certificado emitido del proyecto.

Pasos:

1. Abrir **Certificados emitidos**.
2. Seleccionar el último certificado.
3. Presionar **Eliminar certificado**.
4. Leer la advertencia.
5. Escribir un motivo claro y obligatorio.
6. Presionar **Confirmar eliminación**.

El certificado desaparece del historial vigente, pero su cabecera, detalles, usuario eliminador, fecha y motivo se conservan internamente para auditoría.

Los deltas futuros se recalculan desde el último certificado que permanezca emitido. Por ejemplo, si existen los certificados 1, 2 y 3 y se elimina el 3, el siguiente preview toma como porcentaje anterior el acumulado del certificado 2.

No se puede eliminar un certificado intermedio. Para eliminar el 2 cuando existe el 3, primero debe eliminarse el 3 y después el 2. Esta secuencia evita conservar documentos posteriores construidos sobre un acumulado que dejó de existir.

---

## 9. Cambio de precio después de certificar

Ejemplo:

1. Precio cliente inicial: 1.000.
2. Primer certificado: acumulado 40%.
3. Importe del primer período: 400.
4. Se actualiza el precio cliente a 1.500 con motivo auditado.
5. El siguiente certificado lleva el acumulado al 70%.
6. El delta nuevo es 30%.
7. El importe del segundo período es 450.

El primer certificado sigue mostrando 400. El precio nuevo solamente se aplica al delta futuro.

---

## 10. Mensajes frecuentes

### “El proyecto debe estar activo”

El proyecto está pausado, finalizado, cancelado, inactivo o eliminado. No puede certificarse hasta que su estado permita operar.

### “El proyecto no tiene un cliente asociado”

Debe asignarse el cliente desde la edición del proyecto.

### “No posee el permiso...”

El rol del usuario no tiene habilitada la acción solicitada. Debe intervenir un administrador.

### “El motivo es obligatorio”

Se intentó cambiar un valor económico o un porcentaje sin explicar la razón.

### “El porcentaje debe estar entre el anterior y 100”

El porcentaje ingresado es menor al ya certificado o supera el máximo permitido.

### “La fecha no puede ser anterior al último certificado”

Debe seleccionarse la misma fecha del último certificado o una posterior.

### “El preview quedó desactualizado”

Cambió el avance, el precio, el certificado anterior o el conjunto de operaciones. Se debe regenerar el preview.

### “No se puede emitir un certificado con delta total cero”

Ninguna operación agrega un porcentaje nuevo respecto del último certificado.

### “No se puede cambiar el responsable de una operación certificada”

La operación ya forma parte de un documento emitido. Debe conservarse su responsable histórico y crear una nueva operación para el trabajo restante si corresponde.

### “Solo puede eliminarse el último certificado emitido”

Existe al menos un certificado posterior. Deben eliminarse en orden inverso, comenzando por el más reciente.

### “El motivo de eliminación es obligatorio”

La baja de un documento económico siempre debe quedar justificada. Escriba el motivo y vuelva a confirmar.

### “Las cabeceras deben ser exactamente...”

El CSV no tiene las tres columnas requeridas o están en otro orden. Debe comenzar con `secuencia,precio_cliente,costo_responsable`.

### “El CSV contiene errores”

Al menos una fila es inválida. La vista previa indica el problema concreto. No se modificó ninguna operación; corrija el archivo completo y vuelva a cargarlo.

### “La operación de corte no pertenece al plan activo”

La operación fue archivada, cambió la versión activa o ya no pertenece al proyecto. Actualice la pantalla y seleccione nuevamente el corte.

---

## 11. Recomendaciones de operación

- Actualizar los precios antes de generar el preview.
- Revisar siempre la vista previa del CSV antes de confirmar.
- Verificar que los avances estén correctamente registrados para la fecha de corte.
- Confirmar que la metodología elegida sea la correspondiente: por fecha o por operación.
- Escribir motivos claros y específicos.
- Revisar el total y las líneas antes de emitir.
- Regenerar el preview si transcurrió mucho tiempo o trabajaron otros usuarios.
- Consultar el certificado emitido inmediatamente después de confirmarlo.
- No usar el porcentaje certificado para corregir errores de avance físico.
- No considerar el costo responsable como una orden de pago: esa funcionalidad está fuera de esta fase.

---

## 12. Funcionalidades no incluidas en esta fase

Esta versión no incluye:

- Certificados a contratistas.
- Pagos o cobranzas.
- Numeración comercial.
- Borradores.
- Firma o aceptación del cliente.
- Adjuntos.
- Generación de PDF firmado.
- Impuestos o conversiones de moneda.
- Rentabilidad o margen.
- Plan financiero.
- Curva S.
- Integración automática con materiales, compras o stock.

Estas funciones requieren una definición funcional posterior.

---

## 13. Resumen del circuito recomendado

```text
1. Registrar el avance físico desde Avance de Operaciones
                         ↓
2. Revisar precio cliente y costo responsable
                         ↓
3. Elegir corte por fecha o por operación y generar el preview
                         ↓
4. Revisar avance, anterior, delta, precio e importe
                         ↓
5. Ajustar porcentajes y justificar diferencias
                         ↓
6. Emitir el certificado
                         ↓
7. Consultar y verificar el documento histórico
```

La idea principal es mantener separadas dos realidades:

- **Avance físico:** lo que se ejecutó en la obra.
- **Certificación económica:** lo que se reconoció y valorizó para el cliente.

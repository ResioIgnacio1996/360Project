# Resolución - tachito de certificados y reemplazo CSV

Fecha: 24/08/2026

## Resultado

Se agregó un botón circular con ícono de papelera directamente sobre la tarjeta del último certificado emitido. Al presionarlo se abre la confirmación auditada sin necesidad de entrar primero al detalle.

La regla de negocio se mantiene: solamente puede eliminarse el último certificado emitido y el usuario debe poseer el permiso `CERTIFICADO_CLIENTE_ELIMINAR`. Los certificados anteriores no muestran la papelera porque eliminarlos fuera de orden rompería la cadena histórica de deltas.

## Diagnóstico de la importación informada

La auditoría de IRE001 mostró que el servidor recibió y guardó los números grandes como valores nuevos completos. Por ejemplo:

| Secuencia | Campo | Anterior | Valor recibido |
|---:|---|---:|---:|
| 100 | precio cliente | 15.000 | 150.010.000 |
| 100 | costo responsable | 6.000 | 60.010.000 |
| 200 | precio cliente | 20.000 | 200.010.000 |
| 200 | costo responsable | 10.000 | 100.010.000 |

El `UPDATE` del importador no suma ni concatena: asigna directamente `precio_cliente=@precio` y `costo_responsable=@costo`. Por lo tanto, el problema no era una suma realizada por SQL sino que esos importes deformados ya llegaron en el contenido procesado.

## Corrección implementada

- Se mantiene el reemplazo directo de ambos valores.
- La ventana de importación ahora informa explícitamente que el CSV reemplaza y no suma ni concatena.
- La vista previa bloquea valores que superen más de 100 veces un valor anterior distinto de cero.
- El mensaje de error indica revisar separadores o una posible concatenación.
- La importación continúa siendo transaccional: si una fila falla, ninguna operación se modifica.
- Se agregaron pruebas específicas de reemplazo exacto y de bloqueo de concatenación accidental.

La protección de 100 veces no se aplica cuando el valor anterior es cero, porque una primera carga puede tener cualquier importe válido y no existe una base económica para calcular una proporción.

## Estado de datos observado al finalizar

No se sobrescribieron valores económicos por inferencia. Durante el trabajo se observó que el usuario continuó operando IRE001 y corrigió varios importes. En la lectura final, la secuencia 200 todavía conserva `costo_responsable = 100010000`, mientras que el resto ya presenta otros valores. Para corregir esa operación debe cargarse el importe efectivamente deseado mediante edición manual con motivo o mediante un CSV correcto; el sistema no puede deducir responsablemente ese importe.

También se observó que los certificados 1, 2 y 3 quedaron en estado `ELIMINADO` y existe un certificado 4 `EMITIDO`. Estas acciones no fueron realizadas por esta corrección.

## Pruebas ejecutadas

- Backend: 30 de 30 pruebas aprobadas.
- Componente Angular de costos: 5 de 5 pruebas aprobadas.
- Build de Angular: correcto.
- Se corrigió durante testing una diferencia de accesibilidad en la etiqueta de la papelera, que ahora identifica el certificado como `#número`.

El build conserva advertencias preexistentes de presupuesto de tamaño del bundle y de hojas de estilo de Programación y Avance de Operaciones; no impiden la compilación y no fueron causadas por esta modificación.

## Archivos principales modificados

- `360Front/src/app/features/costos/costos-certificaciones.html`
- `360Front/src/app/features/costos/costos-certificaciones.ts`
- `360Front/src/app/features/costos/costos-certificaciones.cards.css`
- `360Front/src/app/features/costos/costos-certificaciones.spec.ts`
- `srv/services/ImportacionCostos.service.js`
- `srv/tests/reglas-costos.test.js`
- `output/MANUAL_USUARIO_COSTOS_CERTIFICACIONES_FASE1.md`

## Desvíos

No se aplicó una corrección masiva automática a la base porque el reporte permite identificar los valores incorrectos, pero no define el importe correcto que se desea para cada operación. Inventar esos datos habría sido un desvío de la regla económica y una modificación riesgosa.

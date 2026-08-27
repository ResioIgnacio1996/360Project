# Entrega: Certificados a Contratistas y Responsables

## Alcance implementado

Se agregó una cadena de certificación independiente por proyecto y responsable. Cada certificado utiliza el `costo_responsable` vigente de la operación y calcula únicamente el delta pendiente respecto del último certificado emitido de ese mismo responsable.

La planificación de certificados existente continúa siendo exclusivamente del cliente. No se agregaron fechas ni números planificados para responsables.

## Flujo funcional

1. Ingresar a **Costos y Certificaciones**.
2. Abrir **Certificación a Contratista**.
3. Seleccionar un responsable o cuadrilla.
4. Elegir corte por fecha o por operación.
5. Generar el preview temporal.
6. Revisar avance físico, porcentaje anterior, porcentaje actual, delta, costo e importe.
7. Si se modifica el porcentaje sugerido, informar un motivo obligatorio.
8. Emitir el certificado.
9. Consultarlo en **Certificados Contratistas**.
10. Registrar egresos desde **Ingresos y Egresos**, vinculándolos al certificado.

## Reglas aplicadas

- El preview incluye solamente operaciones del responsable seleccionado.
- El importe es `costo_responsable × delta / 100`.
- Cada responsable mantiene su propia cronología y acumulado.
- El porcentaje no puede retroceder respecto del certificado anterior.
- Una modificación manual requiere motivo.
- Un preview queda obsoleto si cambia el avance, costo, responsable o certificado anterior.
- No se emiten certificados con delta total cero.
- Solamente puede eliminarse el último certificado vigente de cada responsable.
- No puede eliminarse un certificado con egresos activos asociados.
- Al eliminar el último certificado, el próximo delta parte del anterior vigente.
- Un egreso no puede superar el saldo pendiente del certificado.
- Los pagos muestran estado `PENDIENTE`, `PAGADO_PARCIAL` o `PAGADO`.
- No puede cambiarse el responsable de una operación que tenga certificaciones vigentes.

## Base de datos

Se agregaron:

- `CertificadoResponsable`.
- `CertificadoResponsableDetalle`.
- Clave foránea desde `MovimientoFinancieroProyecto.certificado_responsable_id`.
- Índices para certificados, detalles y pagos.
- Permisos de preview, emisión, consulta y eliminación.
- Ampliación del trigger que protege el responsable de operaciones certificadas.

Migración idempotente: `srv/DB/migrations/20260825_certificados_responsable.sql`.

## API

- `POST /api/certificados-responsable/proyectos/:proyectoId/preview`
- `POST /api/certificados-responsable/proyectos/:proyectoId`
- `GET /api/certificados-responsable/proyectos/:proyectoId`
- `GET /api/certificados-responsable/proyectos/:proyectoId/:certificadoId`
- `DELETE /api/certificados-responsable/proyectos/:proyectoId/:certificadoId`
- Los movimientos financieros permiten `EGRESO` con vínculo `CERTIFICADO_RESPONSABLE`.

## Prueba integral realizada

Proyecto: **TEST1**, ID 7.

Responsable: **Cuadrilla A - Oficial y ayudante**, ID 1.

- Certificado #1: parcial, total 1.636,2500.
- Certificado #2: segundo delta, total 1.636,2500; eliminado durante la prueba.
- Certificado #3: delta recuperado y reemitido, total 1.636,2500; vigente.
- Pago parcial vigente: 409,0625.
- Saldo vigente: 1.227,1875.
- Estado: `PAGADO_PARCIAL`.
- Detalle: 7 operaciones y 3 etapas.

Se comprobó:

- Separación correcta por responsable.
- Certificación parcial con motivo.
- Segundo certificado solamente por delta.
- Rechazo de eliminación de un certificado intermedio.
- Rechazo de sobrepago.
- Rechazo de eliminación con pago activo.
- Anulación de pago.
- Eliminación lógica del último certificado.
- Recuperación exacta del delta desde el certificado anterior.
- Reemisión del delta recuperado.
- Asociación y visualización del pago parcial.
- Estado, saldo y pagos en cards y detalle.

## Resultados automáticos

- Backend: **44/44 pruebas aprobadas**.
- Frontend: **9/9 pruebas aprobadas**.
- API autenticada: respuestas 200 para permisos, economía, preview, listado, detalle y finanzas.
- API protegida: 401 sin token, 422 para sobrepago y 409 para eliminar con pago.
- Migración aplicada dos veces correctamente.
- Build Angular aprobado.
- Navegador: pestañas, selectores, cards, detalle, etapas y egreso vinculado verificados.
- Consola del navegador: sin errores.

El build conserva advertencias anteriores de presupuesto del bundle y de CSS de Programación/Avance; no impiden la compilación y no fueron originadas por este módulo.

## Desvío respecto de la propuesta

No se agregó cronograma planificado para contratistas. El cronograma actual permanece asociado a la certificación del cliente porque esa decisión había quedado pendiente. Todo el flujo real de certificación y pagos a responsables sí quedó implementado.

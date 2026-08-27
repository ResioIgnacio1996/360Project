# Pendientes de cierre - Costos y Certificaciones Fase 1

Fecha de revisión: 26/08/2026

## Estado general

El núcleo funcional acordado para la primera etapa está implementado. Lo pendiente corresponde principalmente al cierre visual, validación final y actualización de la documentación consolidada.

## Pendientes para cerrar la primera etapa

1. Restablecer y verificar el acceso a la aplicación local en `http://localhost:4200`.
2. Validar visualmente en **Costos Operaciones**:
   - Scroll horizontal.
   - Scroll vertical.
   - Encabezado fijo.
   - Redimensionamiento con el mouse de todas las columnas.
   - Persistencia de los anchos elegidos por el usuario.
3. Ejecutar las pruebas de aceptación posteriores a los últimos cambios del importador BOP y de la grilla de costos.
4. Consolidar el manual de usuario y el documento para el modelador incluyendo todas las ampliaciones realizadas después de la entrega inicial.

## Funcionalidades implementadas

- Carga y edición manual de precio cliente y costo responsable.
- Importación CSV con reemplazo de valores y auditoría.
- Soporte CSV para delimitadores `,` y `;`.
- Lectura UTF-8 y compatibilidad con Windows-1252.
- Cronograma planificado del cliente por operación.
- Número de certificado planificado.
- Agrupación de operaciones por etapas.
- Costo, avance físico y avance certificado por etapa.
- Certificación al cliente por fecha de corte.
- Certificación al cliente por corte de operación.
- Cálculo económico exclusivamente por delta.
- Eliminación lógica y ordenada de certificados.
- Recuperación del delta desde el último certificado vigente.
- Estado de cobranza del certificado al cliente.
- Ingresos manuales libres o vinculados a certificados del cliente.
- Egresos libres o vinculados a OC, factura o certificado a responsable.
- Certificación independiente por contratista o responsable.
- Estado de pago y egresos asociados a certificados de responsables.
- Eliminación controlada del último certificado de cada responsable.

## Funcionalidades postergadas por decisión

Estas funciones no constituyen errores pendientes de la primera etapa. Se reservaron para una evolución posterior:

- Cronograma planificado para contratistas.
- Vista comparativa específica entre certificación planificada y real.
- Curva S y análisis gráfico de desvíos.
- Numeración comercial configurable de certificados.
- Borradores de certificados.
- Firma o aceptación del cliente.
- Adjuntos.
- Generación de PDF firmado.
- Impuestos y conversión de moneda.
- Rentabilidad y margen.
- Plan financiero completo.
- Integración automática con materiales, compras y stock.

## Conclusión

Para declarar cerrada la primera etapa no hace falta incorporar las funciones postergadas. Es necesario restablecer el entorno local, validar la última corrección visual de la tabla, ejecutar la aceptación final y actualizar la documentación consolidada.

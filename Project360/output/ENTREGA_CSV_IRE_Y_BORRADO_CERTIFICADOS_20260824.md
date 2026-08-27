# Entrega - CSV de IRE y eliminación de certificados

Fecha: 24/08/2026

## 1. CSV generado para IRE

Proyecto encontrado:

```text
proyecto_id: 8
nombre: IRE001
estado: ACTIVO
```

Archivo generado:

```text
output/COSTOS_OPERACIONES_IRE001_20260824.csv
```

El archivo contiene las 19 operaciones no archivadas del plan activo y las cabeceras acordadas:

```csv
secuencia,precio_cliente,costo_responsable
```

Valores no nulos actuales:

| Secuencia | Precio cliente | Costo responsable |
|---:|---:|---:|
| 100 | 15.000 | 6.000 |
| 200 | 20.000 | 10.000 |
| 300 | 10.000 | 20.000 |
| 400 | 20.000 | 10.000 |

Las secuencias 500 a 1900 tienen ambos valores en cero, tal como se encuentran actualmente en la base.

El archivo fue procesado por el mismo importador de la aplicación: 19 filas válidas, 0 errores y 0 diferencias respecto de los valores actuales.

## 2. Certificados encontrados en IRE

Antes y después de las pruebas continúan vigentes:

| Certificado | Fecha | Método | Total | Estado |
|---:|---|---|---:|---|
| 1 | 21/08/2026 | POR_FECHA | 2.000 | EMITIDO |
| 2 | 25/08/2026 | POR_FECHA | 12.000 | EMITIDO |
| 3 | 27/08/2026 | POR_FECHA | 8.000 | EMITIDO |

No se eliminó realmente ninguno de estos documentos.

## 3. Eliminación implementada

Se agregó la opción **Eliminar certificado** en el detalle del último certificado emitido.

La eliminación es lógica y auditada:

- El certificado pasa de `EMITIDO` a `ELIMINADO`.
- Desaparece del listado vigente.
- Sus detalles no se destruyen.
- Se registra usuario, fecha y motivo obligatorio.
- Los cálculos de certificados ignoran los documentos eliminados.

## 4. Regla de la cadena de deltas

Solo se puede eliminar el último certificado emitido.

Con la cadena actual de IRE:

```text
#1 -> #2 -> #3
```

Si se elimina el certificado 3:

```text
#1 -> #2
```

El siguiente preview consulta los porcentajes acumulados del certificado 2 y calcula desde allí el nuevo delta.

Si se quisiera eliminar el certificado 2, primero debe eliminarse el 3. Esta regla impide dejar un certificado posterior basado en un acumulado intermedio eliminado.

## 5. Base de datos

Se agregaron a `CertificadoCliente`:

```sql
eliminado_por BIGINT NULL
fecha_eliminacion DATETIME2(0) NULL
motivo_eliminacion NVARCHAR(500) NULL
```

También se incorporaron:

- Estado `ELIMINADO`.
- Clave foránea del usuario eliminador.
- Restricción de consistencia de los datos de eliminación.
- Permiso `CERTIFICADO_CLIENTE_ELIMINAR`.

El usuario `IRE` pertenece al rol `ADMIN` y se verificó que recibió este permiso, por lo que verá la opción en pantalla después de volver a iniciar sesión o renovar sus permisos.

La migración idempotente fue aplicada y verificada correctamente.

## 6. API

Endpoint:

```text
DELETE /api/certificados-cliente/proyectos/:proyectoId/:certificadoId
```

Cuerpo:

```json
{
  "motivo": "Motivo obligatorio de la eliminación"
}
```

Respuestas protegidas:

- 404 si el certificado no existe o no pertenece al proyecto.
- 409 si no es el último certificado emitido.
- 409 si ya no se encuentra emitido.
- 422 si falta el motivo o supera 500 caracteres.

## 7. Interfaz

En **Certificados emitidos**:

1. Se abre el detalle.
2. Si es el último certificado y el usuario tiene permiso, aparece **Eliminar certificado**.
3. Se abre una confirmación específica.
4. Se exige motivo.
5. Al confirmar se actualizan historial, badges económicos y cualquier preview abierto.
6. El mensaje final informa desde qué certificado partirán los próximos deltas.

Los certificados anteriores muestran una aclaración y no ofrecen el botón destructivo.

## 8. Pruebas

- Backend: 28/28 pruebas aprobadas.
- Frontend: 4/4 pruebas del componente aprobadas.
- Build Angular: correcto.
- Esquema y permisos: verificados.
- API sin certificado: responde 404.
- Intento de borrar certificado intermedio: rechazado con 409.
- Caso IRE ejecutado en transacción con rollback:
  - Certificado marcado temporalmente: 3.
  - Certificado anterior detectado para los deltas: 2.
  - Todas las operaciones volvieron a referenciar el certificado 2.
  - Rollback completado.
  - Estado final del certificado 3: `EMITIDO`.

## 9. Desvíos

No se desvió la regla solicitada para el ejemplo 3 -> 2.

Se aplicó una protección adicional: el sistema no permite borrar certificados intermedios fuera de orden. Esto mantiene coherente la historia acumulada y evita recalcular silenciosamente certificados ya emitidos.

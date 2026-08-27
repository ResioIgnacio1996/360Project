require('dotenv').config();
const {conectarDB}=require('../DB/dbConection');
(async()=>{const pool=await conectarDB();const r=await pool.request().query(`
SELECT CASE WHEN COL_LENGTH('Operacion','precio_cliente') IS NOT NULL AND COL_LENGTH('Operacion','costo_responsable') IS NOT NULL THEN 1 ELSE 0 END columnas_operacion;
SELECT CASE WHEN COL_LENGTH('CertificadoCliente','operacion_corte_id') IS NOT NULL AND
  COL_LENGTH('CertificadoCliente','eliminado_por') IS NOT NULL AND
  COL_LENGTH('CertificadoCliente','fecha_eliminacion') IS NOT NULL AND
  COL_LENGTH('CertificadoCliente','motivo_eliminacion') IS NOT NULL THEN 1 ELSE 0 END columnas_certificado;
SELECT name FROM sys.tables WHERE name IN('HistorialEconomiaOperacion','CertificadoCliente','CertificadoClienteDetalle') ORDER BY name;
SELECT codigo FROM Accion WHERE codigo IN('COSTOS_VER','ECONOMIA_OPERACION_EDITAR','CERTIFICADO_CLIENTE_PREVIEW','CERTIFICADO_CLIENTE_EMITIR','CERTIFICADO_CLIENTE_VER','CERTIFICADO_CLIENTE_ELIMINAR') ORDER BY codigo;
SELECT name FROM sys.indexes WHERE name IN('IX_Operacion_proyecto_archivada','IX_AvanceOperacion_operacion_fecha','IX_Certificado_proyecto_fecha','IX_CertificadoDetalle_operacion','IX_HistorialEconomia_operacion_fecha') ORDER BY name;
SELECT name FROM sys.triggers WHERE name='TR_Operacion_bloquear_responsable_certificado';
SELECT name FROM sys.check_constraints WHERE name IN('CK_Certificado_metodo','CK_Certificado_operacion_corte','CK_Certificado_estado','CK_Certificado_eliminacion') ORDER BY name;`);
const ok=r.recordsets[0][0].columnas_operacion===1&&r.recordsets[1][0].columnas_certificado===1&&
  r.recordsets[2].length===3&&r.recordsets[3].length===6&&r.recordsets[4].length===5&&
  r.recordsets[5].length===1&&r.recordsets[6].length===4;
console.log(JSON.stringify({ok,resultados:r.recordsets},null,2));await pool.close();if(!ok)process.exitCode=1;})().catch(e=>{console.error(e);process.exitCode=1;});

require('dotenv').config();
const fs=require('fs');const path=require('path');const {conectarDB}=require('../DB/dbConection');
(async()=>{const pool=await conectarDB();const sql=fs.readFileSync(path.join(__dirname,'../DB/migrations/20260821_costos_certificaciones_fase1.sql'),'utf8');await pool.request().batch(sql);console.log('Migracion Costos Fase 1 aplicada correctamente');await pool.close();})().catch(e=>{console.error(e);process.exitCode=1;});

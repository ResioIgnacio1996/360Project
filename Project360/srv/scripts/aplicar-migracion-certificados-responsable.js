require('dotenv').config();
const fs=require('fs');
const path=require('path');
const {conectarDB}=require('../DB/dbConection');
(async()=>{const pool=await conectarDB();try{await pool.request().batch(fs.readFileSync(path.join(__dirname,'../DB/migrations/20260825_certificados_responsable.sql'),'utf8'));console.log('Migracion de certificados a responsable aplicada correctamente');}finally{await pool.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

require('dotenv').config();
const { conectarDB, cerrarDB } = require('../DB/dbConection');
const { evaluarAlarmas } = require('../services/AlarmasEvaluador.service');

(async()=>{try{const pool=await conectarDB();const resultado=await evaluarAlarmas(pool);console.log(JSON.stringify(resultado));}catch(error){console.error(error);process.exitCode=1;}finally{await cerrarDB();}})();

const sql = require('mssql');

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  }
};

if (process.env.DB_PORT) {
  dbConfig.port = Number(process.env.DB_PORT);
}

async function conectarDB() {
  try {
    const pool = await sql.connect(dbConfig);
    return pool;
  } catch (error) {
    console.error('Error conectando a SQL Server:', error);
    throw error;
  }
}

module.exports = {
  conectarDB,
  sql,
  dbConfig
};
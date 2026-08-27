const sql = require('mssql');

const enteroEnv = (nombre, valorPorDefecto, minimo, maximo) => {
  const valor = Number(process.env[nombre]);
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) return valorPorDefecto;
  return valor;
};

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
  },
  pool: {
    min: enteroEnv('DB_POOL_MIN', 0, 0, 100),
    max: enteroEnv('DB_POOL_MAX', 10, 1, 100),
    idleTimeoutMillis: enteroEnv('DB_POOL_IDLE_TIMEOUT_MS', 30000, 1000, 3600000)
  },
  connectionTimeout: enteroEnv('DB_CONNECTION_TIMEOUT_MS', 15000, 1000, 300000),
  requestTimeout: enteroEnv('DB_REQUEST_TIMEOUT_MS', 30000, 1000, 3600000)
};

if (dbConfig.pool.min > dbConfig.pool.max) dbConfig.pool.min = dbConfig.pool.max;

if (process.env.DB_PORT) {
  dbConfig.port = Number(process.env.DB_PORT);
}

let pool;
let conexionPendiente;

async function conectarDB() {
  if (pool?.connected) return pool;
  if (conexionPendiente) return conexionPendiente;

  pool = new sql.ConnectionPool(dbConfig);
  pool.on('error', error => {
    console.error('Error del pool de SQL Server:', error.message);
  });

  conexionPendiente = pool.connect();
  try {
    return await conexionPendiente;
  } catch (error) {
    pool = undefined;
    console.error('Error conectando a SQL Server:', error.message);
    throw error;
  } finally {
    conexionPendiente = undefined;
  }
}

async function cerrarDB() {
  const poolActual = pool;
  pool = undefined;
  conexionPendiente = undefined;
  if (poolActual) await poolActual.close();
}

module.exports = {
  conectarDB,
  cerrarDB,
  sql,
  dbConfig,
  enteroEnv
};

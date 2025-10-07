require("dotenv").config();
// Debug log for Railway environment troubleshooting
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'MISSING');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DATABASE_URL:', process.env.DATABASE_URL);
const mysql = require("mysql2/promise");

// Support Railway DATABASE_URL
const connectionString = process.env.DATABASE_URL;

// Validate environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0 && !connectionString) {
  console.error(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create a connection pool
const pool = connectionString
  ? mysql.createPool({ uri: connectionString, waitForConnections: true, connectionLimit: 10, queueLimit: 0, charset: 'utf8mb4_unicode_ci', connectTimeout: 10000, multipleStatements: true })
  : mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4_unicode_ci',
      connectTimeout: 10000,
      multipleStatements: true
    });

// Log connection success
pool.getConnection()
  .then(conn => {
    console.log(`✅ Connected to MySQL database '${process.env.DB_NAME || 'Railway'}' as id ${conn.threadId || 'unknown'} on ${process.env.DB_HOST || 'Railway'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Initial DB connection failed:', err.message, err.stack);
  });

// Error handling for pool
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err.message, err.stack);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.error('Attempting to reconnect...');
  } else if (err.code === 'ER_CON_COUNT_ERROR') {
    console.error('Too many connections, consider increasing connectionLimit');
  }
});

// Export pool with explicit query method
module.exports = {
  query: async (sql, params) => {
    let conn;
    try {
      conn = await pool.getConnection();
      const [results, fields] = await conn.query(sql, params);
      return [results, fields];
    } catch (err) {
      console.error('❌ Query error:', {
        sql: sql.slice(0, 100) + (sql.length > 100 ? '...' : ''),
        params,
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      throw err;
    } finally {
      if (conn) conn.release();
    }
  },
  pool
};

require("dotenv").config();
const mysql = require("mysql2/promise");

// Validate environment variables
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci', // Ensure JSON and special characters are handled correctly
  connectTimeout: 10000,
  multipleStatements: true // Support multiple statements for complex queries
});

// Log connection success
pool.getConnection()
  .then(conn => {
    console.log(`✅ Connected to MySQL database '${process.env.DB_NAME}' as id ${conn.threadId || 'unknown'} on ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
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
    // Pool will automatically attempt to reconnect
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
      return [results, fields]; // Return both results and fields to match server.js expectations
    } catch (err) {
      console.error('❌ Query error:', {
        sql: sql.slice(0, 100) + (sql.length > 100 ? '...' : ''), // Log first 100 chars of query
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
require("dotenv").config();
const mysql = require("mysql2/promise");

// Connection settings come from environment variables:
//   local: put them in .env
//   Render: add them under Environment Variables
const requiredEnvVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);
if (missingEnvVars.length > 0) {
  console.error(`❌ Missing environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

// Aiven (and most hosted MySQL) requires SSL. Set DB_SSL=true there.
// Leave it unset for a local MySQL on your laptop.
const useSSL = process.env.DB_SSL === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4_unicode_ci",
  connectTimeout: 10000,
});

// Log connection status (never logs the password)
pool
  .getConnection()
  .then((conn) => {
    console.log(`✅ Connected to MySQL database '${process.env.DB_NAME}' on ${process.env.DB_HOST} (SSL: ${useSSL ? "on" : "off"})`);
    conn.release();
  })
  .catch((err) => {
    console.error("❌ Initial DB connection failed:", err.message);
  });

pool.on("error", (err) => {
  console.error("❌ Database pool error:", err.message);
});

module.exports = {
  query: async (sql, params) => {
    let conn;
    try {
      conn = await pool.getConnection();
      const [results, fields] = await conn.query(sql, params);
      return [results, fields];
    } catch (err) {
      console.error("❌ Query error:", {
        sql: sql.slice(0, 100) + (sql.length > 100 ? "..." : ""),
        message: err.message,
        code: err.code,
      });
      throw err;
    } finally {
      if (conn) conn.release();
    }
  },
  pool,
};
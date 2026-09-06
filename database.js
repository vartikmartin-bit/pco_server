require("dotenv").config();

console.log("=================================");
console.log("🗄️ PostgreSQL inicializácia");
console.log("DATABASE_URL existuje:", !!process.env.DATABASE_URL);
console.log("=================================");

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function testConnection() {
  console.log("🔄 Testujem pripojenie k PostgreSQL...");

  try {
    const client = await pool.connect();

    console.log("✅ PostgreSQL PRIPOJENÉ");

    const result = await client.query("SELECT NOW()");

    console.log("🕒 Čas databázy:", result.rows[0].now);

    client.release();

  } catch (err) {

    console.error("❌ PostgreSQL CHYBA");
    console.error(err);

  }
}

module.exports = {
  pool,
  testConnection,
};
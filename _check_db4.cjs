const { Pool } = require('pg');

async function main() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    const client = await pool.connect();
    console.log("CONNECTED SUCCESSFULLY");
    const result = await client.query("SELECT NOW() as time");
    console.log("SERVER TIME:", result.rows[0].time);
    client.release();
    await pool.end();
  } catch(e) {
    console.error("CONNECTION ERROR TYPE:", e.constructor.name);
    console.error("CONNECTION ERROR MESSAGE:", e.message);
    console.error("CONNECTION ERROR CODE:", e.code);
  }
}
main();

const { Pool } = require('pg');

async function main() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000 });
    const client = await pool.connect();
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log("TABLES:", JSON.stringify(tablesResult.rows));
    
    // Check count on all relevant tables
    for (const row of tablesResult.rows) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as cnt FROM "${row.table_name}"`);
        console.log(`COUNT ${row.table_name}:`, countResult.rows[0].cnt);
      } catch(e) {
        console.log(`COUNT ${row.table_name}: ERROR -`, e.message.substring(0, 100));
      }
    }
    
    client.release();
    await pool.end();
  } catch(e) {
    console.error("CONNECTION ERROR:", e.message.substring(0, 500));
  }
}
main();

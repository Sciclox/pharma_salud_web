import 'dotenv/config';
import pkg from 'pg';
const { Client } = pkg;
const c = new Client(process.env.DIRECT_DATABASE_URL);
await c.connect();
const r = await c.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '_ProductoCategoriaManyToMany' ORDER BY ordinal_position");
console.table(r.rows);
await c.end();

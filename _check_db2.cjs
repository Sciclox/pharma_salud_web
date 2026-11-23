const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    
    const productoCount = await prisma.producto.count();
    console.log(JSON.stringify({ productoCount, success: true }));
    
    await prisma.$disconnect();
    await pool.end();
  } catch(e) {
    console.error(JSON.stringify({ error: e.message, stack: e.stack?.substring(0, 500), success: false }));
  }
}
main();

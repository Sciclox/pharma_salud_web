const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

async function main() {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    
    const [productos, inventarios, sucursales, usuarios, categorias, laboratorios] = await Promise.all([
      prisma.producto.count(),
      prisma.inventarioSucursal.count(),
      prisma.sucursal.count(),
      prisma.usuario.count(),
      prisma.categoria.count(),
      prisma.laboratorio.count(),
    ]);
    
    console.log(JSON.stringify({
      productos,
      inventarios,
      sucursales,
      usuarios,
      categorias,
      laboratorios,
      success: true
    }));
    
    await prisma.$disconnect();
    await pool.end();
  } catch(e) {
    console.error(JSON.stringify({ error: e.message, success: false }));
  }
}
main();

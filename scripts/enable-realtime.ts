import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Activando Supabase Realtime para las tablas...");

  const sql = `
    do $$
    begin
      -- Crear la publicación supabase_realtime si por alguna razón no existiera
      if not exists (
        select 1 from pg_publication where pubname = 'supabase_realtime'
      ) then
        create publication supabase_realtime;
      end if;

      -- Habilitar inventario_sucursal
      if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and schemaname = 'public' 
        and tablename = 'inventario_sucursal'
      ) then
        alter publication supabase_realtime add table inventario_sucursal;
      end if;

      -- Habilitar registro_de_ventas
      if not exists (
        select 1 from pg_publication_tables 
        where pubname = 'supabase_realtime' 
        and schemaname = 'public' 
        and tablename = 'registro_de_ventas'
      ) then
        alter publication supabase_realtime add table registro_de_ventas;
      end if;
    end;
    $$;
  `;

  try {
    await prisma.$executeRawUnsafe(sql);
    console.log("Supabase Realtime activado correctamente para 'inventario_sucursal' y 'registro_de_ventas'.");
  } catch (error) {
    console.error("Error al configurar realtime en Postgres:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();

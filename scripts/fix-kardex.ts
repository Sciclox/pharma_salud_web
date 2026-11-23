import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Cargar el adaptador necesario para la base de datos
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando corrección de registros de transferencias antiguas en Kardex...");

  // 1. Corregir salidas antiguas
  const salidasAntiguas = await prisma.kardex.findMany({
    where: {
      tipoMovimiento: {
        in: ["SALIDA_TRANSFERENCIA", "SALIDA TRANSFERENCIA"]
      }
    }
  });

  console.log(`Encontrados ${salidasAntiguas.length} registros de salidas para revisar.`);
  
  for (const s of salidasAntiguas) {
    const nuevaCantidad = s.cantidad > 0 ? -s.cantidad : s.cantidad;
    await prisma.kardex.update({
      where: { id: s.id },
      data: {
        tipoMovimiento: "SALIDA TRANSFERENCIA",
        cantidad: nuevaCantidad
      }
    });
    console.log(`-> Registro ID #${s.id} actualizado: tipo: "SALIDA TRANSFERENCIA", cantidad: ${nuevaCantidad}`);
  }

  // 2. Corregir entradas antiguas
  const entradasAntiguas = await prisma.kardex.findMany({
    where: {
      tipoMovimiento: {
        in: ["INGRESO_TRANSFERENCIA", "INGRESO TRANSFERENCIA"]
      }
    }
  });

  console.log(`Encontrados ${entradasAntiguas.length} registros de ingresos para revisar.`);

  for (const e of entradasAntiguas) {
    await prisma.kardex.update({
      where: { id: e.id },
      data: {
        tipoMovimiento: "INGRESO TRANSFERENCIA"
      }
    });
    console.log(`-> Registro ID #${e.id} actualizado: tipo: "INGRESO TRANSFERENCIA"`);
  }

  console.log("¡Corrección de datos históricos completada con éxito!");
}

main()
  .catch((e) => {
    console.error("Error al corregir registros:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

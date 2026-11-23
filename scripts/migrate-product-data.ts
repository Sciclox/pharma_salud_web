import prisma from "../src/lib/prisma";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  console.log("=== INICIANDO MIGRACIÓN DE DATOS DE PRODUCTOS ===");

  const productos = await prisma.producto.findMany({
    include: {
      laboratorio: true,
      categoria: true,
    }
  });

  console.log(`Se encontraron ${productos.length} productos para migrar.`);

  for (const item of productos) {
    const originalName = item.nombreProducto || "";
    console.log(`\nProcesando producto ID ${item.id}: "${originalName}"`);

    // 1. Extraer concentración
    const concRegex = /(\d+\s*(?:mg|g|ml|mcg|ug|ui|%|ug|ui|cap|tab)(?:\/\d+\s*(?:mg|g|ml))?)/i;
    const concMatch = originalName.match(concRegex);
    const concentracion = concMatch ? concMatch[1].trim() : "500 mg";

    // 2. Limpiar nombre comercial y genérico
    let cleanName = originalName.replace(concRegex, "").trim();

    // Quitar el laboratorio si está al final del nombre
    if (item.laboratorio?.nombre) {
      const labName = item.laboratorio.nombre.trim();
      const labRegex = new RegExp(`\\b${labName}\\b`, "i");
      cleanName = cleanName.replace(labRegex, "").trim();
    }
    
    // Quitar dobles espacios o caracteres extraños al final
    cleanName = cleanName.replace(/\s+/g, " ").replace(/[-–—,/]$/, "").trim();

    if (!cleanName) {
      cleanName = originalName.split(" ")[0] || "Medicamento";
    }

    const nombreComercial = cleanName;
    const nombreGenerico = cleanName;

    // 3. Forma farmacéutica
    const catName = item.categoria?.nombre || "Tableta";
    let formaFarmaceutica = "Tableta";
    if (/jarabe|suspension|liquido/i.test(catName)) {
      formaFarmaceutica = "Jarabe";
    } else if (/inyectable|ampolla/i.test(catName)) {
      formaFarmaceutica = "Inyectable";
    } else if (/crema|unguento|pomada/i.test(catName)) {
      formaFarmaceutica = "Crema";
    } else if (/capsula/i.test(catName)) {
      formaFarmaceutica = "Cápsula";
    } else if (catName !== "General" && catName !== "Unidad" && catName !== "Caja") {
      formaFarmaceutica = catName;
    }

    // 4. Presentación
    const mult = item.cantidadPresentacion || 1;
    const presentacion = mult > 1 ? `Caja x ${mult} unidades` : "Unidad";

    // 5. Marca y Laboratorio
    const marca = item.laboratorio?.nombre || "Genérico";

    // 6. SKU y Código de barras únicos
    let cleanPrefix = cleanName.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "");
    if (!cleanPrefix || cleanPrefix.length < 2) {
      cleanPrefix = "MED";
    }
    const cleanConc = concentracion.replace(/[^A-Z0-9]/ig, "").toUpperCase();
    const sku = `${cleanPrefix}${cleanConc}-${item.id}`;
    const codigoBarras = `775${item.id.toString().padStart(10, "0")}`;

    console.log("-> Campos calculados:");
    console.log(`   Nombre Comercial: "${nombreComercial}"`);
    console.log(`   Nombre Genérico:  "${nombreGenerico}"`);
    console.log(`   Concentración:    "${concentracion}"`);
    console.log(`   Forma Farmac.:    "${formaFarmaceutica}"`);
    console.log(`   Presentación:     "${presentacion}"`);
    console.log(`   Marca:            "${marca}"`);
    console.log(`   SKU:              "${sku}"`);
    console.log(`   Código Barras:    "${codigoBarras}"`);

    // Actualizar en la base de datos
    await prisma.producto.update({
      where: { id: item.id },
      data: {
        nombreComercial,
        nombreGenerico,
        concentracion,
        formaFarmaceutica,
        presentacion,
        marca,
        sku,
        codigoBarras,
      }
    });
  }

  console.log("\n=== MIGRACIÓN COMPLETADA CON ÉXITO ===");
}

migrate()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

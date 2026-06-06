import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as sqlite3 from "sqlite3";
import * as bcrypt from "bcryptjs";
import * as path from "path";

// Usamos DIRECT_DATABASE_URL para soportar múltiples conexiones concurrentes sin el limitador del pool de transacciones
const pool = new Pool({ connectionString: process.env.DIRECT_DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Ruta a la base de datos SQLite del proyecto Flutter original
const SQLITE_DB_PATH = path.resolve(
  "C:/Users/Lenovo/OneDrive/Documentos/Proyectos/pharma_salud/.dart_tool/sqflite_common_ffi/databases/botica.db"
);

// Conectar a SQLite
const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("Error al abrir base de datos SQLite:", err.message);
    process.exit(1);
  }
  console.log("Conectado con éxito a la base de datos SQLite real en:", SQLITE_DB_PATH);
});

// Función auxiliar para correr queries en SQLite mediante promesas
function queryAll(sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function migrate() {
  try {
    console.log("Iniciando migración de datos...");

    // 1. Asegurarse de tener al menos una Sucursal en Postgres para asignar los stocks
    let sucursal = await prisma.sucursal.findFirst();
    if (!sucursal) {
      sucursal = await prisma.sucursal.create({
        data: {
          nombre: "Botica Pharma Salud - Principal",
          direccion: "Av. Larco 456, Trujillo",
          estado: "activo",
        },
      });
      console.log("Sucursal principal creada automáticamente para la migración.");
    }
    const sucursalId = sucursal.id;

    // 2. Migrar Usuarios de SQLite (Tabla USUARIO)
    console.log("Migrando usuarios...");
    const usuariosSqlite = await queryAll("SELECT * FROM USUARIO");
    
    for (const u of usuariosSqlite) {
      // Encriptar la contraseña si viene en texto plano
      const claveEncriptada = u.CLAVE.startsWith("$2b$") 
        ? u.CLAVE 
        : await bcrypt.hash(u.CLAVE, 10);

      // Si es un vendedor, lo asociamos a la sucursal activa
      const sId = u.ROL === "Administrador" ? null : sucursalId;

      await prisma.usuario.upsert({
        where: { nombreUsuario: u.NOMBRE_USUARIO },
        update: {
          nombreVendedor: u.NOMBRE_VENDEDOR,
          clave: claveEncriptada,
          rol: u.ROL === "Administrador" ? "Administrador" : "Vendedor",
          sucursalId: sId,
          genero: u.GENERO || null,
          estado: u.ESTADO || "activo",
        },
        create: {
          nombreUsuario: u.NOMBRE_USUARIO,
          nombreVendedor: u.NOMBRE_VENDEDOR,
          clave: claveEncriptada,
          rol: u.ROL === "Administrador" ? "Administrador" : "Vendedor",
          sucursalId: sId,
          genero: u.GENERO || null,
          estado: u.ESTADO || "activo",
        },
      });
    }
    console.log(`Migrados ${usuariosSqlite.length} usuarios.`);

    // 3. Migrar Productos (Tabla PRODUCTO) en chunks paralelos
    console.log("Migrando productos y asignando stocks locales...");
    const productosSqlite = await queryAll("SELECT * FROM PRODUCTO");
    console.log(`Total productos a migrar: ${productosSqlite.length}`);

    const CHUNK_SIZE = 100;
    for (let i = 0; i < productosSqlite.length; i += CHUNK_SIZE) {
      const chunk = productosSqlite.slice(i, i + CHUNK_SIZE);
      console.log(`Procesando chunk ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(productosSqlite.length / CHUNK_SIZE)} (${chunk.length} productos)...`);

      await Promise.all(chunk.map(async (p) => {
        const id = p.ID;
        const nombreProducto = p.Nombre_Producto;
        const tipoProducto = p.Tipo_Producto || "General";
        const cantidadPresentacion = p.Cantidad_Presentacion || 100;
        const cantidadPresentacionBlister = p.Cantidad_Presentacion_blister || 10;
        
        const stockTotal = p.Cantidad_Total || 0;
        const precioCaja = p.Precio_Caja || 0;
        const precioUnidad = p.Precio_Unidad || 0;
        const costoCaja = p.Costo_Caja || 0;
        const costoUnidad = p.Costo_Unidad || 0;
        const stockMinimo = p.Stock_Minimo || 10;

        // Crear o actualizar en catálogo centralizado
        const prodPostgres = await prisma.producto.upsert({
          where: { id },
          update: {
            nombreProducto,
            tipoProducto,
            cantidadPresentacion,
            cantidadPresentacionBlister,
          },
          create: {
            id,
            nombreProducto,
            tipoProducto,
            cantidadPresentacion,
            cantidadPresentacionBlister,
          },
        });

        // Crear o actualizar relación de stock/precios en inventario_sucursal
        await prisma.inventarioSucursal.upsert({
          where: {
            productoId_sucursalId: {
              productoId: prodPostgres.id,
              sucursalId,
            },
          },
          update: {
            cantidadTotal: stockTotal,
            precioCaja,
            precioUnidad,
            costoCaja,
            costoUnidad,
            stockMinimo,
          },
          create: {
            productoId: prodPostgres.id,
            sucursalId,
            cantidadTotal: stockTotal,
            precioCaja,
            precioUnidad,
            costoCaja,
            costoUnidad,
            stockMinimo,
          },
        });
      }));
    }
    console.log(`Migrados ${productosSqlite.length} productos con sus inventarios asociados.`);

    // 4. Migrar Lotes de Vencimiento (Tabla FECHA_VENCIMIENTO)
    console.log("Migrando lotes de vencimiento...");
    try {
      const lotesSqlite = await queryAll("SELECT * FROM FECHA_VENCIMIENTO");
      console.log(`Total lotes de vencimiento a migrar: ${lotesSqlite.length}`);
      
      const LOTES_CHUNK_SIZE = 100;
      for (let i = 0; i < lotesSqlite.length; i += LOTES_CHUNK_SIZE) {
        const chunk = lotesSqlite.slice(i, i + LOTES_CHUNK_SIZE);
        await Promise.all(chunk.map(async (l) => {
          const fecha = new Date(l.Fecha_Vencimiento);
          if (isNaN(fecha.getTime())) return;

          // Comprobar que el producto exista en Postgres
          const prod = await prisma.producto.findUnique({
            where: { id: l.Producto_ID },
          });

          if (!prod) return;

          await prisma.expiracionLote.create({
            data: {
              sucursalId,
              productoId: l.Producto_ID,
              fechaVencimiento: fecha,
              cantidad: l.Cantidad || 0,
            },
          });
        }));
      }
      console.log(`Migrados ${lotesSqlite.length} lotes de vencimiento.`);
    } catch (vencError) {
      console.log("Aviso: No se pudo migrar la tabla FECHA_VENCIMIENTO (puede estar vacía o no existir en desarrollo).");
    }

    console.log("¡MIGRACIÓN COMPLETADA CON ÉXITO! Todos los datos reales están en PostgreSQL.");

  } catch (error) {
    console.error("Error catastrófico en la migración:", error);
  } finally {
    db.close();
    await prisma.$disconnect();
    await pool.end();
  }
}

// Ejecutar migración
migrate();

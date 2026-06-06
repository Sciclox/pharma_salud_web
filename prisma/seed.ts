import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Iniciando carga de datos semilla (seed)...");

  // 1. Limpiar base de datos para evitar duplicados
  await prisma.sobranteCaja.deleteMany();
  await prisma.expiracionLote.deleteMany();
  await prisma.kardex.deleteMany();
  await prisma.carritoVentas.deleteMany();
  await prisma.detalleVenta.deleteMany();
  await prisma.registroVentas.deleteMany();
  await prisma.inventarioSucursal.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.sucursal.deleteMany();

  console.log("Base de datos limpia.");

  // 2. Crear sucursales de prueba (las 4 farmacias del usuario)
  const sucursal1 = await prisma.sucursal.create({
    data: {
      nombre: "Botica Pharma Salud - Principal",
      direccion: "Av. Larco 456, Trujillo",
      estado: "activo",
    },
  });

  const sucursal2 = await prisma.sucursal.create({
    data: {
      nombre: "Botica Pharma Salud - Sucursal Norte",
      direccion: "Av. Tupac Amaru 1020, Trujillo",
      estado: "activo",
    },
  });

  const sucursal3 = await prisma.sucursal.create({
    data: {
      nombre: "Botica Pharma Salud - Sucursal Sur",
      direccion: "Av. América Sur 2340, Trujillo",
      estado: "activo",
    },
  });

  const sucursal4 = await prisma.sucursal.create({
    data: {
      nombre: "Botica Pharma Salud - Sucursal Este",
      direccion: "Av. El Porvenir 789, Trujillo",
      estado: "activo",
    },
  });

  console.log("4 Sucursales creadas.");

  // Encriptar contraseñas
  const claveAdmin = await bcrypt.hash("admin123", 10);
  const claveVendedor = await bcrypt.hash("vendedor123", 10);

  // 3. Crear usuario Administrador Global (sucursalId = null)
  const admin = await prisma.usuario.create({
    data: {
      nombreUsuario: "admin",
      nombreVendedor: "Administrador Global",
      clave: claveAdmin,
      rol: "Administrador",
      sucursalId: null, // Acceso global
      genero: "Masculino",
      estado: "activo",
    },
  });

  // 4. Crear vendedores asociados a sucursales específicas
  const vendedor1 = await prisma.usuario.create({
    data: {
      nombreUsuario: "vendedor1",
      nombreVendedor: "Juan Pérez",
      clave: claveVendedor,
      rol: "Vendedor",
      sucursalId: sucursal1.id, // Amarrado a Sucursal Principal
      genero: "Masculino",
      estado: "activo",
    },
  });

  const vendedor2 = await prisma.usuario.create({
    data: {
      nombreUsuario: "vendedora2",
      nombreVendedor: "María Rojas",
      clave: claveVendedor,
      rol: "Vendedor",
      sucursalId: sucursal2.id, // Amarrado a Sucursal Norte
      genero: "Femenino",
      estado: "activo",
    },
  });

  console.log("Usuarios semilla creados:");
  console.log(`- Admin: admin / admin123 (Administrador Global)`);
  console.log(`- Vendedor 1: vendedor1 / vendedor123 (${sucursal1.nombre})`);
  console.log(`- Vendedora 2: vendedora2 / vendedor123 (${sucursal2.nombre})`);

  // 5. Crear algunos productos semilla de catálogo
  const producto1 = await prisma.producto.create({
    data: {
      nombreProducto: "Paracetamol 500mg Genfar",
      tipoProducto: "Analgesicos",
      cantidadPresentacion: 100, // 100 unidades por caja
      cantidadPresentacionBlister: 10, // 10 unidades por blíster
    },
  });

  const producto2 = await prisma.producto.create({
    data: {
      nombreProducto: "Amoxicilina 500mg - Portuguez",
      tipoProducto: "Antibioticos",
      cantidadPresentacion: 50, // 50 unidades por caja
      cantidadPresentacionBlister: 10,
    },
  });

  const producto3 = await prisma.producto.create({
    data: {
      nombreProducto: "Ibuprofeno 400mg - Bago",
      tipoProducto: "Antiinflamatorios",
      cantidadPresentacion: 100,
      cantidadPresentacionBlister: 10,
    },
  });

  console.log("Productos semilla creados en catálogo central.");

  // 6. Asignar inventario y precios a sucursales
  // Sucursal Principal (producto 1, 2, 3)
  await prisma.inventarioSucursal.create({
    data: {
      productoId: producto1.id,
      sucursalId: sucursal1.id,
      cantidadTotal: 500, // unidades físicas totales
      precioCaja: 20.0,
      precioUnidad: 0.25,
      costoCaja: 12.0,
      costoUnidad: 0.12,
      stockMinimo: 100,
    },
  });

  await prisma.inventarioSucursal.create({
    data: {
      productoId: producto2.id,
      sucursalId: sucursal1.id,
      cantidadTotal: 300,
      precioCaja: 35.0,
      precioUnidad: 0.8,
      costoCaja: 22.0,
      costoUnidad: 0.44,
      stockMinimo: 50,
    },
  });

  // Sucursal Norte (producto 1 con precios y stock diferentes)
  await prisma.inventarioSucursal.create({
    data: {
      productoId: producto1.id,
      sucursalId: sucursal2.id,
      cantidadTotal: 150, // Menos stock
      precioCaja: 22.0, // Precio más alto
      precioUnidad: 0.3,
      costoCaja: 12.0,
      costoUnidad: 0.12,
      stockMinimo: 50,
    },
  });

  console.log("Inventarios por sucursal inicializados.");

  // 7. Crear algunos lotes de vencimiento iniciales (FIFO)
  // Paracetamol en Sucursal Principal tiene 2 lotes
  await prisma.expiracionLote.create({
    data: {
      sucursalId: sucursal1.id,
      productoId: producto1.id,
      fechaVencimiento: new Date("2026-10-15T00:00:00Z"), // Vence primero
      cantidad: 200,
    },
  });

  await prisma.expiracionLote.create({
    data: {
      sucursalId: sucursal1.id,
      productoId: producto1.id,
      fechaVencimiento: new Date("2027-05-20T00:00:00Z"),
      cantidad: 300, // Total = 500
    },
  });

  console.log("Lotes de vencimiento semilla inicializados.");
  console.log("Carga de datos semilla completada con éxito.");
}

main()
  .catch((e) => {
    console.error("Error al ejecutar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

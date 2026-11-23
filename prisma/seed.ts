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

  // Eliminar tablas dependientes de productos antes de borrar productos
  await prisma.detalleOrdenCompra.deleteMany();
  await prisma.ordenCompra.deleteMany();
  await prisma.detalleIngreso.deleteMany();
  await prisma.ingresoMercaderia.deleteMany();
  await prisma.detalleTransferencia.deleteMany();
  await prisma.transferencia.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.productoCompuesto.deleteMany();
  
  await prisma.inventarioSucursal.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.registroVentas.deleteMany();
  await prisma.metodoPago.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.sucursal.deleteMany();
  await prisma.categoria.deleteMany();
  await prisma.laboratorio.deleteMany();
  await prisma.unidadMedida.deleteMany();

  console.log("Base de datos limpia.");

  // 1.5 Crear categorías por defecto
  const defaultCategorias = [
    { nombre: "Analgesicos", descripcion: "Medicamentos analgésicos para aliviar el dolor" },
    { nombre: "Antibioticos", descripcion: "Antibióticos para combatir infecciones bacterianas" },
    { nombre: "Antiinflamatorios", descripcion: "Medicamentos antiinflamatorios para reducir inflamación" },
    { nombre: "Vitaminas", descripcion: "Suplementos vitamínicos y minerales" },
    { nombre: "General", descripcion: "Otros medicamentos y productos generales" }
  ];

  for (const cat of defaultCategorias) {
    await prisma.categoria.create({
      data: cat
    });
  }
  console.log("Categorías semilla creadas.");

  // 1.8 Crear laboratorios por defecto
  const genfar = await prisma.laboratorio.create({
    data: { nombre: "Genfar", descripcion: "Laboratorio farmacéutico Genfar" }
  });
  const bago = await prisma.laboratorio.create({
    data: { nombre: "Bago", descripcion: "Laboratorio farmacéutico Bagó" }
  });
  const albis = await prisma.laboratorio.create({
    data: { nombre: "Albis", descripcion: "Distribuidora y laboratorio Albis" }
  });
  const portuguez = await prisma.laboratorio.create({
    data: { nombre: "Portuguez", descripcion: "Laboratorio Portuguez" }
  });
  const hersil = await prisma.laboratorio.create({
    data: { nombre: "Hersil", descripcion: "Laboratorio Hersil" }
  });
  console.log("Laboratorios semilla creados.");

  // 1.9 Crear unidades de medida por defecto
  const defaultUnidades = [
    { nombre: "mg" },
    { nombre: "ml" },
    { nombre: "g" },
    { nombre: "mcg" },
    { nombre: "UI" },
    { nombre: "%" },
    { nombre: "mg/ml" },
    { nombre: "g/ml" },
    { nombre: "mEq" },
    { nombre: "U" }
  ];
  for (const uni of defaultUnidades) {
    await prisma.unidadMedida.create({
      data: uni
    });
  }
  console.log("Unidades de medida semilla creadas.");

  // 1.10 Crear métodos de pago por defecto
  const metodosPago = ["efectivo", "yape", "transferencia"];
  for (const mp of metodosPago) {
    await prisma.metodoPago.create({ data: { nombre: mp } });
  }
  console.log("Métodos de pago semilla creados.");

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
  const analgesicos = await prisma.categoria.findFirst({ where: { nombre: "Analgesicos" } });
  const antibioticos = await prisma.categoria.findFirst({ where: { nombre: "Antibioticos" } });
  const antiinflamatorios = await prisma.categoria.findFirst({ where: { nombre: "Antiinflamatorios" } });

  const tabletaForma = await prisma.formaFarmaceutica.create({
    data: { nombre: "Tableta" }
  });

  const producto1 = await prisma.producto.create({
    data: {
      nombreComercial: "Paracetamol",
      nombreGenerico: "Paracetamol",
      concentracion: "500 mg",
      formaFarmaceuticaId: tabletaForma.id,
      presentacion: "Caja",
      laboratorioId: genfar.id,
      cantidadPresentacion: 100,
      cantidadPresentacionBlister: 10,
      categorias: { connect: { id: analgesicos!.id } },
    },
  });

  const producto2 = await prisma.producto.create({
    data: {
      nombreComercial: "Amoxicilina",
      nombreGenerico: "Amoxicilina",
      concentracion: "500 mg",
      formaFarmaceuticaId: tabletaForma.id,
      presentacion: "Caja",
      laboratorioId: portuguez.id,
      cantidadPresentacion: 50,
      cantidadPresentacionBlister: 10,
      categorias: { connect: { id: antibioticos!.id } },
    },
  });

  const producto3 = await prisma.producto.create({
    data: {
      nombreComercial: "Ibuprofeno",
      nombreGenerico: "Ibuprofeno",
      concentracion: "400 mg",
      formaFarmaceuticaId: tabletaForma.id,
      presentacion: "Caja",
      laboratorioId: bago.id,
      cantidadPresentacion: 100,
      cantidadPresentacionBlister: 10,
      categorias: { connect: { id: antiinflamatorios!.id } },
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
      precioBlister: 2.5,
      costo: 12.0,
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
      precioBlister: 0,
      costo: 22.0,
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
      precioBlister: 2.5,
      costo: 12.0,
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

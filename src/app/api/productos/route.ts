import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/productos - Obtener todos los productos del catálogo central (con soporte para búsqueda)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const categoria = searchParams.get("categoria") || "";
    const laboratorioId = searchParams.get("laboratorioId") || "";

    // Filtros de búsqueda acumulativos
    const whereClause: any = {};

    if (search) {
      whereClause.nombreProducto = {
        contains: search,
        mode: "insensitive", // Ignora mayúsculas y minúsculas en Postgres
      };
    }

    if (categoria) {
      whereClause.tipoProducto = {
        equals: categoria,
        mode: "insensitive",
      };
    }

    if (laboratorioId) {
      whereClause.laboratorioId = {
        equals: parseInt(laboratorioId),
      };
    }

    const productos = await prisma.producto.findMany({
      where: whereClause,
      orderBy: { nombreProducto: "asc" },
      // Incluir información de inventario por sucursal si se solicita
      include: {
        inventarios: true,
        laboratorio: true,
      },
    });

    return NextResponse.json(productos);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/productos - Agregar producto al catálogo global (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const {
      nombreProducto,
      tipoProducto,
      laboratorioId,
      cantidadPresentacion,
      cantidadPresentacionBlister,
    } = body;

    if (!nombreProducto) {
      return NextResponse.json(
        { error: "El nombre del producto es requerido" },
        { status: 400 }
      );
    }

    const nuevoProducto = await prisma.producto.create({
      data: {
        nombreProducto,
        tipoProducto,
        laboratorioId: laboratorioId ? parseInt(laboratorioId) : null,
        cantidadPresentacion: cantidadPresentacion ? parseInt(cantidadPresentacion) : null,
        cantidadPresentacionBlister: cantidadPresentacionBlister ? parseInt(cantidadPresentacionBlister) : null,
      },
      include: {
        laboratorio: true,
      },
    });

    // Opcional: Al crear un producto global, se le puede inicializar una fila en 'inventario_sucursal'
    // con stock 0 para cada sucursal existente para que esté listo para rellenar stock.
    const sucursales = await prisma.sucursal.findMany({
      where: { estado: "activo" },
    });

    // Crear inventario inicial con stock 0 para todas las sucursales
    if (sucursales.length > 0) {
      const inventariosData = sucursales.map((sucursal) => ({
        productoId: nuevoProducto.id,
        sucursalId: sucursal.id,
        cantidadTotal: 0,
        precioCaja: 0,
        precioUnidad: 0,
        costoCaja: 0,
        costoUnidad: 0,
        stockMinimo: 0,
      }));

      await prisma.inventarioSucursal.createMany({
        data: inventariosData,
      });
    }

    return NextResponse.json(nuevoProducto, { status: 201 });
  } catch (error) {
    console.error("Error al crear producto global:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

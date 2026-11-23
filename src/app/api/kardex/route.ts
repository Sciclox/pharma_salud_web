import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { getFullProductName } from "@/lib/productos";

// GET /api/kardex - Listar movimientos de Kardex con filtros
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || ""; // buscar producto
    const tipoMovimiento = searchParams.get("tipoMovimiento") || "";
    const sucursalIdParam = searchParams.get("sucursalId");
    const fechaInicio = searchParams.get("fechaInicio") || "";
    const fechaFin = searchParams.get("fechaFin") || "";

    const whereClause: any = {};

    // 1. Filtrar por sucursal según rol
    if (session.user.role === "Vendedor") {
      if (!session.user.sucursalId) {
        return NextResponse.json({ error: "Vendedor sin sucursal asignada" }, { status: 400 });
      }
      whereClause.sucursalId = session.user.sucursalId;
    } else {
      if (sucursalIdParam) {
        whereClause.sucursalId = parseInt(sucursalIdParam);
      }
    }

    // 2. Filtro por coincidencia de nombre de producto
    if (search) {
      whereClause.nombreProducto = {
        contains: search,
        mode: "insensitive",
      };
    }

    // 3. Filtro por tipo de movimiento
    if (tipoMovimiento) {
      if (tipoMovimiento.includes(",")) {
        whereClause.tipoMovimiento = {
          in: tipoMovimiento.split(",").map((t) => t.trim()),
        };
      } else {
        whereClause.tipoMovimiento = tipoMovimiento;
      }
    }

    // 4. Filtro por rango de fechas
    if (fechaInicio || fechaFin) {
      whereClause.fechaMovimiento = {};
      if (fechaInicio) {
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0);
        whereClause.fechaMovimiento.gte = inicio;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);
        whereClause.fechaMovimiento.lte = fin;
      }
    }

    const movimientos = await prisma.kardex.findMany({
      where: whereClause,
      include: {
        sucursal: {
          select: { nombre: true },
        },
      },
      orderBy: { fechaMovimiento: "desc" },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error("Error al obtener Kardex:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/kardex - Crear un ajuste de inventario manual (Solo Admin)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "Administrador") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { productoId, sucursalId, tipoMovimiento, cantidad, motivo } = body;

    if (!productoId || !sucursalId || !tipoMovimiento || cantidad === undefined) {
      return NextResponse.json(
        { error: "productoId, sucursalId, tipoMovimiento y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const pId = parseInt(productoId);
    const sId = parseInt(sucursalId);
    const cant = parseInt(cantidad);

    if (cant === 0) {
      return NextResponse.json(
        { error: "La cantidad del ajuste no puede ser cero" },
        { status: 400 }
      );
    }

    // Validar tipo de movimiento
    const tiposValidos = ["Ingreso", "Registro", "Ajuste (+)", "Ajuste (-)"];
    if (!tiposValidos.includes(tipoMovimiento)) {
      return NextResponse.json(
        { error: "Tipo de movimiento inválido en Kardex" },
        { status: 400 }
      );
    }

    const resultado = await prisma.$transaction(async (tx) => {
      // 1. Obtener producto para registrar su nombre denormalizado
      const producto = await tx.producto.findUnique({
        where: { id: pId },
        include: { laboratorio: true },
      });

      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      // 2. Actualizar el stock en inventario_sucursal
      // Nota: Si es 'Ajuste (-)' o 'Ajuste (+)', la cantidad ya debe venir con el signo correcto
      // para sumarlo o restarlo. Por simplicidad, asumimos que 'cant' viene con el signo correcto
      // o calculamos el incremento neto:
      let incrementoStock = cant;
      if (tipoMovimiento === "Ajuste (-)" && cant > 0) {
        incrementoStock = -cant; // Asegurar que sea negativo
      }

      const inventario = await tx.inventarioSucursal.upsert({
        where: {
          productoId_sucursalId: {
            productoId: pId,
            sucursalId: sId,
          },
        },
        update: {
          cantidadTotal: {
            increment: incrementoStock,
          },
        },
        create: {
          productoId: pId,
          sucursalId: sId,
          cantidadTotal: incrementoStock > 0 ? incrementoStock : 0,
        },
      });

      if (inventario.cantidadTotal < 0) {
        throw new Error("El ajuste resulta en stock negativo para el producto");
      }

      // 3. Crear el registro en Kardex
      const movimiento = await tx.kardex.create({
        data: {
          sucursalId: sId,
          productoId: pId,
          nombreProducto: getFullProductName(producto),
          tipoMovimiento,
          cantidad: incrementoStock,
        },
      });

      return { movimiento, nuevoStock: inventario.cantidadTotal };
    });

    return NextResponse.json(resultado, { status: 201 });
  } catch (error: any) {
    console.error("Error al registrar movimiento en Kardex:", error);
    return NextResponse.json(
      { error: error.message || "Error al registrar ajuste" },
      { status: 400 }
    );
  }
}

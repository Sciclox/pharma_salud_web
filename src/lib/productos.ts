export function getFullProductName(producto: {
  nombreComercial?: string | null;
  nombreGenerico?: string | null;
  concentracion?: string | null;
  presentacion?: string | null;
  cantidadPresentacion?: number | null;
  contenidoNetoValor?: number | null;
  contenidoNetoUnidad?: string | null;
  laboratorio?: { nombre: string } | null;
  esGenerico?: boolean | null;
}) {
  const parts = [];
  if (producto.esGenerico) {
    if (producto.nombreGenerico) {
      parts.push(producto.nombreGenerico);
    } else if (producto.nombreComercial) {
      parts.push(producto.nombreComercial);
    }
  } else {
    if (producto.nombreComercial) {
      parts.push(producto.nombreComercial);
      if (producto.nombreGenerico) {
        parts.push(`(${producto.nombreGenerico})`);
      }
    } else if (producto.nombreGenerico) {
      parts.push(producto.nombreGenerico);
    }
  }

  if (producto.concentracion) {
    parts.push(producto.concentracion);
  }

  if (producto.contenidoNetoValor && producto.contenidoNetoUnidad) {
    parts.push(`${producto.contenidoNetoValor} ${producto.contenidoNetoUnidad}`);
  }
  
  if (producto.presentacion) {
    if (producto.presentacion.toLowerCase() === "caja") {
      parts.push(`Caja x ${producto.cantidadPresentacion || 100} unidades`);
    } else {
      parts.push(producto.presentacion);
    }
  }

  if (producto.laboratorio?.nombre) {
    parts.push(producto.laboratorio.nombre);
  }

  return parts.join(" - ");
}

export function generateSKU(producto: {
  nombreComercial?: string | null;
  nombreGenerico?: string | null;
  concentracion?: string | null;
  cantidadPresentacion?: number | null;
}, laboratorioNombre?: string | null): string {
  // 1. Tomar las primeras 4 letras del nombre comercial o genérico
  const nameSource = producto.nombreComercial || producto.nombreGenerico || "PROD";
  const cleanName = nameSource
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
    .replace(/[^a-zA-Z]/g, "") // Dejar solo letras
    .toUpperCase();
  const prefix = cleanName.substring(0, 4).padEnd(4, "X");

  // 2. Limpiar la concentración (por ejemplo, "500 mg" -> "500MG")
  const rawConcentration = producto.concentracion || "";
  const cleanConcentration = rawConcentration
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-zA-Z]/g, "") // Dejar solo números y letras
    .toUpperCase();
  const concPart = cleanConcentration ? `${cleanConcentration}` : "00";

  // 3. Cantidad presentación (por ejemplo, "100")
  const cantPart = producto.cantidadPresentacion ? `${producto.cantidadPresentacion}` : "1";

  // 4. Sufijo de laboratorio (o un código aleatorio si no hay laboratorio)
  let labSuffix = "";
  if (laboratorioNombre) {
    labSuffix = laboratorioNombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .substring(0, 3);
  } else {
    // Generar 3 letras aleatorias
    labSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  }
  labSuffix = labSuffix.padEnd(3, "X");

  return `${prefix}${concPart}-${cantPart}-${labSuffix}`;
}


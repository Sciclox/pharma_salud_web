/**
 * Formatea un número como moneda peruana (Soles - S/)
 * @param value Valor numérico o string
 */
export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "S/ 0.00";
  
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "S/ 0.00";

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(num);
}

/**
 * Formatea los días para visualización
 * @param dias Cantidad de días
 */
export function formatDias(dias: number): string {
  if (dias === 1) return "1 día";
  return `${dias} días`;
}

/**
 * Convierte los días restantes de stock en una descripción legible
 * @param dias Cantidad de días estimados
 */
export function formatAgotamiento(dias: number | null | undefined): string {
  if (dias === null || dias === undefined || dias < 0) return "Sin datos";
  if (dias === 0) return "Agotado";
  
  if (dias < 30) {
    const d = Math.round(dias);
    return d === 1 ? "1 día" : `${d} días`;
  }
  
  if (dias < 365) {
    const meses = Math.round(dias / 30);
    return meses === 1 ? "1 mes" : `${meses} meses`;
  }
  
  const anios = Math.round((dias / 365) * 10) / 10;
  return anios === 1 ? "1 año" : `${anios} años`;
}

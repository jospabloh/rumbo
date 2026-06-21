/**
 * Inventario de refacciones — utilidades de stock bajo (puras y testeables).
 *
 * "Stock bajo" sólo aplica cuando la refacción define un mínimo (`min_stock` > 0):
 * así una refacción sin umbral configurado nunca dispara falsas alertas.
 */

/** @param {{ stock?: number, min_stock?: number }} part */
export function isLowStock(part) {
  const min = Number(part?.min_stock) || 0;
  const stock = Number(part?.stock) || 0;
  return min > 0 && stock <= min;
}

/** @param {{ stock?: number }} part */
export function isOutOfStock(part) {
  return (Number(part?.stock) || 0) === 0;
}

/** Filtra las refacciones por debajo de su mínimo. */
export function lowStockParts(parts = []) {
  return parts.filter(isLowStock);
}

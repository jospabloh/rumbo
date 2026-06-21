import { describe, it, expect } from 'vitest';
import { isLowStock, isOutOfStock, lowStockParts } from '@/lib/parts';

describe('isLowStock', () => {
  it('is false when no minimum is configured', () => {
    expect(isLowStock({ stock: 0, min_stock: 0 })).toBe(false);
    expect(isLowStock({ stock: 0 })).toBe(false);
  });
  it('is true at or below the minimum', () => {
    expect(isLowStock({ stock: 2, min_stock: 2 })).toBe(true);
    expect(isLowStock({ stock: 1, min_stock: 2 })).toBe(true);
  });
  it('is false above the minimum', () => {
    expect(isLowStock({ stock: 5, min_stock: 2 })).toBe(false);
  });
});

describe('isOutOfStock', () => {
  it('detects zero stock', () => {
    expect(isOutOfStock({ stock: 0 })).toBe(true);
    expect(isOutOfStock({})).toBe(true);
    expect(isOutOfStock({ stock: 3 })).toBe(false);
  });
});

describe('lowStockParts', () => {
  it('filters parts at/below their minimum', () => {
    const parts = [
      { id: 'a', stock: 1, min_stock: 2 },
      { id: 'b', stock: 9, min_stock: 2 },
      { id: 'c', stock: 0, min_stock: 0 },
    ];
    expect(lowStockParts(parts).map((p) => p.id)).toEqual(['a']);
  });
});

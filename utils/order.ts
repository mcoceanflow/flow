// lib/order.ts
//
// Fractional ("gap-based") ordering.
//
// Instead of storing todos as 0, 1, 2, 3... (which forces a rewrite of every
// document below the drop point whenever an item moves), each todo stores an
// `order: number`. To move an item between two neighbors, we just give it a
// number that sits between the neighbors' order values — one document write,
// regardless of list length.

const ORDER_STEP = 1000;

/**
 * Order value for an item dropped between `prevOrder` and `nextOrder`.
 * Pass `null` for a boundary (top or bottom of the list).
 */
export function getOrderBetween(
  prevOrder: number | null,
  nextOrder: number | null
): number {
  if (prevOrder === null && nextOrder === null) return ORDER_STEP;
  if (prevOrder === null) return nextOrder! - ORDER_STEP;
  if (nextOrder === null) return prevOrder + ORDER_STEP;
  return (prevOrder + nextOrder) / 2;
}

/**
 * Order value for a brand-new todo. New items are placed at the top of the
 * undone list (matching the old "newest first" behavior) by going below the
 * current minimum order.
 */
export function getOrderForNewItem(existingOrders: number[]): number {
  const finiteOrders = existingOrders.filter(Number.isFinite);
  if (finiteOrders.length === 0) return ORDER_STEP;
  return Math.min(...finiteOrders) - ORDER_STEP;
}
export function cartSubtotal(items: { unitAmount: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
}

export function cartLineCount(items: { quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function clampQuantity(requested: number, available: number, policy: string): number {
  const q = Math.max(1, Math.floor(requested));
  if (policy === "continue" || available < 0) return q;
  return Math.min(q, Math.max(1, available));
}

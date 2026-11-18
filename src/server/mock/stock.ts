import type { Db } from "./db";
import type { StoredOrder } from "./orders";

/** Puts the units of a cancelled order back on the shelf, per variant, size and product total. */
export function restoreStock(db: Db, order: StoredOrder): void {
  for (const line of order.lines) {
    const index = db.products.findIndex((p) => p.id === line.productId);
    const product = db.products[index];
    if (!product) continue;
    db.products[index] = {
      ...product,
      qty: product.qty + line.qty,
      variantStock: product.variantStock.map((v) =>
        v.size === line.size && v.color === line.colour ? { ...v, qty: v.qty + line.qty } : v,
      ),
      sizes: product.sizes.map((s) =>
        s.name === line.size && s.qty !== undefined ? { ...s, qty: s.qty + line.qty } : s,
      ),
    };
  }
}

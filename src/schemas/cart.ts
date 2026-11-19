import "@/lib/zod-config";
import { z } from "zod";

export const cartLineSchema = z.object({
  variantId: z.string().min(1),
  id: z.string().min(1),
  name: z.string(),
  price_ngn: z.number().int().nonnegative(),
  selectedSize: z.string(),
  selectedColor: z.string().default(""),
  image: z.string().default(""),
  qty: z.number().int().min(1).max(99),
});

export const cartSchema = z.array(cartLineSchema);
export const wishlistSchema = z.array(z.string().min(1));

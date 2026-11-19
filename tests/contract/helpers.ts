import { randomUUID } from "node:crypto";
import { expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { newReceiptPath, receipts } from "@/server/storage/receipts";
import { supabaseAuth } from "@/server/supabase/auth";
import { supabaseCatalogue } from "@/server/supabase/catalogue";
import type { OrderInput } from "@/schemas/checkout";
import type { SessionUser } from "@/types/account";
import type { Product } from "@/types/domain";
import { jar } from "./setup";

export const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
export const IP = { ip: "198.51.100.7" };

/** The server key, for arranging and checking things the way an operator would. */
export const admin = createClient(URL_BASE, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
  auth: { persistSession: false },
});

export const uniqueEmail = (tag = "t") => `${tag}.${randomUUID().slice(0, 8)}@example.test`;

export function clearBrowser(): void {
  jar.clear();
}

export async function signInAs(
  email: string,
  password: string,
  audience: "customer" | "staff" = "customer",
): Promise<SessionUser> {
  const result = await supabaseAuth.signIn(email, password, audience, {
    ip: `10.0.0.${Math.floor(Math.random() * 250)}`,
  });
  if (!result.ok) throw new Error(`sign-in failed: ${result.message}`);
  return result.value;
}

export const OWNER = { email: "owner@example.test", password: "Owner-Pass1!" };
export const EDITOR = { email: "editor@example.test", password: "Editor-Pass1!" };
export const DEMO_CUSTOMER = { email: "demo.customer@example.test", password: "Demo-Pass1!" };

export async function createCustomer(password = "Sample-Pass1!") {
  const email = uniqueEmail("cust");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: "Test", last_name: "Customer" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** A product with plenty of stock in one exact variant. */
export async function stockedProduct(): Promise<{
  product: Product;
  size: string;
  colour: string;
  qty: number;
}> {
  const { items } = await supabaseCatalogue.list({}, { limit: 200, offset: 0 });
  for (const product of items) {
    const variant = product.variantStock.find((v) => v.qty >= 8);
    if (variant) return { product, size: variant.size, colour: variant.color, qty: variant.qty };
  }
  throw new Error("no stocked product in the seed data");
}

export async function uploadedReceipt(key: string): Promise<string> {
  const path = newReceiptPath(key, "image/jpeg");
  const upload = await receipts.createUpload(path, "image/jpeg");
  const response = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }),
  });
  expect(response.ok).toBe(true);
  return path;
}

export async function orderInput(
  overrides: Partial<{
    key: string;
    state: string;
    qty: number;
    promoCode: string;
    quotedTotal: number;
    email: string;
    line: { id: string; size: string; colour: string };
  }> = {},
): Promise<OrderInput> {
  const key = overrides.key ?? randomUUID();
  const base = await stockedProduct();
  const line = overrides.line ?? { id: base.product.id, size: base.size, colour: base.colour };
  const qty = overrides.qty ?? 1;
  const state = overrides.state ?? "Lagos";
  const fee =
    { Lagos: 0, Ogun: 2000, Oyo: 2500, Osun: 2500, Ondo: 2500, Ekiti: 3000, Abuja: 3500 }[state] ??
    0;
  return {
    contact: {
      firstName: "Ada",
      lastName: "Obi",
      email: overrides.email ?? uniqueEmail("guest"),
      phone: "+2348012345678",
    },
    delivery: { address: "12 Marina Road", city: "Ikeja", state, landmark: "Opposite the bank" },
    lines: [{ id: line.id, selectedSize: line.size, selectedColor: line.colour, qty }],
    ...(overrides.promoCode ? { promoCode: overrides.promoCode } : {}),
    confirmedTransfer: true,
    quotedTotal: overrides.quotedTotal ?? base.product.priceNgn * qty + fee,
    idempotencyKey: key,
    receiptPath: await uploadedReceipt(key),
  };
}

export const page = (limit = 50, offset = 0) => ({ limit, offset });

import type { OrderInput } from "@/schemas/checkout";
import { mockOrders } from "@/server/mock/orders";
import { saveMockReceipt } from "@/server/storage/receipts";

let counter = 0;

export const freshKey = (): string => `test-key-${String(++counter).padStart(8, "0")}`;

export function orderInput(
  lines: OrderInput["lines"],
  extra: Partial<OrderInput> = {},
  email = "Ada@Example.com",
): OrderInput {
  const idempotencyKey = extra.idempotencyKey ?? freshKey();
  return {
    contact: { firstName: "Ada", lastName: "Obi", email, phone: "+2348012345678" },
    delivery: { address: "12 Allen Avenue", city: "Ikeja", state: "Ogun" },
    lines,
    confirmedTransfer: true,
    quotedTotal: 0,
    idempotencyKey,
    receiptPath: `${idempotencyKey}/receipt.jpg`,
    ...extra,
  };
}

/** Uploads a receipt, asks for the quote the checkout would show, then places the order. */
export async function placeTest(
  lines: OrderInput["lines"],
  extra: Partial<OrderInput> = {},
  context: { userId?: string | null; now?: Date; email?: string } = {},
) {
  const input = orderInput(lines, extra, context.email);
  saveMockReceipt(input.receiptPath, { type: "image/jpeg", size: 1000 });
  if (extra.quotedTotal === undefined) {
    const quote = await mockOrders.quote({
      lines,
      promoCode: input.promoCode,
      state: input.delivery.state,
    });
    if (quote.ok) input.quotedTotal = quote.total;
  }
  return mockOrders.place(input, {
    userId: context.userId ?? null,
    ...(context.now ? { now: context.now } : {}),
  });
}

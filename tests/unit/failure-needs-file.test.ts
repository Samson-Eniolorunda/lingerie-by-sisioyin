import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_PRODUCTS } from "@/data/fixtures";
import { getDb } from "@/server/mock/db";
import { mockOrders, resetMockStore } from "@/server/mock/orders";
import { saveMockReceipt } from "@/server/storage/receipts";
import { orderInput } from "./helpers";

const brief = FIXTURE_PRODUCTS[1];
if (!brief) throw new Error("fixtures missing");
const lines = [{ id: brief.id, selectedSize: "M", selectedColor: "Black", qty: 1 }];

beforeEach(resetMockStore);

describe("a failed checkout is recorded only for a receipt that is stored", () => {
  it("ignores a made-up path, so a script cannot fill the list", async () => {
    await mockOrders.recordFailure(orderInput(lines, { quotedTotal: 1 }), "Too many orders");
    expect(getDb().checkoutFailures).toHaveLength(0);
  });

  it("records a path whose file is really there", async () => {
    const input = orderInput(lines, { quotedTotal: 1 });
    saveMockReceipt(input.receiptPath, { type: "image/jpeg", size: 1000 });
    await mockOrders.recordFailure(input, "Too many orders");
    expect(getDb().checkoutFailures).toHaveLength(1);
  });
});

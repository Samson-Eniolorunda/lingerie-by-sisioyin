import type { PaymentsRepository } from "@/server/data/contracts";
import { getDb } from "./db";

export const mockPayments: PaymentsRepository = {
  async bankDetails() {
    return getDb().bank;
  },
  async methods() {
    return getDb().paymentMethods;
  },
};

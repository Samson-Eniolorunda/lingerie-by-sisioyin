import type { PaymentsRepository } from "@/server/data/contracts";
import type { PaymentMethodId } from "@/types/account";
import { anonClient } from "./clients";
import { must, str } from "./util";

/** The public reads: what checkout, e-mails and the legal pages show. Row level security lets everyone read these tables. */
export const supabasePayments: PaymentsRepository = {
  async bankDetails() {
    const rows = must(await anonClient().from("payment_bank_details").select("*").limit(1));
    const row = rows[0];
    return row
      ? {
          bankName: str(row.bank_name),
          accountNumber: str(row.account_number),
          accountName: str(row.account_name),
          note: str(row.note),
        }
      : null;
  },

  async methods() {
    const rows = must(await anonClient().from("payment_methods").select("*"));
    return rows.map((r) => ({
      method: str(r.method) as PaymentMethodId,
      enabled: r.enabled === true,
      connected: r.connected === true,
    }));
  },
};

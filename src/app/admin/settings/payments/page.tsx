import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/PageHeader";
import { PaymentsSettings } from "@/features/admin/PaymentsSettings";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Payment settings" };
export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  await requireStaff("settings.manage", "/admin/settings/payments");
  const [bank, methods, changes] = await Promise.all([
    data.payments.bankDetails(),
    data.payments.methods(),
    data.admin.paymentChanges(20),
  ]);
  return (
    <>
      <PageHeader
        title="Payments"
        lead="The bank details customers send their money to, and how else they can pay."
      />
      <PaymentsSettings bank={bank} methods={methods} changes={changes} />
    </>
  );
}

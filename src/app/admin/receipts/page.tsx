import type { Metadata } from "next";
import { OrphanReceipts } from "@/features/admin/OrphanReceipts";
import { PageHeader } from "@/features/admin/PageHeader";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { receipts } from "@/server/storage/receipts";

export const metadata: Metadata = { title: "Receipts with no order" };

export default async function OrphanReceiptsPage() {
  const user = await requireStaff("orders.view", "/admin/receipts");
  const rows = await data.admin.orphanReceipts();
  // Short-lived signed links, created only for the open failures (a customer who may have paid).
  const items = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      url: row.failureId && !row.resolved ? (await receipts.link(row.path)).url : null,
    })),
  );
  return (
    <>
      <PageHeader
        title="Receipts with no order"
        lead="A customer paid and sent a receipt, but the order could not be placed (stock gone, a promo code used up, or the total changed). Contact them and refund in full, then close the item."
      />
      <OrphanReceipts items={items} canUpdate={can(user.role, "orders.update")} />
    </>
  );
}

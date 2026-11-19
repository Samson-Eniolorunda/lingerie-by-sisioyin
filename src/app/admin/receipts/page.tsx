import { adminPath } from "@/lib/adminPath";
import type { Metadata } from "next";
import { OrphanReceipts } from "@/features/admin/OrphanReceipts";
import { PageHeader } from "@/features/admin/PageHeader";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Receipts with no order" };

export default async function OrphanReceiptsPage() {
  const user = await requireStaff("orders.view", adminPath("/receipts"));
  const rows = await data.admin.orphanReceipts();
  return (
    <>
      <PageHeader
        title="Receipts with no order"
        lead="A customer paid and sent a receipt, but the order could not be placed (stock gone, a promo code used up, or the total changed). Contact them and refund in full, then close the item."
      />
      <OrphanReceipts items={rows} canUpdate={can(user.role, "orders.update")} />
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/features/admin/PageHeader";
import { PromoManager } from "@/features/admin/PromoManager";
import { nowMs } from "@/lib/clock";
import { can } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Promo codes" };
export const dynamic = "force-dynamic";

export default async function PromosPage() {
  const user = await requireStaff("promos.manage", "/admin/promos");
  const { items: promos } = await data.admin.promos({ limit: 200, offset: 0 });
  const now = await nowMs();
  return (
    <>
      <PageHeader
        title="Promo codes"
        lead="A percentage off the items in a bag, before delivery."
      />
      <PromoManager promos={promos} canManage={can(user.role, "promos.manage")} now={now} />
    </>
  );
}

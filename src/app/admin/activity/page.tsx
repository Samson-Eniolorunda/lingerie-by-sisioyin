import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { relativeTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStaff("roles.manage", "/admin/activity");
  const { q = "" } = await searchParams;
  const needle = q.trim().toLowerCase();
  const rows = (await data.admin.activity())
    .filter(
      (a) =>
        needle === "" ||
        [a.actor, a.action, a.subject].some((f) => f.toLowerCase().includes(needle)),
    )
    .slice(0, 100);
  return (
    <>
      <PageHeader title="Activity log" lead="The latest 100 things staff did." />
      <FilterBar
        action="/admin/activity"
        search={{
          name: "q",
          label: "Search the log",
          value: q,
          placeholder: "Name, action or subject",
        }}
      />
      <DataTable
        caption="Activity"
        rows={rows}
        rowKey={(a) => a.id}
        empty="Nothing has been logged yet."
        columns={[
          { key: "who", label: "Who", title: true, cell: (a) => a.actor },
          { key: "role", label: "Role", cell: (a) => <Badge>{ROLE_LABELS[a.role]}</Badge> },
          { key: "action", label: "Action", cell: (a) => a.action },
          {
            key: "subject",
            label: "Subject",
            cell: (a) => <span className="break-words">{a.subject}</span>,
          },
          { key: "when", label: "When", cell: (a) => relativeTime(a.at) },
        ]}
      />
    </>
  );
}

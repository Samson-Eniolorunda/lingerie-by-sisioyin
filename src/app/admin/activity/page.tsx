import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { FilterBar } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { relativeTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/permissions";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";
import { pageFor, parsePageNumber } from "@/server/paging";
import { Pager } from "@/features/admin/Filters";

export const metadata: Metadata = { title: "Activity log" };
export const dynamic = "force-dynamic";
const PER_PAGE = 50;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireStaff("roles.manage", "/admin/activity");
  const { q = "", page } = await searchParams;
  const pageNumber = parsePageNumber(page);
  const { items: rows, total } = await data.admin.activity(q, pageFor(pageNumber, PER_PAGE));
  return (
    <>
      <PageHeader title="Activity log" lead={`${total} things staff have done, newest first.`} />
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
            cell: (a) => <span className="break-all">{a.subject}</span>,
          },
          { key: "when", label: "When", cell: (a) => relativeTime(a.at) },
        ]}
      />
      <Pager
        base="/admin/activity"
        params={{ q }}
        page={pageNumber}
        perPage={PER_PAGE}
        total={total}
      />
    </>
  );
}

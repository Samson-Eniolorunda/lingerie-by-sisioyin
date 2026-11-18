import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { FilterBar, Pager } from "@/features/admin/Filters";
import { PageHeader } from "@/features/admin/PageHeader";
import { relativeTime } from "@/lib/dates";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Messages" };
export const dynamic = "force-dynamic";
const PER_PAGE = 20;
const FILTERS = [
  { id: "", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "replied", label: "Replied" },
  { id: "read", label: "Read" },
] as const;

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  await requireStaff("messages.manage", "/admin/messages");
  const { status = "", q = "", page } = await searchParams;
  const all = await data.admin.messages();
  const needle = q.trim().toLowerCase();
  const rows = all
    .filter((m) => (status ? m.status === status : true))
    .filter(
      (m) =>
        needle === "" ||
        [m.name, m.email, m.body, m.orderNumber, m.subject].some((f) =>
          f.toLowerCase().includes(needle),
        ),
    );
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const shown = rows.slice((pageNumber - 1) * PER_PAGE, pageNumber * PER_PAGE);
  const count = (s: string) => (s ? all.filter((m) => m.status === s).length : all.length);

  return (
    <>
      <PageHeader title="Messages" lead={`${count("unread")} unread of ${all.length}`} />
      <nav
        aria-label="Message filter"
        className="-mx-4 mb-4 flex scrollbar-none gap-2 overflow-x-auto px-4"
      >
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={f.id ? `/admin/messages?status=${f.id}` : "/admin/messages"}
            aria-current={status === f.id ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-sm border px-4 text-base no-underline ${status === f.id ? "border-primary bg-selected font-medium text-ink" : "border-control text-muted"}`}
          >
            {f.label} ({count(f.id)})
          </Link>
        ))}
      </nav>
      <FilterBar
        action="/admin/messages"
        search={{
          name: "q",
          label: "Search messages",
          value: q,
          placeholder: "Name, email, order or words",
        }}
        extra={status ? <input type="hidden" name="status" value={status} /> : null}
      />
      {shown.length === 0 ? (
        <p className="border border-line bg-surface p-6 text-center text-base text-muted">
          No messages match.
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface">
          {shown.map((m) => {
            const latest = m.replies.at(-1);
            const preview = (
              latest ? `${latest.from === "staff" ? "You: " : ""}${latest.body}` : m.body
            ).slice(0, 90);
            return (
              <li key={m.id}>
                <Link
                  href={`/admin/messages/${m.id}`}
                  className="flex min-h-16 items-start gap-3 p-3 text-ink no-underline hover:bg-tint"
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-medium"
                  >
                    {m.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-base ${m.status === "unread" ? "font-semibold" : ""}`}
                      >
                        {m.name}
                      </span>
                      <span className="shrink-0 text-sm text-subtle">
                        {relativeTime(m.receivedAt)}
                      </span>
                    </span>
                    <span className="block truncate text-sm text-muted">{m.subject}</span>
                    <span className="block truncate text-sm text-subtle">{preview}</span>
                  </span>
                  <Badge
                    tone={
                      m.status === "unread"
                        ? "info"
                        : m.status === "replied"
                          ? "success"
                          : "neutral"
                    }
                  >
                    {m.status === "unread" ? "New" : m.status === "replied" ? "Replied" : "Read"}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <Pager
        base="/admin/messages"
        params={{ status, q }}
        page={pageNumber}
        perPage={PER_PAGE}
        total={rows.length}
      />
    </>
  );
}

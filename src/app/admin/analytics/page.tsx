import type { Metadata } from "next";
import Link from "next/link";
import { BarChart, TallyList } from "@/features/admin/Charts";
import { PageHeader, Panel } from "@/features/admin/PageHeader";
import { formatNaira } from "@/lib/money";
import { requireStaff } from "@/server/auth/session";
import { data } from "@/server/data";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";
const PERIODS = [7, 30, 90] as const;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireStaff("analytics.view", "/admin/analytics");
  const { days: raw } = await searchParams;
  const days = PERIODS.find((d) => String(d) === raw) ?? 30;
  const report = await data.admin.analytics(days);
  const figures = [
    ["Page views", report.pageViews.toLocaleString("en-GB")],
    ["Customers", String(report.customers)],
    ["Orders", String(report.orders)],
    ["Revenue", formatNaira(report.revenueNgn)],
    ["Orders per customer", (report.conversionPercent / 100).toFixed(1)],
  ] as const;
  return (
    <>
      <PageHeader title="Analytics" lead="How the shop is doing." />
      <nav aria-label="Period" className="mb-5 flex gap-2">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={`/admin/analytics?days=${d}`}
            aria-current={d === days ? "page" : undefined}
            className={`inline-flex min-h-11 min-w-20 items-center justify-center rounded-sm border px-4 text-base no-underline ${d === days ? "border-primary bg-selected font-medium text-ink" : "border-control text-muted"}`}
          >
            {d} days
          </Link>
        ))}
      </nav>
      {report.sample ? (
        <p
          className="mb-5 border-l-4 border-warning bg-warning-bg p-3 text-base"
          data-testid="sample-note"
        >
          <strong className="font-medium">Sample figures.</strong> Visits, devices and browsers are
          invented for this build. Orders and revenue come from the demonstration orders. Real
          figures appear once the database is connected.
        </p>
      ) : null}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {figures.map(([label, value]) => (
          <div key={label} className="min-w-0 border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 font-display text-[1.625rem] leading-none [overflow-wrap:anywhere] lining-nums tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Revenue each day">
          <BarChart
            days={report.series}
            value={(d) => d.revenueNgn}
            label="Revenue from delivered orders"
            format={formatNaira}
          />
        </Panel>
        <Panel title="Visits each day">
          <BarChart
            days={report.series}
            value={(d) => d.views}
            label="Page views"
            format={(n) => n.toLocaleString("en-GB")}
          />
        </Panel>
        <Panel title="Orders by status">
          <TallyList rows={report.statusBreakdown} />
        </Panel>
        <Panel title="Best sellers">
          <TallyList rows={report.topProducts} empty="No sales yet." />
        </Panel>
        <Panel title="Most viewed pages">
          <TallyList rows={report.topPages} />
        </Panel>
        <Panel title="Where orders go">
          <TallyList rows={report.states} />
        </Panel>
        <Panel title="Devices">
          <TallyList rows={report.devices} />
        </Panel>
        <Panel title="Browsers">
          <TallyList rows={report.browsers} />
        </Panel>
      </div>
      <p className="mt-6 text-sm text-muted">
        Revenue counts delivered orders only. Orders per customer is orders divided by registered
        customers.{" "}
        <Link href="/admin/export/orders" prefetch={false}>
          Export orders (CSV)
        </Link>
      </p>
    </>
  );
}

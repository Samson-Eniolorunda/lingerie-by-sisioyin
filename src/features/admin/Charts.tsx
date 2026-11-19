import { formatNaira } from "@/lib/money";
import type { AnalyticsDay, Tally } from "@/server/data/contracts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-21" as "21 Oct"; anything else is shown as it came. */
export function shortDate(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(iso);
  const month = m ? MONTHS[Number(m[1]) - 1] : undefined;
  return m && month ? `${Number(m[2])} ${month}` : iso;
}

/** Bars as server-rendered SVG: flat colour from the theme, a text summary for screen readers, no script. */
export function BarChart({
  days,
  value,
  label,
  format,
  empty = "Nothing yet.",
}: {
  readonly days: readonly AnalyticsDay[];
  readonly value: (d: AnalyticsDay) => number;
  readonly label: string;
  readonly format: (n: number) => string;
  /** Shown instead of a chart when every day is zero. */
  readonly empty?: string;
}) {
  const total = days.reduce((n, d) => n + value(d), 0);
  if (days.length === 0 || total === 0)
    return (
      <figure>
        <p className="py-10 text-center text-base text-muted">{empty}</p>
      </figure>
    );
  const max = Math.max(1, ...days.map(value));
  const peak = days.findIndex((d) => value(d) === max);
  const w = 600;
  const h = 160;
  const gap = days.length > 40 ? 1 : 3;
  const bar = (w - gap * (days.length - 1)) / days.length;
  // The peak label is HTML over the chart (SVG text would shrink to about 6 px on phones).
  const peakX = ((peak * (bar + gap) + bar / 2) / w) * 100;
  return (
    <figure>
      <div className="relative pt-5">
        <svg
          viewBox={`0 0 ${w} ${h + 2}`}
          role="img"
          aria-label={`${label}: ${format(total)} over ${days.length} days, highest day ${format(max)}.`}
          className="h-auto w-full text-primary"
        >
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={w}
              y1={Math.round(h - f * (h - 8))}
              y2={Math.round(h - f * (h - 8))}
              stroke="var(--c-rule)"
              opacity="0.45"
            />
          ))}
          <line x1="0" x2={w} y1={h} y2={h} stroke="var(--c-rule)" />
          {days.map((d, i) => {
            const bh = Math.round((value(d) / max) * (h - 8));
            return (
              <rect
                key={d.date}
                x={i * (bar + gap)}
                y={h - bh}
                width={bar}
                height={bh}
                fill="currentColor"
                opacity={value(d) === 0 ? 0.25 : 1}
              >
                <title>{`${shortDate(d.date)}: ${format(value(d))}`}</title>
              </rect>
            );
          })}
        </svg>
        <span
          aria-hidden="true"
          className="tabular absolute top-0 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-ink"
          style={{ left: `${Math.min(88, Math.max(12, peakX))}%` }}
        >
          {format(max)}
        </span>
      </div>
      {/* Axis dates are HTML, not SVG text: the SVG scales down on phones and made them about 6 px. */}
      <div aria-hidden="true" className="mt-1 flex justify-between text-xs text-muted">
        <span>{shortDate(days[0]?.date ?? "")}</span>
        <span>{shortDate(days.at(-1)?.date ?? "")}</span>
      </div>
      <figcaption className="mt-1 text-sm text-muted">
        {label}. Highest day {format(max)}, {shortDate(days[peak]?.date ?? "")}.
      </figcaption>
    </figure>
  );
}

export function TallyList({
  rows,
  empty = "Nothing yet.",
  money,
}: {
  readonly rows: readonly Tally[];
  readonly empty?: string;
  readonly money?: boolean;
}) {
  if (rows.length === 0) return <p className="text-base text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-base">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="tabular shrink-0 text-muted">
              {money ? formatNaira(r.value) : r.value.toLocaleString("en-GB")}
            </span>
          </div>
          <div aria-hidden="true" className="mt-1 h-1.5 bg-tint">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

import { formatNaira } from "@/lib/money";
import type { AnalyticsDay, Tally } from "@/server/data/contracts";

/** Bars as server-rendered SVG: flat colour from the theme, a text summary for screen readers, no script. */
export function BarChart({
  days,
  value,
  label,
  format,
}: {
  readonly days: readonly AnalyticsDay[];
  readonly value: (d: AnalyticsDay) => number;
  readonly label: string;
  readonly format: (n: number) => string;
}) {
  const max = Math.max(1, ...days.map(value));
  const total = days.reduce((n, d) => n + value(d), 0);
  const w = 600;
  const h = 160;
  const gap = days.length > 40 ? 1 : 3;
  const bar = (w - gap * (days.length - 1)) / days.length;
  return (
    <figure>
      <svg
        viewBox={`0 0 ${w} ${h + 22}`}
        role="img"
        aria-label={`${label}: ${format(total)} over ${days.length} days, highest day ${format(max)}.`}
        className="h-auto w-full text-primary"
      >
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
              <title>{`${d.date}: ${format(value(d))}`}</title>
            </rect>
          );
        })}
        <text x="0" y={h + 16} fontSize="11" fill="var(--c-muted)">
          {days[0]?.date.slice(5)}
        </text>
        <text x={w} y={h + 16} fontSize="11" textAnchor="end" fill="var(--c-muted)">
          {days.at(-1)?.date.slice(5)}
        </text>
      </svg>
      <figcaption className="mt-1 text-sm text-muted">
        {label}. Highest day {format(max)}.
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

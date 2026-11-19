import Link from "next/link";
import { Button } from "@/components/ui/Button";

/** A plain GET form: it works without scripts and keeps the filters in the address. */
export function FilterBar({
  action,
  search,
  select,
  extra,
}: {
  readonly action: string;
  readonly search: { name: string; label: string; value: string; placeholder: string };
  readonly select?: {
    name: string;
    label: string;
    value: string;
    options: readonly { value: string; label: string }[];
  };
  readonly extra?: React.ReactNode;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-medium">
        {search.label}
        <input
          type="search"
          name={search.name}
          defaultValue={search.value}
          placeholder={search.placeholder}
          enterKeyHint="search"
          className="min-h-12 w-full rounded-sm border border-control bg-surface px-3 text-base font-normal"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:contents">
        {select ? (
          <label className="flex flex-col gap-1.5 text-sm font-medium sm:w-56">
            {select.label}
            <select
              name={select.name}
              defaultValue={select.value}
              className="min-h-12 w-full rounded-sm border border-control bg-surface px-3 text-base font-normal"
            >
              {select.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {extra}
      </div>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}

export function Pager({
  base,
  params,
  page,
  perPage,
  total,
}: {
  readonly base: string;
  readonly params: Readonly<Record<string, string>>;
  readonly page: number;
  readonly perPage: number;
  readonly total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const href = (n: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== ""));
    if (n > 1) query.set("page", String(n));
    const text = query.toString();
    return text ? `${base}?${text}` : base;
  };
  const linkClass =
    "inline-flex min-h-11 min-w-24 items-center justify-center rounded-sm border border-control px-4 text-base no-underline text-ink hover:bg-tint";
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={linkClass}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted">
        Page {page} of {pages}
      </p>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={linkClass}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

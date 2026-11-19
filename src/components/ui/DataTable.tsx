import type { ReactNode } from "react";

export interface Column<T> {
  readonly key: string;
  readonly label: string;
  readonly cell: (row: T) => ReactNode;
  /** The card's heading on phones: shown without a label. */
  readonly title?: boolean;
  /** Action buttons: shown without a label and aligned to the right on phones. */
  readonly actions?: boolean;
  readonly align?: "right";
}

/**
 * A table from 768 px that becomes a stack of cards on phones, each value carrying its label. The
 * ARIA roles are explicit because the card layout changes the display of the table elements.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
}: {
  readonly caption: string;
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly empty: ReactNode;
}) {
  if (rows.length === 0)
    return (
      <div className="border border-line bg-surface p-6 text-center text-base text-muted">
        {empty}
      </div>
    );
  return (
    <table className="data-table" role="table" aria-label={caption}>
      <thead role="rowgroup">
        <tr role="row">
          {columns.map((c) => (
            <th
              key={c.key}
              role="columnheader"
              scope="col"
              className={c.align ? "!text-right" : ""}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody role="rowgroup">
        {rows.map((row) => (
          <tr key={rowKey(row)} role="row">
            {columns.map((c) => (
              <td
                key={c.key}
                role="cell"
                data-label={c.label}
                {...(c.title
                  ? { "data-card": "title" }
                  : c.actions
                    ? { "data-card": "actions" }
                    : {})}
                className={c.align ? "sm:text-right" : ""}
              >
                {c.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

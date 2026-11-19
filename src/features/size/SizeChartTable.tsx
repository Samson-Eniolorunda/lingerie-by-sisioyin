"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { SizeChart } from "@/data/size-charts";

/**
 * Fits 360 px with no sideways scroll: below 768 px a chart that carries both units shows one at a
 * time behind a cm / in control (centimetres first); from 768 px both sit side by side as before.
 */
export function SizeChartTable({ chart }: { readonly chart: SizeChart }) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  return (
    <div>
      {chart.hasInches ? (
        <div
          role="radiogroup"
          aria-label="Units"
          className="mb-3 inline-flex rounded-sm border border-control md:hidden"
        >
          {(["cm", "in"] as const).map((u) => (
            <button
              key={u}
              type="button"
              role="radio"
              aria-checked={unit === u}
              onClick={() => setUnit(u)}
              className={cn(
                "min-h-11 min-w-16 px-4 text-base",
                unit === u ? "bg-selected font-medium" : "text-muted",
              )}
            >
              {u === "cm" ? "cm" : "inches"}
            </button>
          ))}
        </div>
      ) : null}
      <table className="w-full table-fixed border-collapse text-sm md:text-base">
        <caption className="sr-only">{chart.title} size chart</caption>
        <thead>
          <tr className="border-b border-rule text-left text-subtle">
            {chart.columns.map((col, i) => (
              <th
                key={`${col.label}-${col.unit ?? i}`}
                scope="col"
                className={cn(
                  "px-1 py-2 font-medium",
                  i === 0 && "w-14",
                  col.unit && unit !== col.unit && "hidden md:table-cell",
                )}
              >
                {col.unit ? `${col.label} (${col.unit})` : col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row[0]} className="border-b border-line">
              {row.map((cell, i) => {
                const col = chart.columns[i];
                const hidden = col?.unit && unit !== col.unit ? "hidden md:table-cell" : "";
                return i === 0 ? (
                  <th key={i} scope="row" className="tabular px-1 py-3 text-left font-semibold">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className={cn("tabular px-1 py-3", hidden)}>
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

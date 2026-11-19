"use client";

import { useState } from "react";
import { clampRange, parseBound } from "@/lib/price-range";
import { formatNaira } from "@/lib/money";

const STEP = 1000;
const number = "min-h-12 w-full rounded-sm border border-control bg-surface px-3 text-base";

/**
 * Two numeric fields and a dual slider that move together. The fields carry the form names, so the
 * filter works without scripts; the sliders are an addition and are not submitted.
 */
export function PriceRange({
  idPrefix,
  ceiling,
  initialMin,
  initialMax,
}: {
  readonly idPrefix: string;
  readonly ceiling: number;
  readonly initialMin: number | undefined;
  readonly initialMax: number | undefined;
}) {
  const [range, setRange] = useState({ min: initialMin ?? 0, max: initialMax ?? ceiling });
  const [minText, setMinText] = useState(initialMin === undefined ? "" : String(initialMin));
  const [maxText, setMaxText] = useState(initialMax === undefined ? "" : String(initialMax));

  function fromSlider(which: "min" | "max", value: number) {
    const next = clampRange({ ...range, [which]: value }, which, ceiling);
    setRange(next);
    setMinText(next.min === 0 ? "" : String(next.min));
    setMaxText(next.max === ceiling ? "" : String(next.max));
  }
  function fromText(which: "min" | "max", text: string) {
    if (which === "min") setMinText(text);
    else setMaxText(text);
    const value = parseBound(text, which === "min" ? 0 : ceiling);
    setRange(clampRange({ ...range, [which]: value }, which, ceiling));
  }

  const left = (range.min / ceiling) * 100;
  const right = (range.max / ceiling) * 100;

  return (
    <div>
      <div className="relative mx-3 mt-3 mb-1 h-11">
        <div aria-hidden="true" className="absolute top-1/2 h-1 w-full -translate-y-1/2 bg-rule" />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-1 -translate-y-1/2 bg-primary"
          style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
        />
        {(["min", "max"] as const).map((which) => (
          <input
            key={which}
            type="range"
            min={0}
            max={ceiling}
            step={STEP}
            value={range[which]}
            aria-label={which === "min" ? "Lowest price" : "Highest price"}
            aria-valuetext={formatNaira(range[which])}
            onChange={(e) => fromSlider(which, Number(e.target.value))}
            className="dual-range pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent"
          />
        ))}
      </div>
      <p className="tabular text-center text-sm text-muted" aria-live="polite">
        {formatNaira(range.min)} to{" "}
        {range.max >= ceiling ? `${formatNaira(ceiling)}+` : formatNaira(range.max)}
      </p>
      <div className="mt-3 flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor={`${idPrefix}-min`} className="text-sm text-muted">
            From
          </label>
          <input
            id={`${idPrefix}-min`}
            name="min"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="0"
            value={minText}
            onChange={(e) => fromText("min", e.target.value)}
            className={number}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`${idPrefix}-max`} className="text-sm text-muted">
            To
          </label>
          <input
            id={`${idPrefix}-max`}
            name="max"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder={String(ceiling)}
            value={maxText}
            onChange={(e) => fromText("max", e.target.value)}
            className={number}
          />
        </div>
      </div>
    </div>
  );
}

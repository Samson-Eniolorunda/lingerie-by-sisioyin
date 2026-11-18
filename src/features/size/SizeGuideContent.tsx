"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Tabs } from "@/components/ui/Tabs";
import { SIZE_CHARTS, type ChartId } from "@/data/size-charts";
import { BraCalculator } from "./BraCalculator";
import { SizeChartTable } from "./SizeChartTable";

/** The charts and calculator, shared by the /size page and the sheet opened from a product. */
export function SizeGuideContent({
  initial = "bras",
  showPageLink,
}: {
  readonly initial?: ChartId;
  readonly showPageLink?: boolean;
}) {
  const [active, setActive] = useState<ChartId>(initial);
  const base = useId();
  const chart = SIZE_CHARTS.find((c) => c.id === active) ?? SIZE_CHARTS[0];
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${base}-charts`}>
        <h3 id={`${base}-charts`} className="font-sans text-lg font-semibold">
          Size charts
        </h3>
        <Tabs
          label="Size charts"
          items={SIZE_CHARTS.map((c) => ({ id: c.id, label: c.title }))}
          value={active}
          onChange={(id) => setActive(id as ChartId)}
          className="mt-2"
        />
        {chart ? (
          <div role="tabpanel" className="mt-3">
            <SizeChartTable key={chart.id} chart={chart} />
          </div>
        ) : null}
      </section>
      <section aria-labelledby={`${base}-calc`}>
        <h3 id={`${base}-calc`} className="font-sans text-lg font-semibold">
          Bra size calculator
        </h3>
        <p className="mt-1 mb-3 text-base text-muted">
          Measure in centimetres over a lightweight bra, with a soft tape that is snug but not
          tight.
        </p>
        <BraCalculator />
      </section>
      {showPageLink ? (
        <p className="text-base">
          <Link href="/size">Open the full size guide</Link>
        </p>
      ) : null}
    </div>
  );
}

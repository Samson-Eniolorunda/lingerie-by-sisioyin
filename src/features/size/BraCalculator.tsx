"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { BRA_LIMITS, calculateBraSize, type BraSizeResult } from "@/lib/bra-size";

function parseCm(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value.replace(",", "."));
}

export function BraCalculator() {
  const [underbust, setUnderbust] = useState("");
  const [bust, setBust] = useState("");
  const [result, setResult] = useState<BraSizeResult | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(calculateBraSize(parseCm(underbust), parseCm(bust)));
      }}
    >
      <TextField
        label="Underbust (cm)"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="next"
        hint={`Between ${BRA_LIMITS.underbust.min} and ${BRA_LIMITS.underbust.max} cm`}
        value={underbust}
        onChange={(e) => setUnderbust(e.target.value)}
        error={result && !result.ok && result.field === "underbust" ? result.message : undefined}
      />
      <TextField
        label="Bust (cm)"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        hint={`Between ${BRA_LIMITS.bust.min} and ${BRA_LIMITS.bust.max} cm`}
        value={bust}
        onChange={(e) => setBust(e.target.value)}
        error={result && !result.ok && result.field === "bust" ? result.message : undefined}
      />
      <Button type="submit" block>
        Find my size
      </Button>
      <div aria-live="polite">
        {result?.ok ? (
          <p className="border-l-4 border-primary bg-primary-tint px-4 py-3 text-base">
            Your estimated size is <strong className="tabular text-xl">{result.label}</strong>.
            {result.inChart
              ? null
              : " This size is not in our printed chart, so message us on WhatsApp before you order."}
          </p>
        ) : null}
        {result && !result.ok && result.field === "both" ? (
          <p className="text-sm font-medium text-error">{result.message}</p>
        ) : null}
      </div>
    </form>
  );
}

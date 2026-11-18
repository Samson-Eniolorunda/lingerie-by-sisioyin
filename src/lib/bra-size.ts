import { BRA_CHART_SIZES } from "@/data/size-charts";

export type BraSizeResult =
  | {
      readonly ok: true;
      readonly band: number;
      readonly cup: string;
      readonly label: string;
      /** False when the size is not one of the sizes printed in the shop's bra chart. */
      readonly inChart: boolean;
    }
  | { readonly ok: false; readonly field: "underbust" | "bust" | "both"; readonly message: string };

const CUPS = ["A", "B", "C", "D", "DD", "E"] as const;

export const BRA_LIMITS = {
  underbust: { min: 55, max: 120 },
  bust: { min: 60, max: 140 },
} as const;

/**
 * Band from underbust in 5 cm steps (30 to 42), cup from the difference between
 * bust and underbust in 3 cm steps. Measurements are in centimetres. The result is limited to sizes
 * the shop's chart lists, so the calculator never offers a size the customer cannot buy.
 */
export function calculateBraSize(underbustCm: number, bustCm: number): BraSizeResult {
  const { underbust, bust } = BRA_LIMITS;
  if (!Number.isFinite(underbustCm) || !Number.isFinite(bustCm)) {
    return { ok: false, field: "both", message: "Enter both measurements in centimetres." };
  }
  if (underbustCm < underbust.min || underbustCm > underbust.max) {
    return {
      ok: false,
      field: "underbust",
      message: `Underbust should be between ${underbust.min} and ${underbust.max} cm.`,
    };
  }
  if (bustCm < bust.min || bustCm > bust.max) {
    return {
      ok: false,
      field: "bust",
      message: `Bust should be between ${bust.min} and ${bust.max} cm.`,
    };
  }
  if (bustCm < underbustCm) {
    return { ok: false, field: "bust", message: "Bust must not be smaller than underbust." };
  }
  const band = bandFor(underbustCm);
  const diff = bustCm - underbustCm;
  const cupIndex = diff < 11 ? 0 : Math.min(CUPS.length - 1, Math.floor((diff - 11) / 3) + 1);
  const cup = CUPS[cupIndex] ?? "A";
  const label = `${band}${cup}`;
  return { ok: true, band, cup, label, inChart: BRA_CHART_SIZES.has(label) };
}

function bandFor(underbustCm: number): number {
  if (underbustCm < 68) return 30;
  const steps = Math.floor((underbustCm - 68) / 5);
  return Math.min(42, 32 + steps * 2);
}

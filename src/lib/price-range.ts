export interface Range {
  readonly min: number;
  readonly max: number;
}

/** Keeps a price range inside 0 to `ceiling` with the lower end never above the upper end (S-04). `moved` says which end the person dragged, so it wins. */
export function clampRange(next: Range, moved: "min" | "max", ceiling: number): Range {
  const min = Math.max(0, Math.min(ceiling, Math.round(next.min)));
  const max = Math.max(0, Math.min(ceiling, Math.round(next.max)));
  if (min <= max) return { min, max };
  return moved === "min" ? { min, max: min } : { min: max, max };
}

/** Blank text means "no limit": from 0, up to the ceiling. */
export function parseBound(text: string, fallback: number): number {
  const digits = text.replace(/[^\d]/g, "");
  return digits === "" ? fallback : Number.parseInt(digits, 10);
}

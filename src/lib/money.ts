const formatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** Formats whole naira, for example `₦1,250,000`. */
export function formatNaira(amount: number): string {
  return formatter.format(Math.round(amount)).replace(/ /g, "");
}

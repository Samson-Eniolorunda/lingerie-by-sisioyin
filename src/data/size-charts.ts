export type ChartId = "bras" | "panties" | "loungewear" | "bodysuits";

export interface ChartColumn {
  readonly label: string;
  /** Present on measurement columns that exist in both units, so a phone can show one at a time. */
  readonly unit?: "cm" | "in";
}

export interface SizeChart {
  readonly id: ChartId;
  readonly title: string;
  readonly columns: readonly ChartColumn[];
  readonly rows: readonly (readonly string[])[];
  readonly hasInches: boolean;
}

/** Figures carried over unchanged from the live size guide (plan P-16). */
export const SIZE_CHARTS: readonly SizeChart[] = [
  {
    id: "bras",
    title: "Bras",
    hasInches: true,
    columns: [
      { label: "Size" },
      { label: "Underbust", unit: "cm" },
      { label: "Underbust", unit: "in" },
      { label: "Cup" },
      { label: "Bust (cm)" },
    ],
    rows: [
      ["32A", "68-72", "27-28", "A", "79-81"],
      ["32B", "68-72", "27-28", "B", "81-83"],
      ["34A", "73-77", "29-30", "A", "84-86"],
      ["34B", "73-77", "29-30", "B", "86-88"],
      ["36B", "78-82", "31-32", "B", "91-93"],
      ["36C", "78-82", "31-32", "C", "93-95"],
      ["38C", "83-87", "33-34", "C", "98-100"],
      ["38D", "83-87", "33-34", "D", "100-102"],
    ],
  },
  {
    id: "panties",
    title: "Panties",
    hasInches: true,
    columns: [
      { label: "Size" },
      { label: "Waist", unit: "cm" },
      { label: "Waist", unit: "in" },
      { label: "Hips", unit: "cm" },
      { label: "Hips", unit: "in" },
    ],
    rows: [
      ["XS", "60-64", "24-25", "84-88", "33-35"],
      ["S", "65-69", "26-27", "89-93", "35-37"],
      ["M", "70-74", "28-29", "94-98", "37-39"],
      ["L", "75-79", "30-31", "99-103", "39-41"],
      ["XL", "80-85", "32-33", "104-109", "41-43"],
      ["XXL", "86-92", "34-36", "110-116", "43-46"],
    ],
  },
  {
    id: "bodysuits",
    title: "Bodysuits",
    hasInches: false,
    columns: [
      { label: "Size" },
      { label: "Bust (cm)" },
      { label: "Waist (cm)" },
      { label: "Hips (cm)" },
      { label: "Torso (cm)" },
    ],
    rows: [
      ["XS", "80-84", "60-64", "84-88", "58-60"],
      ["S", "85-89", "65-69", "89-93", "60-62"],
      ["M", "90-94", "70-74", "94-98", "62-64"],
      ["L", "95-99", "75-79", "99-103", "64-66"],
      ["XL", "100-105", "80-85", "104-109", "66-68"],
    ],
  },
  {
    id: "loungewear",
    title: "Loungewear",
    hasInches: false,
    columns: [
      { label: "Size" },
      { label: "Bust (cm)" },
      { label: "Waist (cm)" },
      { label: "Hips (cm)" },
      { label: "UK size" },
    ],
    rows: [
      ["XS", "80-84", "60-64", "86-90", "6"],
      ["S", "85-89", "65-69", "91-95", "8"],
      ["M", "90-94", "70-74", "96-100", "10"],
      ["L", "95-99", "75-79", "101-105", "12"],
      ["XL", "100-105", "80-85", "106-111", "14"],
      ["XXL", "106-112", "86-92", "112-118", "16"],
    ],
  },
];

export const BRA_CHART_SIZES: ReadonlySet<string> = new Set(
  (SIZE_CHARTS.find((c) => c.id === "bras")?.rows ?? []).map((row) => row[0] ?? ""),
);

/** The chart a product's category points to by default. */
export function chartForCategory(category: string, productName = ""): ChartId {
  const name = productName.toLowerCase();
  if (name.includes("bodysuit")) return "bodysuits";
  if (category === "Loungewear") return "loungewear";
  if (category === "Underwear") return "panties";
  return "bras";
}

const SWATCHES: Readonly<Record<string, string>> = {
  black: "#1c1517",
  white: "#ffffff",
  nude: "#d9b99b",
  wine: "#6b1f2e",
  champagne: "#e6d3b3",
  oatmeal: "#d8c9ae",
  charcoal: "#3d3d40",
  sage: "#9aa88f",
  cream: "#f3ead3",
  navy: "#1f2b4a",
  rust: "#a24b2a",
  stone: "#b9b0a3",
  olive: "#6b6b3a",
  grey: "#8c8c8c",
  pink: "#e8b4bf",
  ivory: "#f5efe0",
  red: "#a12a2a",
  blue: "#2f5570",
  green: "#2f6b4a",
  brown: "#6a4a36",
  beige: "#d8c5a8",
};

/** A swatch colour for a colour name, or undefined when the name is not one we know (the name is always shown too). */
export function swatchFor(name: string): string | undefined {
  return SWATCHES[name.trim().toLowerCase()];
}

/** "1 item", "3 items": the count with the noun in the right number. */
export function countOf(n: number, singular: string, plural = `${singular}s`): string {
  return `${n.toLocaleString("en-GB")} ${n === 1 ? singular : plural}`;
}

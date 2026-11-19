import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

const ROUTES = [
  "/",
  "/shop",
  "/products/lace-balconette-bra",
  "/cart",
  "/checkout",
  "/track",
  "/wishlist",
  "/faq",
  "/size",
  "/contact",
  "/privacy",
  "/terms",
  "/dashboard",
  "/no-such-page",
];

for (const theme of ["light", "dark"] as const) {
  for (const route of ROUTES) {
    test(`axe WCAG 2.2 AA: ${route} (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("LBS_THEME", t), theme);
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
        ),
      ).toEqual([]);
    });
  }
}

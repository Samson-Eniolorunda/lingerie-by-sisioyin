import { expect, test } from "@playwright/test";
import { horizontalOverflow, PHONE_WIDTHS } from "./helpers";

const ROUTES = [
  "/",
  "/shop",
  "/shop?category=Lingerie&sort=price-asc",
  "/products/ribbed-lounge-set",
  "/products/satin-slip-nightdress",
];

for (const width of PHONE_WIDTHS) {
  for (const route of ROUTES) {
    test(`no horizontal scroll at ${width}px on ${route}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(route);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
}

test("zoom is allowed and body text is 16 px", async ({ page }) => {
  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/user-scalable=no|maximum-scale/);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontSize)).toBe("16px");
});

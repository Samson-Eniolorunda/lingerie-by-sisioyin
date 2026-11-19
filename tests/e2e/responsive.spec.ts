import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { DEMO_CUSTOMER, DEMO_OWNER, horizontalOverflow, signInAs, smallTargets } from "./helpers";

const WIDTHS = [360, 390, 430, 768, 1280, 1536] as const;
const THEMES = ["light", "dark"] as const;

const STORE = [
  "/",
  "/shop",
  "/products/ribbed-lounge-set",
  "/cart",
  "/checkout",
  "/track",
  "/contact",
];
const ACCOUNT = ["/dashboard", "/dashboard/orders", "/dashboard/profile", "/dashboard/addresses"];
const ADMIN = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/customers",
  "/admin/messages",
  "/admin/analytics",
  "/admin/promos",
  "/admin/settings",
  "/admin/team",
  "/admin/activity",
];

async function setTheme(page: Page, theme: "light" | "dark") {
  await page.addInitScript((t) => window.localStorage.setItem("LBS_THEME", t), theme);
}

/** Where a primary and a secondary button share a row, the primary must be the rightmost. */
async function buttonOrderViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const primaries = [
      ...document.querySelectorAll<HTMLElement>("button.bg-primary, a.bg-primary"),
    ].filter(visible);
    const out: string[] = [];
    for (const p of primaries) {
      const row = p.parentElement?.parentElement ?? p.parentElement;
      if (!row) continue;
      const pr = p.getBoundingClientRect();
      for (const s of row.querySelectorAll<HTMLElement>(
        "button.border-control, a.border-control",
      )) {
        if (!visible(s) || s.closest("[role='radiogroup'], [role='tablist']")) continue;
        const sr = s.getBoundingClientRect();
        if (Math.abs(sr.top - pr.top) < 8 && sr.right > pr.right + 1)
          out.push(
            `"${(p.textContent ?? "").trim()}" is left of "${(s.textContent ?? "").trim()}"`,
          );
      }
    }
    return out;
  });
}

test.describe("responsive matrix", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "runs once, in the desktop project, with explicit viewports",
  );
  test.setTimeout(180_000);

  for (const theme of THEMES) {
    for (const width of WIDTHS) {
      test(`storefront, account and admin at ${width}px, ${theme}`, async ({ page }) => {
        await setTheme(page, theme);
        await page.setViewportSize({ width, height: 800 });
        const phone = width < 1024;
        const check = async (route: string) => {
          await page.goto(route);
          expect(await horizontalOverflow(page), `${route} overflows`).toBeLessThanOrEqual(0);
          if (phone) expect(await smallTargets(page), `${route} small targets`).toEqual([]);
          if (width <= 430)
            expect(await buttonOrderViolations(page), `${route} button order`).toEqual([]);
        };
        for (const r of STORE) await check(r);
        await signInAs(page, DEMO_CUSTOMER);
        await page.waitForURL("**/dashboard");
        for (const r of ACCOUNT) await check(r);
        await page.context().clearCookies();
        await signInAs(page, DEMO_OWNER, "/admin/sign-in");
        await page.waitForURL("**/admin");
        for (const r of ADMIN) await check(r);
      });
    }
  }
});

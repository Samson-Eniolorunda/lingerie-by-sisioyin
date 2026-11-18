import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = process.env.OUT ?? "screenshots";
const widths = [360, 390, 430, 768, 1280, 1536];
const routes = (process.env.ROUTES ?? "/,/shop,/products/lace-balconette-bra").split(",");
const themes = ["light", "dark"];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? undefined });
const problems = [];
for (const theme of themes) {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width < 768 ? 844 : 900 },
      deviceScaleFactor: 1,
      hasTouch: width < 768,
      colorScheme: theme,
    });
    await context.addInitScript((t) => localStorage.setItem("LBS_THEME", t), theme);
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(base + route, { waitUntil: "load" });
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0)
        problems.push(`${route} @${width} ${theme}: horizontal overflow ${overflow}px`);
      const name = route === "/" ? "home" : route.replace(/^\//, "").replace(/[/?=&]/g, "-");
      await page.screenshot({ path: `${out}/${name}-${width}-${theme}.png`, fullPage: false });
    }
    await context.close();
  }
}
await browser.close();
process.stdout.write(problems.length ? `${problems.join("\n")}\n` : "no horizontal overflow\n");

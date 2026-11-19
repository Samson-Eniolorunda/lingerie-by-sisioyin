// Renders the PLACEHOLDER app icons from SVG with the Playwright browser. Replace the SVG with the
// real logo (plan 9.4) and run `node scripts/make-icons.mjs` again.
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const tile = (
  size,
  pad,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" fill="#A62B5E"/>
<text x="256" y="${256 + 74 - pad / 2}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${220 - pad}" fill="#FFFFFF">L</text>
<text x="256" y="${400 - pad / 2}" text-anchor="middle" font-family="Georgia, serif" font-size="${34 - pad / 6}" letter-spacing="6" fill="#E8DBCD">PLACEHOLDER</text>
</svg>`;

const jobs = [
  ["public/icons/icon-192.png", 192, 0],
  ["public/icons/icon-512.png", 512, 0],
  ["public/icons/icon-maskable-512.png", 512, 60],
  ["public/icons/apple-touch-icon.png", 180, 0],
];
const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#A62B5E"/>
<text x="600" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="96" letter-spacing="14" fill="#FFFFFF">LINGERIE</text>
<text x="600" y="370" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="44" letter-spacing="8" fill="#E8DBCD">by Sisioyin</text>
<text x="600" y="560" text-anchor="middle" font-family="Georgia, serif" font-size="26" letter-spacing="6" fill="#E8DBCD">PLACEHOLDER SHARING IMAGE</text>
</svg>`;
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const [file, size, pad] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${tile(size, pad)}</body>`);
  writeFileSync(file, await page.screenshot({ type: "png" }));
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<body style="margin:0">${og}</body>`);
writeFileSync("public/og-placeholder.png", await page.screenshot({ type: "png" }));
await browser.close();

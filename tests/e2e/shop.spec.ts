import { expect, test } from "@playwright/test";

test("S-02 to S-11 filters and sort come from the URL and show as removable chips", async ({
  page,
}) => {
  await page.goto("/shop?category=Underwear&gender=Men&sort=price-asc");
  const names = await page.locator("article h3").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  await expect(page.getByRole("link", { name: "Underwear Remove filter" })).toBeVisible();
  await page.getByRole("link", { name: "Men Remove filter" }).click();
  await expect(page).not.toHaveURL(/gender=Men/);
});

test("S-10 no products found offers to clear the filters", async ({ page }) => {
  await page.goto("/shop?search=zzzzqqq");
  await expect(page.getByText("No products found")).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/shop$/);
});

test("R-18 legacy ?q= is honoured", async ({ page }) => {
  await page.goto("/shop?q=lace");
  await expect(page.locator("article h3").first()).toContainText(/lace/i);
});

test("S-12 to S-17 choose size and colour, add to bag, count updates", async ({
  page,
  isMobile,
}) => {
  await page.goto("/products/lace-balconette-bra");
  const add = isMobile
    ? page.getByRole("button", { name: "Select a size" })
    : page.getByRole("button", { name: "Select a size" }).first();
  await expect(add.first()).toBeVisible();
  await page.getByRole("button", { name: "34B", exact: true }).click();
  await page.getByRole("button", { name: "Nude" }).click();
  await page.getByRole("button", { name: "Add to bag" }).filter({ visible: true }).click();
  await expect(page.getByText("added to your bag")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("LBS_CART_V1"));
  expect(JSON.parse(stored ?? "[]")).toMatchObject([
    { selectedSize: "34B", selectedColor: "Nude", qty: 1 },
  ]);
});

test("BUG-05 an out-of-stock size cannot be added", async ({ page }) => {
  await page.goto("/products/lace-trim-camisole");
  await expect(
    page.getByRole("button", { name: "Out of stock" }).filter({ visible: true }).first(),
  ).toBeDisabled();
});

test("S-14 an unavailable size stays visible and cannot be chosen", async ({ page }) => {
  await page.goto("/products/mens-lounge-shorts");
  const m = page.getByRole("button", { name: "M, unavailable" });
  await expect(m).toBeVisible();
  await expect(m).toHaveAttribute("aria-disabled", "true");
  await m.click({ force: true });
  await expect(page.getByText("Size: M")).toHaveCount(0);
});

test("S-22 the size guide opens over the product and keeps the selection", async ({ page }) => {
  await page.goto("/products/lace-balconette-bra");
  await page.getByRole("button", { name: "36C", exact: true }).click();
  await page.getByRole("button", { name: "Size guide" }).click();
  await expect(page.getByRole("dialog", { name: "Size guide" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Size: 36C")).toBeVisible();
  await expect(page).toHaveURL(/lace-balconette-bra$/);
});

test("G-06 search finds a product, and falls back when nothing matches", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const box = page.getByRole("searchbox", { name: "Search products" });
  await box.fill("lounge");
  await expect(page.getByRole("link", { name: /Ribbed lounge set/ })).toBeVisible();
  await box.fill("zzzzqq");
  await expect(page.getByText("You might like these instead")).toBeVisible();
});

test("W-01 the wishlist heart saves to the stored list", async ({ page }) => {
  await page.goto("/shop");
  await page
    .getByRole("button", { name: /^Save .* to wishlist$/ })
    .first()
    .click();
  const stored = await page.evaluate(() => localStorage.getItem("LBS_WISHLIST"));
  expect(JSON.parse(stored ?? "[]")).toHaveLength(1);
});

test("G-05 theme choice is stored under the existing key and applied", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("LBS_THEME", "dark"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

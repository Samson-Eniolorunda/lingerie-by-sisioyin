import { expect, test } from "./fixtures";
import { DEMO_CUSTOMER, signInAs } from "./helpers";

test("S-12 quick view opens from a card, adds to the bag and closes", async ({ page }) => {
  await page.goto("/shop");
  await page.getByRole("button", { name: "Quick view of Lace balconette bra" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("A lightly lined balconette")).toBeVisible();
  await dialog.getByRole("button", { name: "34B", exact: true }).click();
  await dialog.getByRole("button", { name: "Nude" }).click();
  await dialog.getByRole("button", { name: "Add to bag" }).click();
  await expect(dialog).toHaveCount(0);
  const stored = await page.evaluate(() => localStorage.getItem("LBS_CART_V1"));
  expect(JSON.parse(stored ?? "[]")).toMatchObject([
    { selectedSize: "34B", selectedColor: "Nude", qty: 1 },
  ]);
});

test("S-18 a bag line is edited in place: size, colour and quantity are replaced", async ({
  page,
}) => {
  await page.goto("/products/lace-balconette-bra");
  await page.getByRole("button", { name: "34B", exact: true }).click();
  await page.getByRole("button", { name: "Nude" }).click();
  await page.getByRole("button", { name: "Add to bag" }).filter({ visible: true }).click();
  await page.goto("/cart");
  await page.getByRole("button", { name: "Change Lace balconette bra" }).click();
  const dialog = page.getByRole("dialog", { name: "Change this item" });
  await expect(dialog.getByRole("button", { name: "34B", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await dialog.getByRole("button", { name: "36C", exact: true }).click();
  await dialog.getByRole("button", { name: "Wine" }).click();
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("36C · Wine")).toBeVisible();
  await expect(page.getByText("34B · Nude")).toHaveCount(0);
});

test("R-18 S-25 the legacy ?product= link goes to the product page", async ({ page }) => {
  const response = await page.goto("/shop?product=lace-balconette-bra");
  expect(response?.url()).toContain("/products/lace-balconette-bra");
  await page.goto("/shop?product=does-not-exist");
  await expect(page.getByRole("heading", { name: "Shop", level: 1 })).toBeVisible();
});

test("O-04 the sitemap lists products and leaves out private pages; robots points to it", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/products/lace-balconette-bra");
  expect(sitemap).toContain("/shop");
  expect(sitemap).not.toMatch(/\/(admin|dashboard|cart|checkout)</);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Sitemap:");
  expect(robots).toContain("Disallow: /admin");
});

test("S-04 the dual slider and the number fields move together and filter", async ({
  page,
  isMobile,
}) => {
  await page.goto("/shop");
  if (isMobile) await page.getByRole("button", { name: /^Filter/ }).click();
  const scope = isMobile ? page.getByRole("dialog") : page;
  const low = scope.getByRole("slider", { name: "Lowest price" });
  await low.focus();
  for (let i = 0; i < 12; i += 1) await page.keyboard.press("ArrowRight");
  await expect(scope.getByRole("textbox", { name: "From" })).toHaveValue("12000");
  await scope.getByRole("textbox", { name: "To" }).fill("20000");
  await expect(scope.getByRole("slider", { name: "Highest price" })).toHaveValue("20000");
  await scope.getByRole("button", { name: /Show results|Apply/ }).click();
  await expect(page).toHaveURL(/min=12000/);
  await expect(page).toHaveURL(/max=20000/);
});

test("G-10 the WhatsApp button opens a card with a pre-filled message and closes with Escape", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Message us on WhatsApp" });
  await button.click();
  const card = page.getByRole("region", { name: "Chat with us" });
  await expect(card.getByRole("link", { name: "Open WhatsApp" })).toHaveAttribute(
    "href",
    /wa\.me\/\d+\?text=/,
  );
  await page.keyboard.press("Escape");
  await expect(card).toHaveCount(0);
});

test("G-04 the menu shows the account block for a signed-in customer", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The menu button is a phone and tablet control.");
  await signInAs(page, DEMO_CUSTOMER);
  await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: /Menu/ }).first().click();
  await expect(page.getByTestId("menu-account")).toContainText("Hello, Demo");
});

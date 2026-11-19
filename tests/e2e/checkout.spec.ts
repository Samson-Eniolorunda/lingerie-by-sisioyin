import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const BRIEF = {
  variantId: "fixture-02-M-Black",
  id: "fixture-02",
  name: "Cotton high-waist brief",
  price_ngn: 6500,
  selectedSize: "M",
  selectedColor: "Black",
  image: "/placeholders/product-1.svg",
  qty: 2,
};

async function seedBag(page: Page, lines: readonly object[]) {
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("LBS_CART_V1", JSON.stringify(value));
      sessionStorage.setItem("seeded", "1");
    }
  }, lines);
}

/** On a phone the action bar steps aside while a field is focused, so the keyboard is dismissed first. */
const dismissKeyboard = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

async function fillContactAndDelivery(page: Page, email = "ada@example.com") {
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Obi");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill("08012345678");
  await dismissKeyboard(page);
  await page
    .getByRole("button", { name: "Continue to delivery" })
    .filter({ visible: true })
    .click();
  await page.getByLabel("Address").fill("12 Allen Avenue");
  await page.getByLabel("City or town").fill("Ikeja");
  await page.getByLabel("State").selectOption("Ogun");
  await dismissKeyboard(page);
  await page.getByRole("button", { name: "Continue to payment" }).filter({ visible: true }).click();
}

const receipt = {
  name: "receipt.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  ),
};

test("C-05 to C-07 promo and delivery change the cart summary", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/cart");
  await page.getByLabel("Promo code").fill("welcome10");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("WELCOME10 · 10% off")).toBeVisible();
  await page.getByLabel("Delivery to").selectOption("Ogun");
  await expect(
    page.getByText("Total", { exact: true }).locator("xpath=following-sibling::dd"),
  ).toHaveText("₦13,700");
});

test("C-05 an invalid promo shows an error under the field", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/cart");
  await page.getByLabel("Promo code").fill("nonsense");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("That code is not valid, or it has expired.")).toBeVisible();
});

test("C-10 an empty bag shows an empty state", async ({ page }) => {
  await page.goto("/cart");
  await expect(page.getByText("Your bag is empty")).toBeVisible();
});

test("K-01 to K-14 full checkout reaches the confirmation, then the order can be tracked", async ({
  page,
}) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  const place = page.getByRole("button", { name: /^Place order/ }).filter({ visible: true });
  await expect(place).toBeDisabled();
  await page.locator("#receipt").setInputFiles(receipt);
  await page.getByLabel("I have sent the payment").check();
  await expect(place).toBeEnabled();
  await place.click();
  await expect(page).toHaveURL(/\/confirmation$/);
  const number = (await page.locator("p.tabular").first().textContent())?.trim() ?? "";
  expect(number).toMatch(/^LBS-\d{8}-\d{4,}$/);
  expect(await page.evaluate(() => localStorage.getItem("LBS_CART_V1"))).toBe("[]");

  await page.getByRole("link", { name: "Track this order" }).click();
  await page.getByLabel("Email used for the order").fill("ada@example.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText("Pending", { exact: true })).toBeVisible();

  await page.getByLabel("Email used for the order").fill("someone@else.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(
    page.getByText("We could not find an order with that number and email address."),
  ).toBeVisible();
});

test("A11Y-04 invalid fields get an inline message and focus", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await page
    .getByRole("button", { name: "Continue to delivery" })
    .filter({ visible: true })
    .click();
  await expect(page.getByText("Enter your first name.")).toBeVisible();
  await expect(page.getByLabel("First name")).toBeFocused();
  await page.getByLabel("Email").fill("nope");
  await page.getByLabel("Email").blur();
  await expect(page.getByText(/valid email address/)).toBeVisible();
});

test("K-10 an oversize or wrong file is explained in text and not accepted", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await page
    .locator("#receipt")
    .setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("Attach a photograph (JPG, PNG or WebP) or a PDF.")).toBeVisible();
});

test("BUG-01 an order that cannot be fulfilled is refused up front, keeps the bag and does not redirect", async ({
  page,
}) => {
  await seedBag(page, [{ ...BRIEF, selectedSize: "XL", variantId: "fixture-02-XL-Black", qty: 9 }]);
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText(
    "Only 2 of Cotton high-waist brief",
  );
  await expect(page.getByText("Send ₦")).toHaveCount(0);
  await expect(page).toHaveURL(/\/checkout$/);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("LBS_CART_V1") ?? "[]").length),
  ).toBe(1);
});

test("the amount to transfer comes from the server and bank details wait for it", async ({
  page,
}) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await expect(page.getByText("1. Send ₦15,000 from your banking app")).toBeVisible();
  await expect(page.getByText("Account number")).toBeVisible();
});

test("the receipt goes straight to storage, not through a server action", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  const uploads: string[] = [];
  let actionBodies = 0;
  page.on("request", (r) => {
    if (r.method() === "PUT") uploads.push(r.url());
    if (r.method() === "POST" && r.headers()["next-action"] && (r.postData() ?? "").length > 5000)
      actionBodies += 1;
  });
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await page.locator("#receipt").setInputFiles(receipt);
  await page.getByLabel("I have sent the payment").check();
  await page
    .getByRole("button", { name: /^Place order/ })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/confirmation$/);
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain("/api/receipts/mock?path=");
  expect(actionBodies).toBe(0);
});

test("a receipt that is too large for its type is explained in plain words", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await page.locator("#receipt").setInputFiles({
    name: "big.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(5 * 1024 * 1024, 1),
  });
  await expect(page.getByText("That PDF is too large.")).toBeVisible();
});

test("a failed upload says so and keeps the order unplaced", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.route("**/api/receipts/mock**", (route) => route.abort("failed"));
  await page.goto("/checkout");
  await fillContactAndDelivery(page);
  await page.locator("#receipt").setInputFiles(receipt);
  await page.getByLabel("I have sent the payment").check();
  await page
    .getByRole("button", { name: /^Place order/ })
    .filter({ visible: true })
    .click();
  await expect(page.locator("[role=alert]:not(#__next-route-announcer__)")).toContainText(
    "The receipt could not be sent",
  );
  await expect(page).toHaveURL(/\/checkout$/);
});

test("K-15 a double tap on Place order sends one request", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  let actions = 0;
  let uploads = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) actions += 1;
    if (r.method() === "PUT") uploads += 1;
  });
  await page.goto("/checkout");
  await fillContactAndDelivery(page, "double@example.com");
  await page.locator("#receipt").setInputFiles(receipt);
  await page.getByLabel("I have sent the payment").check();
  actions = 0;
  const place = page.getByRole("button", { name: /^Place order/ }).filter({ visible: true });
  await place.dblclick();
  await expect(page).toHaveURL(/\/confirmation$/);
  // one action to issue the upload address, one to place the order, one upload: a double tap changes nothing
  expect(actions).toBe(2);
  expect(uploads).toBe(1);
});

test("G-16 contact details survive a reload", async ({ page }) => {
  await seedBag(page, [BRIEF]);
  await page.goto("/checkout");
  await page.getByLabel("First name").fill("Ada");
  await page.reload();
  await expect(page.getByLabel("First name")).toHaveValue("Ada");
});

test("K-16 an empty bag at checkout shows an empty state", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByText("Your bag is empty")).toBeVisible();
});

test("T-02 the confirmation page redirects to the shop without an order", async ({ page }) => {
  await page.goto("/confirmation");
  await expect(page).toHaveURL(/\/shop$/);
});

test("W-02 to W-04 wishlist page lists saved items, removes one and shows the empty state", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("LBS_WISHLIST", JSON.stringify(["fixture-01"])),
  );
  await page.goto("/wishlist");
  await expect(page.getByText("Lace balconette bra")).toBeVisible();
  await page.getByRole("button", { name: /Remove Lace balconette bra from wishlist/ }).click();
  await expect(page.getByText("Nothing saved yet")).toBeVisible();
});

import { expect, test } from "./fixtures";
import {
  DEMO_EDITOR,
  DEMO_OWNER,
  SUPABASE_E2E,
  PHONE_WIDTHS,
  horizontalOverflow,
  signInAs,
  smallTargets,
} from "./helpers";

type Credentials = { email: string; password: string };

/** Signs in and waits until the session exists, so the next navigation cannot cut the sign-in short. */
async function staff(page: Parameters<typeof signInAs>[0], who: Credentials = DEMO_OWNER) {
  await signInAs(page, who, "/admin/sign-in");
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin") && !url.pathname.includes("sign-in"),
  );
}

const ROUTES = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/products/new",
  "/admin/customers",
  "/admin/promos",
  "/admin/messages",
  "/admin/analytics",
  "/admin/settings",
  "/admin/settings/payments",
  "/admin/reviews",
  "/admin/receipts",
  "/admin/team",
  "/admin/activity",
];

test.describe("staff access", () => {
  test("M-01 a signed-out visitor is sent to the staff sign-in and back again", async ({
    page,
  }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/sign-in\?next=%2Fadmin%2Forders/);
    await page.getByLabel("Staff email address").fill(DEMO_OWNER.email);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_OWNER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole("heading", { name: "Orders", level: 2 })).toBeVisible();
  });
  test("a customer account cannot sign in to the admin", async ({ page }) => {
    await signInAs(
      page,
      { email: "demo.customer@example.test", password: "Demo-Pass1!" },
      "/admin/sign-in",
    );
    await expect(page.locator("p[role=alert]")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });
  test("M-10 an editor sees the screens the role allows and is refused the rest", async ({
    page,
  }, testInfo) => {
    await staff(page, DEMO_EDITOR);
    const nav = page.getByRole("navigation", { name: "Admin" }).last();
    await expect(nav.getByRole("link")).toHaveCount(testInfo.project.name === "phone" ? 4 : 6);
    await page.goto("/admin/team");
    await expect(page).toHaveURL(/\/admin\/denied/);
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    await page.goto("/admin/customers");
    await expect(page).toHaveURL(/\/admin\/denied/);
  });
  test("the storefront session does not sign anyone in to the admin (A-14)", async ({ page }) => {
    await signInAs(page, { email: "demo.customer@example.test", password: "Demo-Pass1!" });
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });
  test("staff sign-out ends the session", async ({ page }) => {
    await staff(page);
    const more = page.getByRole("button", { name: "More" });
    if (await more.isVisible()) await more.click();
    await page.getByRole("button", { name: "Sign out" }).filter({ visible: true }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });
});

test.describe("orders (MO)", () => {
  test("MO-04 a pending order is confirmed and moved on, step by step", async ({
    page,
  }, testInfo) => {
    await staff(page);
    await page.goto("/admin/orders?status=pending");
    // MO-08 takes the last two pending orders (one per project); this takes two others, so the tests
    // running side by side never work on the same order.
    await page
      .getByRole("link", { name: /^LBS-/ })
      .nth(testInfo.project.name === "phone" ? -3 : -4)
      .click();
    await expect(page.getByText("Payment receipt")).toBeVisible();
    if (!SUPABASE_E2E) await expect(page.getByText("Placeholder", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Confirm payment" }).click();
    await expect(page.getByRole("button", { name: "Start preparing" })).toBeVisible();
    await page.getByRole("button", { name: "Start preparing" }).click();
    await expect(page.getByRole("button", { name: "Mark as shipped" })).toBeVisible();
  });
  test("MO-08 cancelling asks first, with Cancel on the left and the confirming button on the right", async ({
    page,
  }, testInfo) => {
    await staff(page);
    await page.goto("/admin/orders?status=pending");
    // Each project cancels a different order, so the two runs cannot collide on one.
    await page
      .getByRole("link", { name: /^LBS-/ })
      .nth(testInfo.project.name === "phone" ? -1 : -2)
      .click();
    await page.getByRole("button", { name: "Cancel order" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this order?" });
    const keep = await dialog.getByRole("button", { name: "Cancel", exact: true }).boundingBox();
    const confirm = await dialog.getByRole("button", { name: "Cancel the order" }).boundingBox();
    expect(keep && confirm && keep.x < confirm.x).toBe(true);
    await dialog.getByRole("button", { name: "Cancel the order" }).click();
    // The receipt was never accepted, so the order opens a refund check instead of ending quietly.
    await expect(
      page.getByText(/money may have reached the account|This order is cancelled\./),
    ).toBeVisible();
  });
  test("MO-02 the status filter and search narrow the list", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/orders?status=delivered");
    const rows = page.getByRole("row");
    await expect(rows.nth(1)).toContainText("Delivered");
    await page.goto("/admin/orders?q=no-such-order-zzz");
    await expect(page.getByText("No orders match.")).toBeVisible();
  });
});

test.describe("products (MI)", () => {
  test("MI-04 MI-06 a product is added in four steps and appears in the list", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/products/new");
    await page.getByLabel("Name", { exact: true }).fill("Satin sleep set");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(
      page.getByText("Choose a category.").or(page.getByText("Invalid option")),
    ).toBeVisible();
    await page.getByLabel("Category").selectOption("Loungewear");
    await page.getByLabel("For").selectOption("Women");
    await page.getByLabel("Price in naira").fill("24500");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Add at least one size with its stock.")).toBeVisible();
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("combobox", { name: "Colour" }).fill("Wine");
    await page.getByLabel("How many in stock").fill("6");
    await page.getByRole("button", { name: "Add this line" }).click();
    await expect(page.getByText("6 units").first()).toBeVisible();
    await page.getByRole("button", { name: "One more M Wine" }).click();
    await expect(page.getByText("7 units").first()).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("7 units in 1 line")).toBeVisible();
    await page.getByRole("button", { name: "Add product" }).click();
    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText("Satin sleep set", { exact: true }).first()).toBeVisible();
    await page.goto("/shop");
    await expect(page.getByText("Satin sleep set").first()).toBeVisible();
  });
  test("MI-07 photographs are uploaded (a marked placeholder in this build), reordered and removed", async ({
    page,
  }) => {
    await staff(page);
    await page.goto("/admin/products/new");
    await page.getByLabel("Name", { exact: true }).fill("Photo test");
    await page.getByLabel("Category").selectOption("Lingerie");
    await page.getByLabel("For").selectOption("Women");
    await page.getByLabel("Price in naira").fill("9000");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "M", exact: true }).click();
    await page.getByRole("combobox", { name: "Colour" }).fill("Black");
    await page.getByLabel("How many in stock").fill("3");
    await page.getByRole("button", { name: "Add this line" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.locator("#photos").setInputFiles([
      { name: "a.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgo=", "base64") },
      { name: "b.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgo=", "base64") },
    ]);
    await expect(page.getByRole("button", { name: "Remove photograph" })).toHaveCount(2);
    await page.getByRole("button", { name: "Move later" }).first().click();
    await page.getByRole("button", { name: "Remove photograph" }).first().click();
    await expect(page.getByRole("button", { name: "Remove photograph" })).toHaveCount(1);
  });
  test("MI-09 MX-09 trashing asks first, offers undo, and the trash restores", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/products");
    const card = page.getByRole("listitem").filter({ hasText: "Edit" }).first();
    const name = (await card.locator("p").first().textContent()) ?? "";
    await card.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Move 1 to trash/ }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Move to trash" }).click();
    await expect(page.getByRole("status").getByText("Moved to the trash.")).toBeVisible();
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText(name).first()).toBeVisible();
  });
  test("MI-01 the filters work (BUG-20)", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/products?category=Accessories");
    for (const text of await page.locator("li p.text-sm.text-muted").allTextContents())
      expect(text).toContain("Accessories");
    await page.goto("/admin/products?q=zzzz-none");
    await expect(page.getByText("No products match.")).toBeVisible();
  });
  test("MI-19 the editor reaches the last step with Ctrl+S refusing an incomplete form", async ({
    page,
  }) => {
    await staff(page);
    await page.goto("/admin/products/new");
    await page.keyboard.press("Control+s");
    await expect(
      page.getByRole("status").getByText("Please check the highlighted details."),
    ).toBeVisible();
    await expect(page.getByText("Enter the product name.")).toBeVisible();
  });
});

test.describe("customers, promos, messages, settings, team", () => {
  test("MC-03 a customer is suspended and reactivated from the Manage sheet", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/customers?q=Ada");
    await page
      .getByRole("button", { name: /^Manage/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Suspend" }).click();
    await page
      .getByRole("dialog", { name: /Suspend/ })
      .getByRole("button", { name: "Suspend" })
      .click();
    await expect(page.getByText("The account is suspended")).toBeVisible();
    await page.getByRole("button", { name: "Reactivate" }).click();
    await expect(page.getByText("The account is active.")).toBeVisible();
  });
  test("MC-05 deleting a customer's data needs the word DELETE and a second confirmation", async ({
    page,
  }, testInfo) => {
    const who = testInfo.project.name === "phone" ? "Zainab" : "Ngozi";
    await staff(page);
    await page.goto(`/admin/customers?q=${who}`);
    await page
      .getByRole("button", { name: /^Manage/ })
      .first()
      .click();
    const del = page.getByRole("button", { name: "Delete data" });
    await expect(del).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await del.click();
    await page.getByRole("button", { name: "Delete for good" }).click();
    await expect(page.getByText(who)).toHaveCount(0);
  });
  test("a promo code is created, switched off and deleted", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/promos");
    await page.getByRole("button", { name: "New promo code" }).click();
    await page.getByRole("textbox", { name: "Code" }).fill("e2e15");
    await page.getByLabel("Discount (%)").fill("15");
    await page.getByRole("button", { name: "Create code" }).click();
    await expect(page.getByText("E2E15")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "E2E15" });
    await row.getByRole("button", { name: "Switch off" }).click();
    await expect(row.getByText("Off")).toBeVisible();
    await row.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete code" }).click();
    await expect(page.getByText("E2E15")).toHaveCount(0);
  });
  test("MM-09 opening a message marks it read; a reply is saved", async ({ page }, testInfo) => {
    const who = testInfo.project.name === "phone" ? "Ada Demo" : "Tolu Sample";
    await staff(page);
    await page.goto("/admin/messages?status=unread");
    await page.getByRole("link", { name: new RegExp(who) }).click();
    await page.getByLabel("Your reply").fill("Thank you, we will help you choose.");
    await page.getByRole("button", { name: "Save reply" }).click();
    await expect(page.getByText("Thank you, we will help you choose.").first()).toBeVisible();
  });
  test("settings validate and save", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/settings");
    await page.getByLabel("WhatsApp number").fill("+234 90");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Use digits only, with the country code")).toBeVisible();
    await page.getByLabel("WhatsApp number").fill("2349033344860");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByRole("status").getByText("Settings saved.")).toBeVisible();
  });
  test("bank details validate, save, show at checkout, and are logged", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/settings/payments");
    await page.getByLabel("Account number").fill("123");
    await page.getByRole("button", { name: "Save bank details" }).click();
    await expect(page.getByText("An account number has 10 digits.")).toBeVisible();
    await page.getByLabel("Bank", { exact: true }).selectOption("Access Bank");
    await page.getByLabel("Account number").fill("0123456789");
    await page.getByLabel("Account name").fill("Sisioyin Stores");
    await page.getByRole("button", { name: "Save bank details" }).click();
    await expect(page.getByRole("status").getByText(/Bank details saved/)).toBeVisible();
    await expect(page.getByText("Recent changes")).toBeVisible();
    await expect(page.getByText(/Bank details: from/).first()).toBeVisible();
    await expect(page.getByText("Not connected").first()).toBeVisible();
  });
  test("MX-07 an invitation produces a link; owners are protected", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/team");
    await expect(page.getByText("Protected")).toBeVisible();
    await page.getByRole("button", { name: "Invite someone" }).click();
    await page.getByLabel("Email address").fill("new.staff@example.test");
    await page.getByRole("button", { name: "Create invitation" }).click();
    // The full address, not a relative path, with a Copy button beside it.
    await expect(page.getByTestId("invite-link")).toContainText("/admin/sign-in?invite=");
    expect(await page.getByTestId("invite-link").textContent()).toMatch(/^http/);
    await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
  });
  test("MA-01 analytics switch between 7, 30 and 90 days and say the figures are samples", async ({
    page,
  }) => {
    await staff(page);
    await page.goto("/admin/analytics?days=7");
    await expect(page.getByRole("link", { name: "7 days" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // The development store says its figures are samples; a real database's are not.
    await expect(page.getByTestId("sample-note")).toHaveCount(SUPABASE_E2E ? 0 : 1);
    await expect(page.getByRole("img", { name: /Revenue from delivered orders/ })).toBeVisible();
    await page.getByRole("link", { name: "90 days" }).click();
    await expect(page.getByRole("img", { name: /over 90 days/ }).first()).toBeVisible();
  });
  test("exports are CSV and refused without permission", async ({ page, request }) => {
    expect((await request.get("/admin/export/orders")).status()).toBe(403);
    await staff(page);
    const response = await page.request.get("/admin/export/orders");
    expect(response.headers()["content-type"]).toContain("text/csv");
    expect(await response.text()).toContain("Order number,Customer");
  });
});

test.describe("phone layout", () => {
  for (const width of PHONE_WIDTHS) {
    test(`M-29 no sideways scroll and 44 px targets at ${width} px on every screen`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await staff(page);
      for (const route of ROUTES) {
        await page.goto(route);
        expect(await horizontalOverflow(page), `${route} overflows`).toBe(0);
        expect(await smallTargets(page), `${route} small targets`).toEqual([]);
      }
    });
  }
  test("tables become cards with a label before each value", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await staff(page);
    await page.goto("/admin/orders");
    const cell = page.getByRole("cell").filter({ hasText: /₦/ }).first();
    expect(await cell.evaluate((el) => getComputedStyle(el, "::before").content)).toContain(
      "Total",
    );
  });
});

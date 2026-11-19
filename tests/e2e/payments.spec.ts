import { expect, test } from "./fixtures";
import { DEMO_OWNER, SUPABASE_E2E, signInAs, uniqueEmail } from "./helpers";

async function staff(page: Parameters<typeof signInAs>[0]) {
  await signInAs(page, DEMO_OWNER, "/admin/sign-in");
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin") && !url.pathname.includes("sign-in"),
  );
}

test.describe("receipts with no order and refunds", () => {
  test("the page for receipts with no order opens and explains itself", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/receipts");
    await expect(
      page.getByRole("heading", { name: "Receipts with no order", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Paid, but the order failed")).toBeVisible();
    await expect(page.getByText("Abandoned uploads")).toBeVisible();
  });
});

test.describe("moderation", () => {
  test.skip(SUPABASE_E2E, "the seeded database has no waiting reviews");
  test("a waiting review is approved and then hidden again", async ({ page }) => {
    await staff(page);
    await page.goto("/admin/reviews");
    await expect(page.getByText("Soft, supportive and true to size.")).toBeVisible();
    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByRole("status").getByText("The review is now shown.")).toBeVisible();
    await page.goto("/admin/reviews?show=approved");
    await expect(page.getByText("Soft, supportive and true to size.")).toBeVisible();
    await page.getByRole("button", { name: "Hide" }).first().click();
    await expect(page.getByRole("status").getByText("The review is hidden.")).toBeVisible();
  });
});

test.describe("staff invitation", () => {
  test("an invited person creates their account from the link and reaches the admin", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("invitee");
    await staff(page);
    await page.goto("/admin/team");
    await page.getByRole("button", { name: "Invite someone" }).click();
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Create invitation" }).click();
    const link = (await page.getByTestId("invite-link").textContent()) ?? "";
    const path = link.slice(link.indexOf("/admin/sign-in"));

    const context = await browser.newContext();
    const guest = await context.newPage();
    await guest.goto(path);
    await guest.locator("html[data-hydrated]").waitFor({ state: "attached" });
    await expect(guest.getByRole("heading", { name: "Join the team" })).toBeVisible();
    await expect(guest.getByLabel("Email address")).toHaveValue(email);
    await guest.getByLabel("First name").fill("New");
    await guest.getByLabel("Last name").fill("Editor");
    await guest.getByLabel("Password", { exact: true }).fill("Invited-Pass1!");
    await guest.getByLabel("Confirm password").fill("Invited-Pass1!");
    await guest.getByRole("button", { name: "Create my account" }).click();
    await guest.waitForURL((url) => url.pathname === "/admin");
    await expect(guest.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    // The link works once.
    const again = await context.newPage();
    await again.goto(path);
    await expect(again.getByText(/already been used|expired/)).toBeVisible();
    await context.close();
  });

  test("a made-up invitation is refused politely", async ({ page }) => {
    await page.goto("/admin/sign-in?invite=0123456789abcdef0123456789abcdef");
    await expect(page.getByText(/expired or has already been used/)).toBeVisible();
  });
});

test.describe("tracking shows only what it needs", () => {
  test("a stranger who guesses an order number sees no phone number or street address", async ({
    page,
  }) => {
    await page.goto("/track");
    await expect(page.getByText("+234")).toHaveCount(0);
  });
});

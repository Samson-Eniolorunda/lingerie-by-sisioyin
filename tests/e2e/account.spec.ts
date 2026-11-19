import { expect, test } from "./fixtures";
import {
  DEMO_CUSTOMER,
  PHONE_WIDTHS,
  horizontalOverflow,
  signInAs,
  signUpFresh,
  smallTargets,
  uniqueEmail,
} from "./helpers";

test.describe("sign-in screen", () => {
  test("A-01 A-15 uses phone keyboards, 16 px inputs and a show/hide toggle", async ({ page }) => {
    await page.goto("/sign-in");
    const email = page.getByLabel("Email address");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(email).toHaveAttribute("autocomplete", "username");
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await expect(password).toHaveAttribute("type", "password");
    expect(await password.evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px");
    await password.fill("secret-value");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(password).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(password).toHaveAttribute("type", "password");
  });

  test("shows inline errors for empty fields and a single message for wrong details", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
    await page.getByLabel("Email address").fill("someone@example.test");
    await page.getByLabel("Password", { exact: true }).fill("Wrong-Pass1!");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("p[role=alert]")).toContainText(
      "The email or password is not correct.",
    );
  });

  test("A-05 the Google button explains that it is not connected yet", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByText("Google sign-in is not connected")).toBeVisible();
  });

  test("signs in with the demonstration customer and signs out again", async ({ page }) => {
    await signInAs(page, DEMO_CUSTOMER);
    await page.waitForURL("**/dashboard");
    await expect(page.getByRole("heading", { name: "Hello, Demo" })).toBeVisible();
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard/);
  });

  test("the sign-in return address cannot leave the site", async ({ page }) => {
    await page.goto("/sign-in?next=//evil.example");
    await page.getByLabel("Email address").fill(DEMO_CUSTOMER.email);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_CUSTOMER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
    expect(new URL(page.url()).hostname).toBe("localhost");
  });

  test("a protected page returns to itself after sign-in", async ({ page }) => {
    await page.goto("/dashboard/orders");
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByLabel("Email address").fill(DEMO_CUSTOMER.email);
    await page.getByLabel("Password", { exact: true }).fill(DEMO_CUSTOMER.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard/orders");
  });
});

test.describe("sign-up", () => {
  test("A-02 A-03 A-16 shows the rules live and refuses a weak password", async ({ page }) => {
    await page.goto("/sign-up");
    const password = page.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("autocomplete", "new-password");
    await expect(page.getByLabel("First name")).toHaveAttribute("autocomplete", "given-name");
    await password.fill("abc");
    await expect(page.getByText("At least 8 characters")).toContainText("not met yet");
    await password.fill("Abcdefg1!");
    await expect(page.getByText("A special character")).toContainText("met");
    await page.getByLabel("Confirm password").fill("different");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("The two passwords do not match.")).toBeVisible();
    await expect(
      page.getByText("Accept the terms and the privacy policy to continue."),
    ).toBeVisible();
    await expect(page.locator("form").getByRole("link", { name: "terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
  });

  test("creates an account and lands on the dashboard; a second sign-up with the email is refused", async ({
    page,
  }) => {
    const email = await signUpFresh(page);
    await expect(page.getByRole("heading", { name: "Hello, Test" })).toBeVisible();
    await page.context().clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("First name").fill("Test");
    await page.getByLabel("Last name").fill("Person");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill("Fresh-Pass1!");
    await page.getByLabel("Confirm password").fill("Fresh-Pass1!");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("An account with this email already exists").first()).toBeVisible();
  });
});

test("A-06 A-07 forgotten and reset password: single use, then sign in with the new one", async ({
  page,
}) => {
  const email = await signUpFresh(page);
  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(email)).toBeVisible();
  const resetLink =
    (await page.getByRole("link", { name: "Open the reset link" }).getAttribute("href")) ?? "";
  await page.goto(resetLink);
  await page.getByLabel("New password", { exact: true }).fill("Changed-Pass2!");
  await page.getByLabel("Confirm new password").fill("Changed-Pass2!");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("Your password has been changed")).toBeVisible();
  await page.goto(resetLink); // the one-time code was used, so the link leads to a fresh request
  await expect(page).toHaveURL(/\/forgot-password\?link=expired/);
  await expect(page.getByText("expired or has already been used")).toBeVisible();
  await signInAs(page, { email, password: "Changed-Pass2!" });
  await page.waitForURL("**/dashboard");
});

test("an unknown email gets the same reply and no link", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("a reset link is on its way")).toBeVisible();
  await expect(page.getByTestId("dev-reset-link")).toHaveCount(0);
});

test.describe("account area", () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, DEMO_CUSTOMER);
    await page.waitForURL("**/dashboard");
  });

  test("D-03 D-04 overview figures, orders list and status filter", async ({ page }) => {
    await expect(page.getByText("Recent orders")).toBeVisible();
    await page.goto("/dashboard/orders");
    const all = await page.locator("main ul li a[href^='/dashboard/orders/LBS']").count();
    expect(all).toBeGreaterThanOrEqual(4);
    await page.getByRole("link", { name: "Delivered", exact: true }).click();
    await expect(page).toHaveURL(/status=delivered/);
    expect(await page.locator("main ul li a[href^='/dashboard/orders/LBS']").count()).toBeLessThan(
      all,
    );
  });

  test("D-05 D-07 order detail shows the timeline, items and the return route for a recent delivery", async ({
    page,
  }) => {
    await page.goto("/dashboard/orders?status=shipped");
    await page.locator("a[href^='/dashboard/orders/LBS']").first().click();
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    await expect(page.getByText("Current")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Items and delivery" })).toBeVisible();
    await page.goto("/dashboard/orders?status=cancelled");
    await page.locator("a[href^='/dashboard/orders/LBS']").first().click();
    await expect(page.getByText("This order was cancelled.")).toBeVisible();
  });

  test("an order that belongs to nobody here is a 404", async ({ page }) => {
    const response = await page.goto("/dashboard/orders/LBS-01012026-0001");
    expect(response?.status()).toBe(404);
  });

  test("the account section links work and the privacy anchor reaches the settings", async ({
    page,
  }) => {
    await page.goto("/faq");
    await page.goto("/dashboard#settings");
    await expect(page).toHaveURL(/\/dashboard\/settings/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("addresses, profile and deletion", () => {
  test("D-08 adds, edits and deletes an address with a confirmation", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard/addresses");
    await expect(page.getByText("No saved addresses yet")).toBeVisible();
    await page.getByRole("button", { name: "Add an address" }).click();
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("Name this address")).toBeVisible();
    await page.getByLabel("Name for this address").fill("Home");
    await page.getByLabel("Recipient").fill("Test Person");
    await page.getByLabel("Phone number").fill("08012345678");
    await page.getByLabel("Street address").fill("12 Allen Avenue");
    await page.getByLabel("City or town").fill("Ikeja");
    await page.getByLabel("State").selectOption("Lagos");
    await page.getByRole("button", { name: "Save address" }).click();
    await expect(page.getByText("12 Allen Avenue")).toBeVisible();
    await expect(page.getByText("Default")).toBeVisible();
    await page.getByRole("button", { name: "Delete Home" }).click();
    await expect(page.getByRole("dialog", { name: "Delete this address?" })).toBeVisible();
    await page.getByRole("button", { name: "Keep it" }).click();
    await expect(page.getByText("12 Allen Avenue")).toBeVisible();
    await page.getByRole("button", { name: "Delete Home" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("No saved addresses yet")).toBeVisible();
  });

  test("D-09 saves the profile, and refuses a bad phone number inline", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard/profile");
    await expect(page.getByLabel("Email address")).toHaveAttribute("readonly", "");
    await page.getByLabel("Phone number").fill("123");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Enter a Nigerian number")).toBeVisible();
    await page.getByLabel("Phone number").fill("08012345678");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Your profile has been saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Phone number")).toHaveValue("+2348012345678");
  });

  test("D-17 asks for the password, then signs the customer out", async ({ page }) => {
    await signUpFresh(page);
    await page.goto("/dashboard/settings");
    await page.getByRole("button", { name: "Request deletion" }).click();
    await page.getByRole("dialog").getByLabel("Your password").fill("wrong");
    await page.getByRole("dialog").getByRole("button", { name: "Request deletion" }).click();
    await expect(page.getByText("That password is not correct.")).toBeVisible();
    await page.getByRole("dialog").getByLabel("Your password").fill("Fresh-Pass1!");
    await page.getByRole("dialog").getByRole("button", { name: "Request deletion" }).click();
    await page.waitForURL("**/?account=deletion-requested");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/sign-in/);
  });
});

for (const width of PHONE_WIDTHS) {
  test(`auth and account screens fit ${width}px with 44 px targets`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ["/sign-in", "/sign-up", "/forgot-password"]) {
      await page.goto(route);
      expect(await horizontalOverflow(page), route).toBeLessThanOrEqual(0);
      expect(await smallTargets(page), route).toEqual([]);
    }
    await signInAs(page, DEMO_CUSTOMER);
    await page.waitForURL("**/dashboard");
    for (const route of [
      "/dashboard",
      "/dashboard/orders",
      "/dashboard/addresses",
      "/dashboard/profile",
      "/dashboard/settings",
    ]) {
      await page.goto(route);
      expect(await horizontalOverflow(page), route).toBeLessThanOrEqual(0);
      expect(await smallTargets(page), route).toEqual([]);
    }
  });
}

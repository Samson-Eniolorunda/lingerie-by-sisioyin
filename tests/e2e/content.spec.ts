import { expect, test } from "./fixtures";

test("P-05, P-12, BUG-30 FAQ shows all 23 questions on arrival, searches, opens one at a time", async ({
  page,
}) => {
  await page.goto("/faq");
  await expect(page.getByText("23 questions")).toBeVisible();
  const first = page.getByRole("button", { name: "How do I place an order?" });
  await first.click();
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "How do I track my order?" }).click();
  await expect(first).toHaveAttribute("aria-expanded", "false");

  await page.getByRole("searchbox", { name: "Search the questions" }).fill("refund");
  await expect(page.getByText(/\d+ questions?/).first()).not.toHaveText("23 questions");
  await page.getByRole("searchbox", { name: "Search the questions" }).fill("zzzzqq");
  await expect(page.getByText("No questions match")).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).first().click();
  await expect(page.getByText("23 questions")).toBeVisible();

  await page.getByRole("tab", { name: "Shipping" }).click();
  await expect(page.getByText("5 questions")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Shipping" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("P-06 to P-08 size guide: charts keep all rows, calculator shows nothing before a calculation and no alert", async ({
  page,
}) => {
  page.on("dialog", () => {
    throw new Error("The size guide must not use alert()");
  });
  await page.goto("/size");
  await expect(page.getByText("Your estimated size")).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: /Bras size chart/ }).locator("tbody tr"),
  ).toHaveCount(8);
  await page.getByRole("tab", { name: "Loungewear" }).click();
  await expect(
    page.getByRole("table", { name: /Loungewear size chart/ }).locator("tbody tr"),
  ).toHaveCount(6);

  await page.getByRole("button", { name: "Find my size" }).click();
  await expect(page.getByText("Enter both measurements in centimetres.")).toBeVisible();
  await page.getByLabel("Underbust (cm)").fill("80");
  await page.getByLabel("Bust (cm)", { exact: true }).fill("92");
  await page.getByRole("button", { name: "Find my size" }).click();
  await expect(page.getByText("36B")).toBeVisible();
  await page.getByLabel("Bust (cm)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Find my size" }).click();
  await expect(page.getByText(/not in our printed chart/)).toBeVisible();
});

test("P-09, P-10, R-20 legal pages have a table of contents and working anchors", async ({
  page,
}) => {
  await page.goto("/privacy#data-deletion");
  await expect(page.getByRole("heading", { name: /Data Deletion Instructions/ })).toBeInViewport();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 2, name: /Acceptance of Terms/ })).toBeVisible();
  await expect(page.getByText("Last updated: February 15, 2026")).toBeVisible();
});

test("P-01 to P-04 contact: validation, success, subject pre-selected from the URL", async ({
  page,
}) => {
  await page.goto("/contact?subject=sizing");
  await expect(page.getByLabel("Subject")).toHaveValue("sizing");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Enter your name.")).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill("Ada Obi");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Message", { exact: true }).fill("Which size would suit a 34 inch bust?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent")).toBeVisible();
  await page.getByRole("button", { name: "Send another" }).click();
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue("");
});

test("BUG-11 a failed send says so and offers WhatsApp instead of claiming success", async ({
  page,
}) => {
  await page.goto("/contact");
  await page.getByLabel("Name", { exact: true }).fill("Ada Obi");
  await page.getByLabel("Email", { exact: true }).fill("ada@example.com");
  await page.getByLabel("Subject").selectOption("other");
  await page.getByLabel("Message", { exact: true }).fill("Testing the failure path now.");
  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("could not send your message");
  await expect(page.getByText("Message sent")).toHaveCount(0);
  await expect(
    page.locator("p[role=alert]").getByRole("link", { name: "Message us on WhatsApp" }),
  ).toBeVisible();
});

test("R-16 an unknown address shows the not-found page with a way back", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Go to the shop" })).toBeVisible();
});

import { expect, test } from "./fixtures";
import { DEMO_OWNER, signInAs } from "./helpers";

// Owner rule: the theme switch lives in the footer on desktop and in the side menu on phones; never in the top bar.
test("theme switch is not in the storefront top bar at any width", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header").getByRole("radiogroup")).toHaveCount(0);
});

test("theme switch sits in the footer on desktop and in the menu on phones", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const group = page.getByRole("radiogroup", { name: "Appearance" });
  if (isMobile) {
    await expect(page.locator("footer").getByRole("radiogroup")).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu.getByRole("heading", { name: "Appearance" })).toBeVisible();
    const dark = menu.getByRole("radio", { name: "Dark" });
    const box = await dark.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(43.5);
    expect(box?.width).toBeGreaterThanOrEqual(43.5);
    await dark.click();
  } else {
    const footerGroup = page.locator("footer").getByRole("radiogroup", { name: "Appearance" });
    await expect(footerGroup).toBeVisible();
    await expect(group).toHaveCount(1);
    await footerGroup.getByRole("radio", { name: "Dark" }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("LBS_THEME"))).toBe("dark");
});

test("admin: no theme switch in the top bar; one in the sidebar or More sheet", async ({
  page,
  isMobile,
}) => {
  await signInAs(page, DEMO_OWNER, "/admin/sign-in");
  await page.waitForURL(
    (url) => url.pathname.startsWith("/admin") && !url.pathname.includes("sign-in"),
  );
  await page.goto("/admin");
  await expect(page.locator("header[data-admin-chrome]").getByRole("radiogroup")).toHaveCount(0);
  if (isMobile) {
    await page.getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("dialog").getByRole("radiogroup", { name: "Appearance" }),
    ).toBeVisible();
  } else {
    await expect(
      page.locator("aside").getByRole("radiogroup", { name: "Appearance" }),
    ).toBeVisible();
  }
});

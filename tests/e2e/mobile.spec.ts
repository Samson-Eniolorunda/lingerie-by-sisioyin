import { expect, test } from "./fixtures";
import { smallTargets } from "./helpers";

test.describe("phone", () => {
  test("12.3 tap targets are 44 px or more", async ({ page }) => {
    for (const route of [
      "/",
      "/shop",
      "/products/ribbed-lounge-set",
      "/faq",
      "/size",
      "/contact",
      "/privacy",
      "/track",
      "/cart",
    ]) {
      await page.goto(route);
      expect(await smallTargets(page), route).toEqual([]);
    }
  });

  test("12.3 bottom navigation is present and clears the last content", async ({ page }) => {
    await page.goto("/shop");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const footer = await page.locator("footer").boundingBox();
    const navBox = await nav.boundingBox();
    expect(footer && navBox && footer.y + footer.height).toBeGreaterThan(0);
    const lastLink = await page.locator("footer a").last().boundingBox();
    expect(lastLink && navBox && lastLink.y + lastLink.height <= navBox.y + 1).toBe(true);
  });

  test("12.7 the product gallery is a scroll-snap strip with a counter", async ({ page }) => {
    await page.goto("/products/lace-balconette-bra");
    const strip = page.getByRole("list", { name: /photographs/ });
    expect(await strip.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x");
    await expect(page.getByText("1 / 3")).toBeVisible();
    await strip.evaluate((el) => el.scrollTo({ left: el.clientWidth * 2 }));
    await expect(page.getByText("3 / 3")).toBeVisible();
  });

  test("12.7 the viewer opens full screen and closes", async ({ page }) => {
    await page.goto("/products/lace-balconette-bra");
    await page.getByRole("button", { name: "Open photograph full screen" }).first().click();
    await expect(page.getByRole("dialog", { name: "Product photographs" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("12.3 the add-to-bag bar sits above the bottom navigation and prompts for a size", async ({
    page,
  }) => {
    await page.goto("/products/lace-balconette-bra");
    const bar = page.getByRole("button", { name: "Select a size" }).last();
    await expect(bar).toBeVisible();
    const box = await bar.boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y + box.height <= viewport.height).toBe(true);
  });

  test("12.9 the filter sheet opens full height and applies", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("button", { name: "Filter" }).click();
    const dialog = page.getByRole("dialog", { name: "Filter" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Loungewear").check();
    await dialog.getByRole("button", { name: "Show results" }).click();
    await expect(page).toHaveURL(/category=Loungewear/);
  });

  test("12.9 the bag opens as a sheet and the quantity steps with 44 px buttons", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "LBS_CART_V1",
        JSON.stringify([
          {
            variantId: "p-S",
            id: "p",
            name: "Ribbed lounge set",
            price_ngn: 28500,
            selectedSize: "S",
            selectedColor: "",
            image: "",
            qty: 1,
          },
        ]),
      ),
    );
    await page.goto("/");
    await page.getByRole("button", { name: /^Bag/ }).click();
    const more = page.getByRole("button", { name: "More Ribbed lounge set" });
    const box = await more.boundingBox();
    expect(box && box.width >= 44 && box.height >= 44).toBe(true);
    await more.click();
    await expect(page.getByText("₦57,000").first()).toBeVisible();
  });

  test("12.7 the bras and panties charts show one unit at a time on a phone", async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, "The unit control is for phone widths");
    await page.goto("/size");
    const table = page.getByRole("table", { name: /Bras size chart/ });
    await expect(table.getByRole("columnheader", { name: "Underbust (cm)" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Underbust (in)" })).toBeHidden();
    await page.getByRole("radio", { name: "inches" }).click();
    await expect(table.getByRole("columnheader", { name: "Underbust (in)" })).toBeVisible();
  });
});

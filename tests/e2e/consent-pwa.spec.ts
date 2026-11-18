import { expect, test } from "./fixtures";

test.describe("cookie consent (N-01, N-02)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.sessionStorage.setItem("LBS_TEST_NO_CONSENT_PRESET", "1");
      if (!window.sessionStorage.getItem("seeded")) {
        window.localStorage.removeItem("LBS_CONSENT_V1");
        window.sessionStorage.setItem("seeded", "1");
      }
    });
  });

  test("the card appears, loads no analytics, and 'Essential only' is on the left of 'Accept analytics'", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (r) => requests.push(r.url()));
    await page.goto("/");
    const card = page.getByRole("region", { name: "Cookies and measuring visits" });
    await expect(card).toBeVisible();
    const left = await card.getByRole("button", { name: "Essential only" }).boundingBox();
    const right = await card.getByRole("button", { name: "Accept analytics" }).boundingBox();
    expect(left && right && left.x < right.x).toBe(true);
    expect(left && right && Math.abs(left.height - right.height) < 1).toBe(true);
    expect(requests.some((u) => /googletagmanager|facebook|google-analytics/.test(u))).toBe(false);
  });

  test("the choice is remembered, and it can be changed from the footer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Essential only" }).click();
    await expect(page.getByRole("region", { name: "Cookies and measuring visits" })).toHaveCount(0);
    expect(
      JSON.parse((await page.evaluate(() => localStorage.getItem("LBS_CONSENT_V1"))) ?? "{}"),
    ).toMatchObject({ choice: "essential" });
    await page.reload();
    await expect(page.getByRole("region", { name: "Cookies and measuring visits" })).toHaveCount(0);
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await page.getByRole("button", { name: "Accept analytics" }).click();
    expect(
      JSON.parse((await page.evaluate(() => localStorage.getItem("LBS_CONSENT_V1"))) ?? "{}"),
    ).toMatchObject({ choice: "all" });
  });

  test("the card does not make a phone page scroll sideways", async ({ page }) => {
    await page.goto("/shop");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe("installable app (Q-01, Q-02, Q-03)", () => {
  test("the manifests, icons, offline page and workers are served", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
    const admin = await (await request.get("/admin/manifest.webmanifest")).json();
    expect(admin.start_url).toBe("/admin");
    expect((await request.get("/offline")).status()).toBe(200);
    const sw = await request.get("/sw.js");
    expect(sw.headers()["content-type"]).toContain("javascript");
    expect(await sw.text()).toContain("/offline");
    expect((await request.get("/admin/sw.js")).headers()["service-worker-allowed"]).toBe("/admin");
  });
  test("the offline page reads well on a phone", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
  });
});

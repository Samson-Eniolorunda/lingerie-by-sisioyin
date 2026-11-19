import { test as base, expect } from "@playwright/test";

/**
 * Every navigation waits for the shell to finish hydrating (`html[data-hydrated]`), so a test never
 * taps a server-rendered control before its handler is attached.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    // Most tests are not about cookies: answer the consent card up front. The consent spec opts out.
    await page.addInitScript(() => {
      if (!window.sessionStorage.getItem("LBS_TEST_NO_CONSENT_PRESET"))
        window.localStorage.setItem(
          "LBS_CONSENT_V1",
          JSON.stringify({ choice: "essential", version: 1, at: "2026-01-01T00:00:00.000Z" }),
        );
    });
    const goto = page.goto.bind(page);
    page.goto = async (url, options) => {
      const response = await goto(url, options);
      await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
      return response;
    };
    const baseURL = process.env.BASE_URL ?? "http://localhost:3100";
    await page.context().addCookies([{ name: "lbs_consent", value: "essential", url: baseURL }]);
    await provide(page);
  },
});

export { expect };

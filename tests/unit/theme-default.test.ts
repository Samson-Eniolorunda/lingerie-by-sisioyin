import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

describe("theme default", () => {
  it("opens in light unless the visitor chose otherwise", () => {});

  const run = (stored: string | null, prefersDark: boolean) => {
    const root = { dataset: {} as Record<string, string>, style: { setProperty() {} } };
    const g = globalThis as Record<string, unknown>;
    const saved = { localStorage: g.localStorage, matchMedia: g.matchMedia, document: g.document };
    g.localStorage = { getItem: (k: string) => (k === "LBS_THEME" ? stored : null) };
    g.matchMedia = () => ({ matches: prefersDark });
    g.document = { documentElement: root, querySelector: () => null };
    try {
      new Function(THEME_INIT_SCRIPT)();
    } finally {
      Object.assign(g, saved);
    }
    return root.dataset.theme;
  };

  it("ignores a dark device setting when nothing is stored", () => {
    expect(run(null, true)).toBe("light");
  });
  it("honours stored dark and system", () => {
    expect(run("dark", false)).toBe("dark");
    expect(run("system", true)).toBe("dark");
    expect(run("light", true)).toBe("light");
  });
  it("treats an unknown stored value as light, as the theme control does", () => {
    expect(run("auto", true)).toBe("light");
    expect(run("", true)).toBe("light");
  });
});

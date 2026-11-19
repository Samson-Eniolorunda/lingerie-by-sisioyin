import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { BRAND } from "@/config/site";

const OLD_NAME = /lingerie\s+by\s+sisioyin/i;
const NEW_NAME = /lingeries\s+by\s+sisioyin/i;

function trackedTextFiles(): string[] {
  const out = execFileSync("git", ["ls-files"], { encoding: "utf8" });
  return out
    .split("\n")
    .filter((f) => /\.(tsx?|json|md|sql|mjs|css|html|txt|webmanifest)$/.test(f))
    .filter((f) => f !== "package-lock.json" && f !== "tests/unit/brand.test.ts");
}

describe("brand name", () => {
  it("is exactly Lingeries by Sisioyin", () => {
    expect(BRAND.name).toBe("Lingeries by Sisioyin");
    expect(manifest().name ?? "").toMatch(NEW_NAME);
  });
  it("the old singular name appears in no tracked file", () => {
    const offenders = trackedTextFiles().filter((f) => OLD_NAME.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});

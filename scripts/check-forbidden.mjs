import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["src", "tests", "scripts"];
const patterns = [
  [/@ts-ignore|@ts-expect-error|@ts-nocheck/, "TypeScript suppression"],
  [/eslint-disable/, "ESLint suppression"],
  [/\bas any\b/, "`as any`"],
  [/as unknown as/, "`as unknown as`"],
  [/console\.log/, "console.log"],
  [/\b(TODO|FIXME|XXX)\b/, "TODO marker"],
  [/lorem ipsum/i, "lorem ipsum"],
  [/\b(Unlock|Elevate|Seamless|Revolutionize|Supercharge|Empower|Next-level)\b/, "banned phrase"],
  [/your all-in-one solution|built for the future/i, "banned phrase"],
  [
    /(linear|radial|conic)-gradient|bg-gradient|backdrop-blur|backdrop-filter/,
    "gradient or glass effect",
  ],
];

const self = "scripts/check-forbidden.mjs";
const failures = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|css|mjs)$/.test(name) && path !== self) scan(path);
  }
}

function scan(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [pattern, label] of patterns) {
      if (pattern.test(line)) failures.push(`${path}:${i + 1}: ${label}`);
    }
  });
}

for (const root of roots) walk(root);
if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write("check:forbidden passed\n");

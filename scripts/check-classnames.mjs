/**
 * Fails when a component builds a conflicting CSS position, which has bitten
 * this project twice (a shifted photo, a collapsed 3D canvas):
 *   1. two position utilities in one class string   "relative absolute"
 *   2. a position glued in front of, or behind, a caller-supplied className
 *      `relative ${className}`  → use withPosition() from src/lib/ui.ts
 * Tailwind gives no error and `relative` silently beats `absolute`, so
 * `inset-*` becomes an offset instead of sizing the box.
 *
 * Run by `npm run lint`.
 */
import fs from "node:fs";
import path from "node:path";

const POSITIONS = new Set(["relative", "absolute", "fixed", "sticky"]);
const problems = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|jsx)$/.test(entry.name)) check(full);
  }
}

function check(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const where = `${file}:${i + 1}`;
    // 1. Conflicting positions inside any single string.
    for (const m of line.matchAll(/(["'`])((?:(?!\1).)*)\1/g)) {
      const hits = new Set(m[2].split(/\s+/).filter((t) => POSITIONS.has(t)));
      if (hits.size > 1) problems.push(`${where}: conflicting position classes ${[...hits].join(" + ")}`);
    }
    // 2. A position utility next to an interpolated className.
    const pos = "(relative|absolute|fixed|sticky)";
    const joined = new RegExp(`\`\\s*${pos}\\s+\\$\\{[^}]*[cC]lass[^}]*\\}|\\$\\{[^}]*[cC]lass[^}]*\\}\\s+${pos}\\b`);
    if (joined.test(line)) {
      problems.push(`${where}: a position class is joined to a caller className; use withPosition() (src/lib/ui.ts)`);
    }
  });
}

walk("src");
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-classnames: ok");

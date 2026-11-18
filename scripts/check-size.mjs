// Fails when a built entry point grows past its budget in size-budget.json.
//
// An entry's size is the entry file plus every chunk it statically imports,
// which is what a program loads up front. Chunks behind a dynamic import() are
// reported beside it but not budgeted. Sizes are uncompressed bytes.
// Run `build:lib` first. Pass --update to rewrite the budget from this build.
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const budgetPath = join(root, "size-budget.json");
const update = process.argv.includes("--update");
/** Room above the measured size when the budget is rewritten. */
const HEADROOM = 1.03;

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));

/** Every file reachable from `entry` through relative imports: static only, or dynamic import() too. */
function reachable(entry, { dynamic = false } = {}) {
  const pattern = dynamic
    ? /(?:from|import)\s*\(?\s*["']\.\/([^"']+\.js)["']/g
    : /(?:from|import)\s*["']\.\/([^"']+\.js)["']/g;
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(join(dist, file), "utf8");
    for (const match of code.matchAll(pattern)) visit(match[1]);
  };
  visit(entry);
  return [...seen];
}

const bytesOf = (files) => files.reduce((total, file) => total + statSync(join(dist, file)).size, 0);

const kB = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
let failed = false;

for (const [entry, limit] of Object.entries(budget.entries)) {
  if (!existsSync(join(dist, entry))) {
    console.error(`${entry}: missing from dist. Run build:lib first, or remove it from size-budget.json.`);
    failed = true;
    continue;
  }
  const files = reachable(entry);
  const size = bytesOf(files);
  // Chunks behind a dynamic import() load only when that code runs. Reported, not budgeted.
  const lazy = bytesOf(reachable(entry, { dynamic: true }).filter((file) => !files.includes(file)));
  const onDemand = lazy > 0 ? `, plus ${kB(lazy)} loaded on demand` : "";
  if (update) {
    budget.entries[entry] = Math.ceil((size * HEADROOM) / 1000) * 1000;
    console.log(`${entry}: ${kB(size)}${onDemand}, budget set to ${kB(budget.entries[entry])}`);
  } else if (size > limit) {
    console.error(`${entry}: ${kB(size)} is over its ${kB(limit)} budget by ${kB(size - limit)}.`);
    failed = true;
  } else {
    console.log(`${entry}: ${kB(size)} of ${kB(limit)}${onDemand}`);
  }
}

if (update) {
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
} else if (failed) {
  console.error(
    "\nFind what grew before raising a budget. If the growth is intended, run `node scripts/check-size.mjs --update` and commit size-budget.json.",
  );
  process.exit(1);
}

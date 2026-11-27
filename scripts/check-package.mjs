// Checks the package as npm would publish it. Run `build:lib` first.
//
// - Every file `npm pack` would include matches ALLOWED, so no source map, demo
//   asset, test or stray file ships; every file "exports" names is present; and
//   `pnpm pack` (what check:consumer installs) lists the same files.
// - The packed and unpacked sizes stay within "package" in size-budget.json.
// - The manifest: no runtime "dependencies" (the editor bundles lit and lucide),
//   every peer optional, and "homepage" and "bugs" on the "repository" URL, so a
//   repository move fails here until all three agree.
// - publint and @arethetypeswrong/cli (ESM-only profile: the package has no
//   CommonJS build) pass on the real tarball.
//
//   --update   rewrite the "package" budget from this build
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const budgetPath = join(root, "size-budget.json");
const update = process.argv.includes("--update");
/** Room above the measured size when the budget is rewritten. */
const HEADROOM = 1.05;

/** The only files the tarball may contain. */
const ALLOWED = [
  /^package\.json$/,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^LICENSE$/,
  /^llms(?:-full)?\.txt$/,
  /^dist\/[\w-]+\.js$/,
  /^dist\/(?:[\w-]+\/)*[\w-]+\.d\.ts$/,
  /^skills\/fenrir\/SKILL\.md$/,
  /^skills\/fenrir\/(?:references|api)\/[\w.-]+\.md$/,
];

const failures = [];
const fail = (message) => failures.push(message);
const kB = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
// On Windows npm and pnpm are .cmd shims, which execFileSync runs only through a shell.
const run = (command, args, options = {}) =>
  execFileSync(command, args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32", ...options });

if (!existsSync(join(root, "dist", "index.js"))) {
  console.error("dist/index.js is missing. Run build:lib first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// --- Manifest ----------------------------------------------------------------

if (Object.keys(manifest.dependencies ?? {}).length > 0) {
  fail(`"dependencies" must be empty, but lists ${Object.keys(manifest.dependencies).join(", ")}. Bundle it into the entry that uses it, or make it an optional peer.`);
}
for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
  if (manifest.peerDependenciesMeta?.[peer]?.optional !== true) {
    fail(`peer "${peer}" is not optional: add it to "peerDependenciesMeta" with "optional": true. Only the entry that uses a peer needs it.`);
  }
}
const repo = /^git\+(https:\/\/github\.com\/[^/]+\/[^/]+?)\.git$/.exec(manifest.repository?.url ?? "")?.[1];
if (!repo) {
  fail(`"repository.url" must be "git+https://github.com/<owner>/<name>.git", not "${manifest.repository?.url}".`);
} else {
  if (manifest.homepage !== `${repo}#readme`) fail(`"homepage" must be "${repo}#readme" (from "repository").`);
  if (manifest.bugs?.url !== `${repo}/issues`) fail(`"bugs.url" must be "${repo}/issues" (from "repository").`);
}
if (manifest.publishConfig?.access !== "public") fail(`"publishConfig.access" must be "public".`);

// --- Files ---------------------------------------------------------------------

const [npmPack] = JSON.parse(run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts", "--loglevel=error"]));
const files = npmPack.files.map((file) => file.path.replaceAll("\\", "/"));

for (const file of files) {
  if (!ALLOWED.some((pattern) => pattern.test(file))) fail(`the tarball would contain ${file}, which is not in ALLOWED in scripts/check-package.mjs.`);
}

const targets = new Set(["package.json"]);
const collect = (value) => {
  if (typeof value === "string") targets.add(value.replace(/^\.\//, ""));
  else if (value && typeof value === "object") Object.values(value).forEach(collect);
};
collect(manifest.exports);
for (const field of ["main", "module", "types"]) collect(manifest[field]);
for (const target of targets) {
  if (!files.includes(target)) fail(`"${target}", named by package.json, is not in the tarball.`);
}

const pnpmPack = JSON.parse(run("pnpm", ["pack", "--dry-run", "--json"]));
const pnpmFiles = new Set(pnpmPack.files.map((file) => file.path.replaceAll("\\", "/")));
const onlyNpm = files.filter((file) => !pnpmFiles.has(file));
const onlyPnpm = [...pnpmFiles].filter((file) => !files.includes(file));
if (onlyNpm.length + onlyPnpm.length > 0) {
  fail(`npm pack and pnpm pack disagree. Only npm: ${onlyNpm.join(", ") || "none"}. Only pnpm: ${onlyPnpm.join(", ") || "none"}.`);
}

// --- Size ----------------------------------------------------------------------

const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
const measured = { packed: npmPack.size, unpacked: npmPack.unpackedSize, files: files.length };
console.log(`tarball: ${kB(measured.packed)} packed, ${kB(measured.unpacked)} unpacked, ${measured.files} files`);
if (update) {
  budget.package = {
    packed: Math.ceil((measured.packed * HEADROOM) / 1000) * 1000,
    unpacked: Math.ceil((measured.unpacked * HEADROOM) / 1000) * 1000,
  };
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`budget rewritten: ${kB(budget.package.packed)} packed, ${kB(budget.package.unpacked)} unpacked`);
} else if (!budget.package) {
  fail(`size-budget.json has no "package" budget. Run \`node scripts/check-package.mjs --update\`.`);
} else {
  for (const key of ["packed", "unpacked"]) {
    if (measured[key] > budget.package[key]) {
      fail(`the tarball is ${kB(measured[key])} ${key}, over its ${kB(budget.package[key])} budget. Find what grew; raise it with \`node scripts/check-package.mjs --update\` only if the growth is intended.`);
    }
  }
}

// --- publint and attw on the real tarball ---------------------------------------

const work = mkdtempSync(join(tmpdir(), "fenrir-pack-"));
try {
  run("npm", ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", work], { stdio: ["ignore", "ignore", "pipe"] });
  const tarball = join(work, `${manifest.name}-${manifest.version}.tgz`);
  for (const [name, args] of [
    ["publint", ["exec", "publint", tarball]],
    ["attw", ["exec", "attw", tarball, "--profile", "esm-only"]],
  ]) {
    try {
      const output = run("pnpm", args, { stdio: ["ignore", "pipe", "pipe"] });
      console.log(`${name}: passed`);
      if (/Suggestions:|Warnings:/.test(output)) console.log(output.trim().replace(/^/gm, "  "));
    } catch (error) {
      fail(`${name} failed:\n${`${error.stdout ?? ""}${error.stderr ?? ""}`.trim()}`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
console.log("package: files, manifest, size, publint and attw pass.");

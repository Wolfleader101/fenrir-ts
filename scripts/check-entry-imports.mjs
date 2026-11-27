// Fails when a built entry point can reach a peer package it must not load.
//
// Core (`fenrir-ts`, dist/index.js) may load none of the renderer or physics
// packages. Each other entry may load only its own peers, so
// a 2D game (core plus fenrir-ts/2d) never loads Three.js.
//
// For each entry it walks the entry file and every chunk it imports, statically
// or with a dynamic import(), and fails if any of them:
// - imports a package the entry may not load, or a subpath of it (static or dynamic import)
// - was built from a file inside such a package (read from the chunk's source map,
//   so code bundled in rather than imported is caught too)
// - contains embedded image data (no entry ships images: games load their own)
// Run `build:lib` first.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

/** Packages no entry may load unless it lists them. Matched with their subpaths. */
const PEERS = [
  "pixi.js",
  "three",
  "jolt-physics",
];
/** What each entry may load. */
const ENTRIES = {
  "index.js": { name: "fenrir-ts (core)", allow: [] },
  "2d.js": { name: "fenrir-ts/2d", allow: ["pixi.js"] },
  "3d.js": { name: "fenrir-ts/3d", allow: ["three"] },
  "physics.js": { name: "fenrir-ts/physics", allow: ["jolt-physics", "three"] },
  "audio.js": { name: "fenrir-ts/audio", allow: [] },
  "ui.js": { name: "fenrir-ts/ui", allow: ["pixi.js"] },
};

const peerOf = (specifier) =>
  PEERS.find((name) => specifier === name || specifier.startsWith(`${name}/`));

/**
 * Every file reachable from `entry` through relative imports, static or dynamic.
 * A chunk loaded on demand still runs in the program, so it obeys the same rules.
 */
function reachable(entry) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(join(dist, file), "utf8");
    for (const match of code.matchAll(/(?:from|import)\s*\(?\s*["']\.\/([^"']+\.js)["']/g)) visit(match[1]);
  };
  visit(entry);
  return [...seen];
}

/** Why `file` breaks the rules of `rules`, if it does. */
function problemsIn(file, rules) {
  const problems = [];
  const forbidden = (peer) => peer && !rules.allow.includes(peer);
  const code = readFileSync(join(dist, file), "utf8");

  // Bare specifiers in static imports, re-exports and dynamic imports.
  for (const match of code.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*["']([^"'.][^"']*)["']/g)) {
    const peer = peerOf(match[1]);
    if (forbidden(peer)) problems.push(`${file} imports "${match[1]}" (${peer})`);
  }

  if (/data:image\//.test(code)) {
    problems.push(`${file} contains embedded image data (data:image/...)`);
  }

  const mapPath = join(dist, `${file}.map`);
  if (!existsSync(mapPath)) {
    problems.push(`${file} has no source map, so its bundled sources cannot be checked`);
    return problems;
  }
  const { sources = [] } = JSON.parse(readFileSync(mapPath, "utf8"));
  for (const source of sources) {
    const path = resolve(dist, dirname(file), source).replaceAll("\\", "/");
    const fromPackage = /\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/.exec(path);
    const peer = fromPackage && peerOf(fromPackage[1]);
    if (forbidden(peer)) problems.push(`${file} bundles ${source} (${peer})`);
  }
  return problems;
}

let failed = false;

for (const [entry, rules] of Object.entries(ENTRIES)) {
  if (!existsSync(join(dist, entry))) {
    console.error(`${entry}: missing from dist. Run build:lib first.`);
    failed = true;
    continue;
  }
  const files = reachable(entry);
  const problems = files.flatMap((file) => problemsIn(file, rules));
  const allowed = rules.allow.length > 0 ? rules.allow.join(", ") : "no peer packages";
  if (problems.length > 0) {
    failed = true;
    console.error(`${rules.name} (${entry}) may load ${allowed}, but it reaches:`);
    for (const problem of problems) console.error(`  - ${problem}`);
  } else {
    const chunks = files.filter((file) => file !== entry);
    console.log(`${rules.name}: ${entry} and ${chunks.length} chunks (${chunks.join(", ")}) load ${allowed}.`);
  }
}

if (failed) {
  console.error(
    "\nCore (fenrir-ts) must load no Pixi, Three or Jolt code, no entry may embed images," +
      " and each other entry only its own peers. Move the import into the entry that owns it.",
  );
  process.exit(1);
}

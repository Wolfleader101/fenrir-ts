#!/usr/bin/env node
// fenrir-ts create <dir>: copies the starter game in templates/game-2d/ into a new folder.
// No prompts, no other options and no install, so a script or an agent can run it as is.
// It ships in the package but no entry point imports it, so no game bundles it.
import { cpSync, existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `Usage: npx fenrir-ts@latest create <dir>

Creates a new Fenrir 2D game in <dir>, which must not exist or must be empty:
a pixi2d game, a headless test, a browser test, a CI workflow and agent instructions.`;

const fail = (message) => {
  console.error(`fenrir-ts: ${message}\n\n${USAGE}`);
  process.exit(1);
};

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  console.log(USAGE);
  process.exit(args.length === 0 ? 1 : 0);
}
const [command, dir, ...rest] = args;
if (command !== "create") fail(`unknown command "${command}".`);
if (!dir || dir.startsWith("-")) fail("name the folder to create.");
if (rest.length > 0) fail(`unexpected argument "${rest[0]}".`);

const root = fileURLToPath(new URL("..", import.meta.url));
const template = resolve(root, "templates", "game-2d");
const engine = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const target = resolve(process.cwd(), dir);

if (existsSync(target) && readdirSync(target).length > 0) fail(`${target} is not empty.`);

cpSync(template, target, { recursive: true });
// npm leaves .gitignore out of a published package, so the template keeps it without the dot.
renameSync(resolve(target, "gitignore"), resolve(target, ".gitignore"));

const name = basename(target).toLowerCase().replace(/[^a-z0-9._~-]+/g, "-").replace(/^[._-]+|-+$/g, "") || "fenrir-game";
const { devDependencies, ...manifest } = JSON.parse(readFileSync(resolve(target, "package.json"), "utf8"));
const created = {
  ...manifest,
  name,
  // fenrir-ts is the version that created the game; pixi.js is the range that version supports.
  dependencies: { "fenrir-ts": `~${engine.version}`, "pixi.js": engine.peerDependencies["pixi.js"] },
  devDependencies,
};
writeFileSync(resolve(target, "package.json"), `${JSON.stringify(created, null, 2)}\n`);

const cd = relative(process.cwd(), target) || ".";
console.log(`Created ${name} in ${target} with fenrir-ts ${engine.version}.

Next:
  cd ${cd.includes(" ") ? `"${cd}"` : cd}
  npm install
  npm test
  npm run dev
  npx playwright install chromium && npm run test:e2e

Commit package-lock.json: the CI workflow in .github/ runs npm ci.
Coding agents: AGENTS.md points them at the engine's guide in node_modules/fenrir-ts/skills/fenrir/.`);

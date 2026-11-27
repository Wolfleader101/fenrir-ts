// Creates the starter game the way a user does and runs its own checks. Run `build:lib` first.
//
// Packs the package, unpacks the tarball, runs its `bin/fenrir-ts.js create` into a temporary
// folder, and checks the created package.json: `fenrir-ts` is `~` the packed version, `pixi.js`
// is the peer range, and the template's typescript and vitest majors are the engine's (the
// versions this repository tests with). Then installs it with npm, with fenrir-ts from the
// tarball, and runs the game's `type-check`, `test` and `build`. Needs the network. CI runs it
// with the runner's npm 10.9 on purpose: npm before 11.6 crashes on vitest 4.1's peers
// ("reading 'edgesOut'"), which is why the template pins vitest ~4.0, and a user on Node 22's
// npm must be able to install the game.
//   --e2e    also install Chromium for Playwright (with its system packages when CI is set) and
//            run the game's browser test, `npm run test:e2e`
//   --keep   leave the temporary folder in place and print where it is
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const e2e = process.argv.includes("--e2e");
const engine = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// On Windows npm and npx are .cmd shims, which execFileSync runs only through a shell.
const run = (command, args, cwd, stdio = "pipe") => {
  console.log(`$ ${command} ${args.join(" ")}`);
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: stdio === "inherit" ? "inherit" : ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && command !== process.execPath,
  });
};
const major = (range) => /\d+/.exec(range ?? "")?.[0];

const work = mkdtempSync(join(tmpdir(), "fenrir-template-"));
const failures = [];
try {
  run("npm", ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", work], root);
  const tarball = readdirSync(work).find((file) => file.endsWith(".tgz"));
  mkdirSync(join(work, "unpacked"));
  run("tar", ["-xzf", join("..", tarball), "-C", "."], join(work, "unpacked"));

  const game = join(work, "my-game");
  run(process.execPath, [join(work, "unpacked", "package", "bin", "fenrir-ts.js"), "create", game], work);
  const created = JSON.parse(readFileSync(join(game, "package.json"), "utf8"));

  if (created.name !== "my-game") failures.push(`the created package is named "${created.name}", not "my-game".`);
  if (created.dependencies?.["fenrir-ts"] !== `~${engine.version}`)
    failures.push(`the created game depends on fenrir-ts ${created.dependencies?.["fenrir-ts"]}, not ~${engine.version}, the version that created it.`);
  if (created.dependencies?.["pixi.js"] !== engine.peerDependencies["pixi.js"])
    failures.push(`the created game depends on pixi.js ${created.dependencies?.["pixi.js"]}, not the peer range ${engine.peerDependencies["pixi.js"]}.`);
  for (const tool of ["typescript", "vitest"]) {
    if (major(created.devDependencies?.[tool]) !== major(engine.devDependencies[tool]))
      failures.push(`templates/game-2d/package.json has ${tool} ${created.devDependencies?.[tool]}, a different major from the engine's ${engine.devDependencies[tool]}: test the template with the versions the engine uses.`);
  }
  if (!readdirSync(game).includes(".gitignore")) failures.push("the created game has no .gitignore.");
  if (failures.length > 0) throw new Error("the created package.json is wrong");

  // Install fenrir-ts from the tarball, not the registry: this is the version under test.
  created.dependencies["fenrir-ts"] = `file:${join(work, tarball).replaceAll("\\", "/")}`;
  writeFileSync(join(game, "package.json"), `${JSON.stringify(created, null, 2)}\n`);
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], game, "inherit");
  for (const script of ["type-check", "test", "build"]) run("npm", ["run", script], game, "inherit");
  if (e2e) {
    run("npx", ["playwright", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"], game, "inherit");
    run("npm", ["run", "test:e2e"], game, "inherit");
  }
} catch (error) {
  if (failures.length === 0) failures.push(`${error.message}${error.stdout ? `\n${error.stdout}` : ""}${error.stderr ? `\n${error.stderr}` : ""}`.trim());
} finally {
  if (keep) console.log(`kept in ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`template: created from the packed fenrir-ts ${engine.version}; type-check, test, build${e2e ? " and test:e2e" : ""} pass.`);

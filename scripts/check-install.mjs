// Installs the packed package the way a consumer does and checks it works.
// Run `build:lib` first.
//
// For npm and pnpm, in fresh projects in the OS temp directory:
// - "2d": fenrir-ts and pixi.js (the version this repository tests with)
// - "core": fenrir-ts alone
// each must install with no peer warnings, import its entries in Node (and
// run a test game), fail to import fenrir-ts/3d with an error naming `three`,
// and type-check with `skipLibCheck: false` under "moduleResolution" "bundler"
// and "nodenext". The 2D type-check uses sprite2D and requestTexture2D, which
// fenrir-ts/2d adds to AssetStore by module augmentation.
//
// check:consumer measures bundles from the packed files but never runs a
// package manager, so peer metadata and consumer type resolution are checked
// only here. Needs the network for pixi.js.
//   --keep   leave the temporary projects in place and print where they are
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const pixi = JSON.parse(readFileSync(join(root, "node_modules", "pixi.js", "package.json"), "utf8")).version;

// On Windows npm and pnpm are .cmd shims, which execFileSync runs only through a
// shell; node itself runs without one (its path may contain spaces).
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && command !== process.execPath,
  });
/** Runs and returns stdout and stderr together, and whether it exited 0. */
const attempt = (command, args, cwd) => {
  try {
    return { ok: true, output: run(command, args, cwd) };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
};

const RUN = `
const core = await import("fenrir-ts");
const game = await core.createTestGame({ seed: 1 });
await game.start();
game.step(1 / 60);
if (process.argv[2] === "2d") {
  const twoD = await import("fenrir-ts/2d");
  const ui = await import("fenrir-ts/ui");
  if (typeof twoD.pixi2d !== "function" || typeof ui.control !== "function") throw new Error("fenrir-ts/2d or fenrir-ts/ui is missing exports");
}
try {
  await import("fenrir-ts/3d");
  throw new Error("fenrir-ts/3d imported without three");
} catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND" || !/'three'/.test(error.message)) throw error;
}
console.log("ok");
`;

const TYPES = {
  core: `import { createTestGame, defineComponent } from "fenrir-ts";
const Score = defineComponent<{ value: number }>("m.Score");
export const game = createTestGame({ seed: 1 });
export { Score };
`,
  "2d": `import { AssetStore, EntityBuilder, EntityList, assetKey, createTestGame } from "fenrir-ts";
import { pixi2d, Renderable2D, sprite2D, Transform2D } from "fenrir-ts/2d";
import { control } from "fenrir-ts/ui";
const entities = new EntityList();
// A Renderable2D value, and the AssetStore augmentation from fenrir-ts/2d.
EntityBuilder.create().transform2D(1, 2).with(Renderable2D, sprite2D("hero.png")).spawn(entities);
const status: "loading" | "ready" | "failed" = new AssetStore().requestTexture2D(assetKey("hero"), "hero.png").state.status;
export { createTestGame, pixi2d, Transform2D, control, status };
`,
};

const work = mkdtempSync(join(tmpdir(), "fenrir-install-"));
const failures = [];
try {
  run("npm", ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", work], root);
  const tarball = join(work, readdirSync(work).find((file) => file.endsWith(".tgz")));

  for (const manager of ["npm", "pnpm"]) {
    for (const kind of ["2d", "core"]) {
      const name = `${manager} ${kind === "2d" ? `fenrir-ts + pixi.js@${pixi}` : "fenrir-ts alone"}`;
      const dir = join(work, `${manager}-${kind}`);
      mkdirSync(dir);
      writeFileSync(join(dir, "package.json"), `${JSON.stringify({ name: "consumer", private: true, type: "module" })}\n`);
      const packages = kind === "2d" ? [tarball, `pixi.js@${pixi}`] : [tarball];
      const install = attempt(manager, manager === "npm" ? ["install", "--no-audit", "--no-fund", ...packages] : ["add", ...packages], dir);
      if (!install.ok) {
        failures.push(`${name}: install failed:\n${install.output.trim()}`);
        continue;
      }
      const warnings = install.output.split("\n").filter((line) => /peer/i.test(line));
      if (warnings.length > 0) failures.push(`${name}: install warned:\n${warnings.join("\n")}`);

      writeFileSync(join(dir, "run.mjs"), RUN);
      const node = attempt(process.execPath, ["run.mjs", kind], dir);
      if (!node.ok || node.output.trim() !== "ok") failures.push(`${name}: importing the entries failed:\n${node.output.trim()}`);

      writeFileSync(join(dir, "main.ts"), TYPES[kind]);
      for (const resolution of ["bundler", "nodenext"]) {
        const args = [tsc, "--noEmit", "--strict", "--skipLibCheck", "false", "--target", "es2022", "--lib", "es2022,dom",
          "--module", resolution === "bundler" ? "esnext" : "nodenext", "--moduleResolution", resolution, "main.ts"];
        const types = attempt(process.execPath, args, dir);
        if (!types.ok) failures.push(`${name}: tsc --moduleResolution ${resolution} failed:\n${types.output.trim()}`);
      }
      console.log(`${name}: ${failures.some((failure) => failure.startsWith(`${name}:`)) ? "FAILED" : "installs with no peer warnings, imports, and type-checks (bundler, nodenext)"}`);
    }
  }
} finally {
  if (keep) console.log(`projects kept in ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("install: npm and pnpm, with and without pixi.js, pass.");

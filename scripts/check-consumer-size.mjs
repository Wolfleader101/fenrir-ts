// Measures what a consumer ships: bundles the fixture games in scripts/consumer/
// with Vite in production mode against the packed fenrir-ts, and fails when a
// fixture's engine code grows past its budget in size-budget.json ("consumers").
//
// The package is installed into a temporary node_modules from the files
// `pnpm pack` would publish, so the fixtures resolve fenrir-ts through its
// package.json "exports" and "sideEffects", as a consumer's bundler does.
// pixi.js is external: only engine code is counted. Engine bytes are the
// minified output minus the bytes the bundle's source map attributes to the
// fixture itself; gzip is measured over those engine bytes.
//
// side-effects-2d.js is also run in Node after bundling: it fails if the bundler
// dropped a module that fenrir-ts/2d needs for its side effects.
//
// The measured fixtures import no 3D entry, so their engine code must not
// contain the 3D-only members that fenrir-ts/3d adds to core classes. Only
// game-2d-motion uses timers and tweens, game-2d-assets an asset manifest,
// game-2d-audio fenrir-ts/audio, game-2d-storage storage, game-2d-inspector
// inspect(game) and game-2d-ui fenrir-ts/ui: the others must not ship that code.
//
// Run `build:lib` first.
//   --update        rewrite the consumer budgets from this build
//   --breakdown     list the source modules in each fixture bundle, largest first
import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "scripts", "consumer");
const budgetPath = join(root, "size-budget.json");
const update = process.argv.includes("--update");
const showBreakdown = process.argv.includes("--breakdown");
/** Room above the measured size when the budget is rewritten. */
const HEADROOM = 1.03;

/** Fixtures measured against a budget. */
const MEASURED = ["game-2d", "core-only", "game-2d-motion", "game-2d-assets", "game-2d-audio", "game-2d-storage", "game-2d-inspector", "game-2d-ui"];
/** Fixtures run after bundling. */
const RUN = ["side-effects-2d"];
/** Members fenrir-ts/3d adds to core classes. A fixture without fenrir-ts/3d must not ship them. */
const THREE_D_ONLY = /\b(?:setSkybox|removeSkybox|hasSkybox)\b/g;
/**
 * The EntityBuilder methods fenrir-ts/2d added at import before 0.3.0. No fixture uses them, so a
 * bundle that holds one means import-time builder patching came back.
 */
const OLD_2D_BUILDER = /\b(?:pixiNode|renderSprite|renderCircle|renderRect|renderText)\b/g;
/** Names only the timers and tweens code holds. A fixture that does not import them must not ship them. */
const MOTION_ONLY = /fenrir\.(?:motion|Timers|Tweens|MotionSettings)\b/g;
/** Fixtures that use timers and tweens. */
const USES_MOTION = ["game-2d-motion"];
/** Names only the asset manifest code holds. */
const MANIFEST_ONLY = /fenrir\.assets\.\w+|defineAssets\(/g;
/** Fixtures that declare an asset manifest. */
const USES_MANIFEST = ["game-2d-assets"];
/** Names only the audio code holds. */
const AUDIO_ONLY = /fenrir\.(?:audio|AudioState)\b/g;
/** Fixtures that play sounds. */
const USES_AUDIO = ["game-2d-audio"];
/** Names only the storage code holds. */
const STORAGE_ONLY = /fenrir\.(?:storage|StorageStatus)\b/g;
/** Fixtures that store values. */
const USES_STORAGE = ["game-2d-storage"];
/** Names only inspect(game), exposeInspector and the JSON encoder hold. */
const INSPECTOR_ONLY = /__FENRIR__|\$truncated/g;
/** Fixtures that inspect the game. */
const USES_INSPECTOR = ["game-2d-inspector"];
/**
 * What only requestTexture2D and loadTexture2D hold: their names, which survive minification
 * only as properties (AssetStore methods before 0.3.0), and the texture handle's message.
 */
const TEXTURE_REQUEST_ONLY = /(?:requestTexture2D|loadTexture2D)|Texture readiness listener failed/g;
/** Fixtures that request 2D textures by URL. None does: game-2d-assets loads through a manifest. */
const USES_TEXTURE_REQUEST = [];
/** Names only the UI controls kit holds. */
const UI_ONLY = /fenrir\.(?:ui|UiFocus|UiControls)\b/g;
/** Fixtures that use controls. */
const USES_UI = ["game-2d-ui"];

if (!existsSync(join(root, "dist", "index.js"))) {
  console.error("dist/index.js is missing. Run build:lib first.");
  process.exit(1);
}

// --- Install the packed package into a temporary consumer -------------------

const work = mkdtempSync(join(tmpdir(), "fenrir-consumer-"));
const pkgDir = join(work, "node_modules", "fenrir-ts");
writeFileSync(join(work, "package.json"), `${JSON.stringify({ private: true, type: "module" })}
`);
const packed = JSON.parse(
  execSync("pnpm pack --dry-run --json", { cwd: root, encoding: "utf8" }),
);
for (const { path } of [...packed.files, { path: "package.json" }]) {
  mkdirSync(dirname(join(pkgDir, path)), { recursive: true });
  copyFileSync(join(root, path), join(pkgDir, path));
}
// The run fixture imports the real pixi.js. A junction needs no admin rights on Windows.
symlinkSync(realpathSync(join(root, "node_modules", "pixi.js")), join(work, "node_modules", "pixi.js"), "junction");

// --- Source maps -------------------------------------------------------------

const B64 = Object.fromEntries([..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].map((c, i) => [c, i]));

/** Decodes a v3 source map's mappings into per-line arrays of [column, source, line, column]. */
function decode(mappings) {
  const lines = [];
  let source = 0;
  let line = 0;
  let column = 0;
  for (const text of mappings.split(";")) {
    const segments = [];
    let generated = 0;
    for (const segment of text.split(",")) {
      if (!segment) continue;
      const values = [];
      let value = 0;
      let shift = 0;
      for (const char of segment) {
        const digit = B64[char];
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      generated += values[0];
      if (values.length >= 4) {
        source += values[1];
        line += values[2];
        column += values[3];
        segments.push([generated, source, line, column]);
      } else {
        segments.push([generated, -1, 0, 0]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

/** The segment covering `column` on a decoded line, or undefined. */
function lookup(segments, column) {
  let found;
  for (const segment of segments ?? []) {
    if (segment[0] > column) break;
    found = segment;
  }
  return found;
}

/** dist/*.js source maps, decoded once, to attribute bundle bytes to src/ modules. */
const distMaps = new Map();
function distMap(file) {
  if (!distMaps.has(file)) {
    const mapPath = join(root, "dist", `${file}.map`);
    if (!existsSync(mapPath)) {
      distMaps.set(file, undefined);
    } else {
      const map = JSON.parse(readFileSync(mapPath, "utf8"));
      const sources = map.sources.map((source) =>
        relative(root, resolve(root, "dist", dirname(file), source)).replaceAll("\\", "/"),
      );
      distMaps.set(file, { sources, lines: decode(map.mappings) });
    }
  }
  return distMaps.get(file);
}

/**
 * Splits a bundle into bytes per original module, following the bundle's map
 * into the packed dist/ files and through their maps into src/.
 */
function attribute(code, map) {
  const lines = decode(map.mappings);
  const owners = new Array(code.length);
  let offset = 0;
  code.split("\n").forEach((text, lineIndex) => {
    const segments = lines[lineIndex] ?? [];
    for (let column = 0; column < text.length; column++) {
      const segment = lookup(segments, column);
      let owner = "(unmapped)";
      if (segment && segment[1] >= 0) {
        const source = map.sources[segment[1]].replaceAll("\\", "/");
        const inDist = /node_modules\/fenrir-ts\/(dist\/.+)$/.exec(source);
        if (inDist) {
          const file = inDist[1].slice("dist/".length);
          const inner = distMap(file);
          const original = inner && lookup(inner.lines[segment[2]], segment[3]);
          owner = original && original[1] >= 0 ? inner.sources[original[1]] : `dist/${file}`;
        } else if (source.includes("/scripts/consumer/") || !source.includes("node_modules")) {
          owner = "(fixture)";
        } else {
          owner = source.replace(/^.*node_modules\//, "");
        }
      }
      owners[offset + column] = owner;
    }
    // The newline belongs to the code before it.
    owners[offset + text.length] = owners[offset + text.length - 1] ?? "(unmapped)";
    offset += text.length + 1;
  });
  return owners;
}

// --- Bundle and measure ------------------------------------------------------

async function bundle(name) {
  const entry = join(work, `${name}.js`);
  copyFileSync(join(fixtures, `${name}.js`), entry);
  const outDir = join(work, "out", name);
  await build({
    root: work,
    configFile: false,
    logLevel: "silent",
    mode: "production",
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: true,
      modulePreload: false,
      rollupOptions: {
        input: entry,
        external: [/^pixi\.js(\/.*)?$/],
        output: { entryFileNames: "[name].js", chunkFileNames: "[name].js" },
      },
    },
  });
  return outDir;
}

function measure(outDir) {
  const perModule = new Map();
  let engine = "";
  let total = 0;
  for (const file of readdirSync(outDir).filter((f) => f.endsWith(".js"))) {
    const code = readFileSync(join(outDir, file), "utf8");
    const map = JSON.parse(readFileSync(join(outDir, `${file}.map`), "utf8"));
    const owners = attribute(code, map);
    total += Buffer.byteLength(code);
    for (let i = 0; i < code.length; i++) {
      const owner = owners[i] ?? "(unmapped)";
      perModule.set(owner, (perModule.get(owner) ?? 0) + 1);
      if (owner !== "(fixture)") engine += code[i];
    }
  }
  return {
    total,
    engine,
    minified: Buffer.byteLength(engine),
    gzip: gzipSync(engine, { level: 9 }).length,
    fixture: perModule.get("(fixture)") ?? 0,
    perModule: [...perModule].sort((a, b) => b[1] - a[1]),
  };
}

const kB = (bytes) => `${(bytes / 1000).toFixed(2)} kB`;
const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
budget.consumers ??= {};
let failed = false;

try {
  for (const name of MEASURED) {
    const result = measure(await bundle(name));
    const limit = budget.consumers[name];
    const leaked = [...new Set(result.engine.match(THREE_D_ONLY) ?? [])];
    if (leaked.length > 0) {
      console.error(`${name}: ships ${leaked.join(", ")}, which belong to fenrir-ts/3d. Move them out of core.`);
      failed = true;
    }
    const builderLeaked = [...new Set(result.engine.match(OLD_2D_BUILDER) ?? [])];
    if (builderLeaked.length > 0) {
      console.error(`${name}: ships ${builderLeaked.join(", ")}, EntityBuilder methods fenrir-ts/2d no longer adds. Use with(PixiNode, ...) or with(Renderable2D, ...) and keep 2D code tree-shakeable.`);
      failed = true;
    }
    const motionLeaked = USES_MOTION.includes(name) ? [] : [...new Set(result.engine.match(MOTION_ONLY) ?? [])];
    if (motionLeaked.length > 0) {
      console.error(`${name}: ships ${motionLeaked.join(", ")} without importing timers or tweens. Keep them tree-shakeable.`);
      failed = true;
    }
    const manifestLeaked = USES_MANIFEST.includes(name) ? [] : [...new Set(result.engine.match(MANIFEST_ONLY) ?? [])];
    if (manifestLeaked.length > 0) {
      console.error(`${name}: ships ${manifestLeaked.join(", ")} without declaring an asset manifest. Keep it tree-shakeable.`);
      failed = true;
    }
    for (const [only, users, what] of [[AUDIO_ONLY, USES_AUDIO, "playing sounds"], [STORAGE_ONLY, USES_STORAGE, "storing values"], [INSPECTOR_ONLY, USES_INSPECTOR, "calling inspect or exposeInspector"], [UI_ONLY, USES_UI, "importing fenrir-ts/ui"], [TEXTURE_REQUEST_ONLY, USES_TEXTURE_REQUEST, "calling requestTexture2D or loadTexture2D"]]) {
      const shipped = users.includes(name) ? [] : [...new Set(result.engine.match(only) ?? [])];
      if (shipped.length > 0) {
        console.error(`${name}: ships ${shipped.join(", ")} without ${what}. Keep it tree-shakeable.`);
        failed = true;
      }
    }
    const line = `${name}: engine ${kB(result.minified)} minified, ${kB(result.gzip)} gzip`;
    if (update) {
      budget.consumers[name] = {
        minified: Math.ceil((result.minified * HEADROOM) / 100) * 100,
        gzip: Math.ceil((result.gzip * HEADROOM) / 100) * 100,
      };
      console.log(`${line}, budget set to ${kB(budget.consumers[name].minified)} / ${kB(budget.consumers[name].gzip)}`);
    } else if (!limit) {
      console.error(`${line}: no budget in size-budget.json "consumers". Run with --update.`);
      failed = true;
    } else {
      const over = [
        result.minified > limit.minified && `minified is over its ${kB(limit.minified)} budget by ${kB(result.minified - limit.minified)}`,
        result.gzip > limit.gzip && `gzip is over its ${kB(limit.gzip)} budget by ${kB(result.gzip - limit.gzip)}`,
      ].filter(Boolean);
      if (over.length > 0) {
        console.error(`${line}: ${over.join("; ")}.`);
        failed = true;
      } else {
        console.log(`${line} (budget ${kB(limit.minified)} / ${kB(limit.gzip)})`);
      }
    }
    if (showBreakdown) {
      console.log(`  ${kB(result.total)} in the bundle, ${kB(result.fixture)} of it the fixture. By source module:`);
      for (const [module, bytes] of result.perModule) console.log(`  ${String(bytes).padStart(7)}  ${module}`);
    }
  }

  for (const name of RUN) {
    const outDir = await bundle(name);
    try {
      await import(pathToFileURL(join(outDir, `${name}.js`)).href);
    } catch (error) {
      console.error(`${name} failed after bundling: ${error instanceof Error ? error.message : error}`);
      failed = true;
    }
  }
} finally {
  rmSync(join(work, "node_modules", "pixi.js"), { force: true });
  rmSync(work, { recursive: true, force: true });
}

if (update) {
  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
} else if (failed) {
  console.error(
    "\nFind what grew before raising a budget. If the growth is intended, run `node scripts/check-consumer-size.mjs --update` and commit size-budget.json.",
  );
  process.exit(1);
}

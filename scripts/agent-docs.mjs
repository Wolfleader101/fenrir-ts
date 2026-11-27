// Generates the single-file copies of the shipped agent docs:
//
// - llms.txt: the index of the shipped docs, in the llms.txt format.
// - llms-full.txt: skills/fenrir/SKILL.md, every reference and the API reference of the 2D-path
//   entries in one file, for tools that read a single document.
//
//   node scripts/agent-docs.mjs          write them
//   node scripts/agent-docs.mjs --check  fail if the committed files differ from a fresh run
//
// skills/fenrir/SKILL.md and skills/fenrir/references/*.md are written by hand: each consumer rule
// lives in one of them. skills/fenrir/api/ comes from scripts/api-reference.mjs, which must run
// first (`pnpm docs:agent` runs both).
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const read = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

/** Each reference, in reading order, with what it covers. `full: false` stays out of llms-full.txt. */
const REFERENCES = [
  { file: "core.md", about: "how a game is put together and how its systems are ordered", full: true },
  { file: "testing.md", about: "`createTestGame`, `step`, and `inspect(game)`", full: true },
  { file: "input.md", about: "actions, the pointer, what `consume` hides, `onDown` and `onGesture`, and test input", full: true },
  { file: "2d.md", about: "the `pixi2d` plugin, `Viewport`, `Transform2D`, `Display2D`, `PixiNode` and layers", full: true },
  { file: "motion.md", about: "the `motion()` plugin", full: true },
  { file: "assets.md", about: "asset manifests, bundles, per-asset loading, fallbacks and optional assets", full: true },
  { file: "storage.md", about: "the `storage()` plugin, keys, migrations, families and `persistResource`", full: true },
  { file: "audio.md", about: "`fenrir-ts/audio`: sounds, buses, unlock and test audio", full: true },
  { file: "ui.md", about: "`fenrir-ts/ui`: controls, modal scopes, focus and accessibility", full: true },
  { file: "3d-and-editor.md", about: "the frozen 3D path, physics and the Monaco editor: kept working, no new features", full: false },
];

/** The API pages, as scripts/api-reference.mjs names them. Frozen entries stay out of llms-full.txt. */
const API = [
  { file: "fenrir-ts.md", entry: "fenrir-ts", full: true },
  { file: "2d.md", entry: "fenrir-ts/2d", full: true },
  { file: "ui.md", entry: "fenrir-ts/ui", full: true },
  { file: "audio.md", entry: "fenrir-ts/audio", full: true },
  { file: "3d.md", entry: "fenrir-ts/3d (frozen)", full: false },
  { file: "physics.md", entry: "fenrir-ts/physics (frozen)", full: false },
  { file: "editor.md", entry: "fenrir-ts/editor (frozen)", full: false },
];

const refDir = "skills/fenrir/references";
const listed = new Set(REFERENCES.map((ref) => ref.file));
const unlisted = readdirSync(join(root, refDir)).filter((file) => file.endsWith(".md") && !listed.has(file));
if (unlisted.length) {
  console.error(`${refDir} has files scripts/agent-docs.mjs does not list: ${unlisted.join(", ")}. Add them to REFERENCES.`);
  process.exit(1);
}
const references = new Map(REFERENCES.map((ref) => [ref.file, read(`${refDir}/${ref.file}`)]));
const titleOf = (file) => /^# (.+)$/m.exec(references.get(file))?.[1] ?? file;

const pkg = JSON.parse(read("package.json"));
const skill = read("skills/fenrir/SKILL.md");
const description = /^description: (.+)$/m.exec(skill)?.[1] ?? "";

function renderLlms() {
  const lines = [
    "# Fenrir TS",
    "",
    `> Fenrir TS is a TypeScript game engine for the browser, 2D-first on PixiJS: one package, \`${pkg.name}\`, with entry points \`fenrir-ts\` (core: ECS, named systems in stages, events, resources, states, input, timers and tweens, asset manifests, storage, test games, inspection), \`fenrir-ts/2d\` (Pixi renderer and design frame), \`fenrir-ts/ui\` (controls on Pixi nodes), \`fenrir-ts/audio\` (sounds) and the frozen \`fenrir-ts/3d\`, \`fenrir-ts/physics\` and \`fenrir-ts/editor\`. Each feature is an opt-in plugin that costs nothing when not imported, and every game runs headless under \`createTestGame\` with deterministic \`step\`.`,
    "",
    "Paths are relative to the package root (`node_modules/fenrir-ts/`). Start with the guide; it links to the rest.",
    "",
    "## Guide",
    "",
    `- [Building a game with Fenrir](skills/fenrir/SKILL.md): ${description.replace(/^Build/, "build")}`,
    "",
    "## References",
    "",
    ...REFERENCES.filter((ref) => ref.full).map((ref) => `- [${titleOf(ref.file)}](${refDir}/${ref.file}): ${ref.about}`),
    "",
    "## API reference",
    "",
    "- [Index](skills/fenrir/api/README.md): one page per entry point, generated from the TSDoc",
    ...API.filter((a) => a.full).map((a) => `- [\`${a.entry}\`](skills/fenrir/api/${a.file})`),
    "",
    "## Optional",
    "",
    "- [Everything above in one file](llms-full.txt)",
    ...REFERENCES.filter((ref) => !ref.full).map((ref) => `- [${titleOf(ref.file)}](${refDir}/${ref.file}): ${ref.about}`),
    ...API.filter((a) => !a.full).map((a) => `- [\`${a.entry}\`](skills/fenrir/api/${a.file}): kept working, no new features`),
    "- [README](README.md): an overview for people, with links to the references",
    "- [Changelog](CHANGELOG.md): breaking changes, each with a migration line",
  ];
  return lines.join("\n") + "\n";
}

function renderFull() {
  const parts = [`# Fenrir TS: the agent guide, references and API reference in one file`, "", `<!-- Generated by scripts/agent-docs.mjs from skills/fenrir/. Do not edit. -->`, ""];
  const body = skill.replace(/^---\n[\s\S]*?\n---\n/, "");
  parts.push("<!-- skills/fenrir/SKILL.md -->", "", body.trim(), "");
  for (const ref of REFERENCES.filter((r) => r.full)) parts.push(`<!-- ${refDir}/${ref.file} -->`, "", references.get(ref.file).trim(), "");
  for (const api of API.filter((a) => a.full)) {
    const path = `skills/fenrir/api/${api.file}`;
    if (!existsSync(join(root, path))) throw new Error(`${path} is missing: run node scripts/api-reference.mjs first.`);
    parts.push(`<!-- ${path} -->`, "", read(path).trim(), "");
  }
  return parts.join("\n").trimEnd() + "\n";
}

const outputs = new Map([
  ["llms.txt", renderLlms()],
  ["llms-full.txt", renderFull()],
]);

if (check) {
  const stale = [...outputs].filter(([path, text]) => !existsSync(join(root, path)) || read(path) !== text).map(([path]) => path);
  if (stale.length) {
    console.error(`Generated agent docs are stale: ${stale.join(", ")}.`);
    console.error("Run `pnpm docs:agent` and commit the result. Edit skills/fenrir/SKILL.md or skills/fenrir/references/, not the generated files.");
    process.exit(1);
  }
  console.log(`Agent docs are current (${outputs.size} files).`);
} else {
  for (const [path, text] of outputs) writeFileSync(join(root, path), text);
  console.log(`Wrote ${outputs.size} files: llms.txt, llms-full.txt.`);
}

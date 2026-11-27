// Generates the parts of the shipped agent docs that are copies, so each rule has one source:
//
// - skills/fenrir/references/*.md: the README's sections for each service. README.md is the
//   source of every consumer rule; edit it, then run `pnpm docs:agent`.
// - llms.txt: the index of the shipped docs, in the llms.txt format.
// - llms-full.txt: skills/fenrir/SKILL.md, every reference and the API reference of the 2D-path
//   entries in one file, for tools that read a single document.
//
//   node scripts/agent-docs.mjs          write them
//   node scripts/agent-docs.mjs --check  fail if the committed files differ from a fresh run
//
// skills/fenrir/SKILL.md is written by hand. skills/fenrir/api/ comes from scripts/api-reference.mjs,
// which must run first (`pnpm docs:agent` runs both).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const read = (path) => readFileSync(join(root, path), "utf8").replaceAll("\r\n", "\n");

/** Each reference: its file, title, what it covers, and the README `###` sections it is made of. */
const REFERENCES = [
  { file: "core.md", title: "Core: plugins, systems, resources, states, events, time", about: "how a game is put together and how its systems are ordered", sections: ["Plugins", "Components and systems", "Named systems", "Time and random", "Resources", "States", "Events"] },
  { file: "testing.md", title: "Testing and inspecting a game", about: "`createTestGame`, `step`, and `inspect(game)`", sections: ["Testing a game", "Inspecting a game"] },
  { file: "input.md", title: "Input", about: "actions, the pointer, what `consume` hides, `onDown` and `onGesture`, and test input", sections: ["Input"] },
  { file: "2d.md", title: "2D: pixi2d, the design frame, layers and nodes", about: "the `pixi2d` plugin, `Viewport`, `Transform2D`, `Display2D`, `PixiNode` and layers", sections: ["Quick start (2D)", "Viewport", "Scene: Transform2D, PixiNode and layers"] },
  { file: "motion.md", title: "Timers and tweens", about: "the `motion()` plugin", sections: ["Timers and tweens"] },
  { file: "assets.md", title: "Assets", about: "asset manifests, bundles, per-asset loading, fallbacks and optional assets", sections: ["Assets"] },
  { file: "storage.md", title: "Storage", about: "the `storage()` plugin, keys, migrations, families and `persistResource`", sections: ["Storage"] },
  { file: "audio.md", title: "Audio", about: "`fenrir-ts/audio`: sounds, buses, unlock and test audio", sections: ["Audio"] },
  { file: "ui.md", title: "UI controls", about: "`fenrir-ts/ui`: controls, modal scopes, focus and accessibility", sections: ["UI controls"] },
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

const readme = read("README.md");

/** README `###` sections by title, each up to the next `###` or `##`. */
function sectionsOf(markdown) {
  const out = new Map();
  const lines = markdown.split("\n");
  let title = null;
  let body = [];
  let fence = false;
  const flush = () => title !== null && out.set(title, body.join("\n").trim());
  for (const line of lines) {
    if (/^```/.test(line.trim())) fence = !fence;
    const heading = !fence && /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      flush();
      title = heading[1] === "###" ? heading[2].trim() : null;
      body = [];
    } else if (title !== null) body.push(line);
  }
  flush();
  return out;
}

const sections = sectionsOf(readme);
/** GitHub's heading anchors. */
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
/** README anchor -> the reference file (and anchor) that now holds it. */
const anchors = new Map();
for (const ref of REFERENCES) for (const title of ref.sections) anchors.set(slug(title), `${ref.file}#${slug(title)}`);

/** Rewrites README links so they work from skills/fenrir/references/. */
function relink(text, self) {
  return text.replace(/\]\(([^)\s]+)\)/g, (match, target) => {
    if (/^https?:/.test(target)) return match;
    if (target.startsWith("#")) {
      const moved = anchors.get(target.slice(1));
      if (moved) return `](${moved.startsWith(self + "#") ? moved.slice(self.length) : moved})`;
      return `](../README-sections-not-shipped${target})`;
    }
    // A repository file that does not ship with the guide: keep the text, drop the link.
    return `](https://github.com/Wolfleader101/fenrir-ts/blob/main/${target.replace(/^\.\//, "")})`;
  });
}

function renderReference(ref) {
  const out = [
    `# ${ref.title}`,
    "",
    `<!-- Generated from README.md by scripts/agent-docs.mjs. Do not edit: change README.md, then run pnpm docs:agent. -->`,
    "",
    `The full rules for ${ref.about}. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses \`game\` means the game \`createGame\` or \`createTestGame\` returned.`,
    "",
  ];
  for (const title of ref.sections) {
    const body = sections.get(title);
    if (body === undefined) throw new Error(`README.md has no "### ${title}" section, which references/${ref.file} is made of.`);
    // README's ### becomes ##; deeper headings move up one level too.
    const demoted = body.replace(/^(#{4,6}) /gm, (_m, hashes) => `${hashes.slice(1)} `);
    out.push(`## ${title}`, "", relink(demoted, ref.file), "");
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  if (text.includes("README-sections-not-shipped")) {
    const bad = [...text.matchAll(/README-sections-not-shipped(#[^)]+)/g)].map((m) => m[1]);
    throw new Error(`references/${ref.file} links to README sections that are not shipped: ${bad.join(", ")}. Link to a shipped section or reword README.md.`);
  }
  return text;
}

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
    ...REFERENCES.map((ref) => `- [${ref.title}](skills/fenrir/references/${ref.file}): ${ref.about}`),
    "",
    "## API reference",
    "",
    "- [Index](skills/fenrir/api/README.md): one page per entry point, generated from the TSDoc",
    ...API.filter((a) => a.full).map((a) => `- [\`${a.entry}\`](skills/fenrir/api/${a.file})`),
    "",
    "## Optional",
    "",
    "- [Everything above in one file](llms-full.txt)",
    ...API.filter((a) => !a.full).map((a) => `- [\`${a.entry}\`](skills/fenrir/api/${a.file}): kept working, no new features`),
    "- [README](README.md): the same rules for people, with the 3D path and the editor",
    "- [Changelog](CHANGELOG.md): breaking changes, each with a migration line",
  ];
  return lines.join("\n") + "\n";
}

function renderFull(references) {
  const parts = [`# Fenrir TS: the agent guide, references and API reference in one file`, "", `<!-- Generated by scripts/agent-docs.mjs from skills/fenrir/. Do not edit. -->`, ""];
  const body = skill.replace(/^---\n[\s\S]*?\n---\n/, "");
  parts.push("<!-- skills/fenrir/SKILL.md -->", "", body.trim(), "");
  for (const ref of REFERENCES) parts.push(`<!-- skills/fenrir/references/${ref.file} -->`, "", references.get(ref.file).trim(), "");
  for (const api of API.filter((a) => a.full)) {
    const path = `skills/fenrir/api/${api.file}`;
    if (!existsSync(join(root, path))) throw new Error(`${path} is missing: run node scripts/api-reference.mjs first.`);
    parts.push(`<!-- ${path} -->`, "", read(path).trim(), "");
  }
  return parts.join("\n").trimEnd() + "\n";
}

const references = new Map(REFERENCES.map((ref) => [ref.file, renderReference(ref)]));
const outputs = new Map([...references].map(([file, text]) => [`skills/fenrir/references/${file}`, text]));
outputs.set("llms.txt", renderLlms());
outputs.set("llms-full.txt", renderFull(references));

if (check) {
  const stale = [...outputs].filter(([path, text]) => !existsSync(join(root, path)) || read(path) !== text).map(([path]) => path);
  const refDir = join(root, "skills/fenrir/references");
  const extra = existsSync(refDir) ? readdirSync(refDir).filter((file) => !references.has(file)).map((file) => `skills/fenrir/references/${file} (not generated)`) : [];
  if (stale.length || extra.length) {
    console.error(`Generated agent docs are stale: ${[...stale, ...extra].join(", ")}.`);
    console.error("Run `pnpm docs:agent` and commit the result. Edit README.md (references) or skills/fenrir/SKILL.md, not the generated files.");
    process.exit(1);
  }
  console.log(`Agent docs are current (${outputs.size} files).`);
} else {
  rmSync(join(root, "skills/fenrir/references"), { recursive: true, force: true });
  mkdirSync(join(root, "skills/fenrir/references"), { recursive: true });
  for (const [path, text] of outputs) writeFileSync(join(root, path), text);
  console.log(`Wrote ${outputs.size} files: skills/fenrir/references/, llms.txt, llms-full.txt.`);
}

// Type-checks every ```ts block in the given Markdown files against the package's public entry
// points, so documented examples cannot drift from the API.
//
//   node scripts/check-docs.mjs README.md AGENTS.md --standalone skills/fenrir/SKILL.md
//
// Each block is compiled as its own module. `fenrir-ts` and its subpaths resolve to the entry
// files (src/index.ts, src/2d.ts, ...), the same modules the built package exports; a block that
// imports anything else from the engine (`@/...`, a relative path, `fenrir-ts/dist/...`, `src/`)
// fails. Files before `--standalone` may use names a fragment assumes from its surroundings,
// declared in scripts/docs-ambient.d.ts. Files after it (the shipped agent guide) get no such
// help: every block must compile on its own, as an agent would paste it.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const split = args.indexOf("--standalone");
const ambientFiles = (split === -1 ? args : args.slice(0, split)).filter(Boolean);
const standaloneFiles = split === -1 ? [] : args.slice(split + 1);
if (!ambientFiles.length && !standaloneFiles.length) ambientFiles.push("README.md");
const cacheDir = join(root, "node_modules", ".cache", "docs-check");
const posix = (path) => path.replaceAll("\\", "/");

/** One mapping per package.json export: the public entry points and nothing else. */
const ENTRIES = {
  "fenrir-ts": "./src/index.ts",
  "fenrir-ts/2d": "./src/2d.ts",
  "fenrir-ts/3d": "./src/3d.ts",
  "fenrir-ts/physics": "./src/physics.ts",
  "fenrir-ts/audio": "./src/audio.ts",
  "fenrir-ts/ui": "./src/ui.ts",
};
/** Packages an example may import besides the entries: the peers and the test runner. */
const ALLOWED = /^(pixi\.js|three|three\/.*|jolt-physics|vitest|@playwright\/test)$/;

let failed = false;
const importErrors = [];

/** Writes each block of `files` into `dir` and returns the map from generated name to file. */
function extract(files, dir) {
  const sources = new Map();
  for (const file of files) {
    const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
    let start = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (start === -1 && /^```(ts|typescript)$/.test(line)) {
        start = i;
      } else if (start !== -1 && line === "```") {
        const code = lines.slice(start + 1, i);
        code.forEach((text, offset) => {
          for (const match of text.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|^\s*import\s+["']([^"']+)["']/g)) {
            const specifier = match[1] ?? match[2] ?? match[3];
            if (!(specifier in ENTRIES) && !ALLOWED.test(specifier)) {
              importErrors.push(`${file}(${start + 2 + offset}): imports "${specifier}". Examples import only fenrir-ts, its entry points and peer packages.`);
            }
          }
        });
        const name = `${file.replace(/[^a-z0-9]/gi, "_")}_L${start + 1}.ts`;
        // Blank lines before the code keep reported line numbers equal to the Markdown's.
        writeFileSync(join(dir, name), "\n".repeat(start + 1) + code.join("\n") + "\nexport {};\n");
        sources.set(name, file);
        start = -1;
      }
    }
  }
  return sources;
}

/** Compiles the blocks of `files`, with the ambient declarations or without. */
function compile(label, files, { ambient }) {
  const dir = join(cacheDir, label);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const sources = extract(files, dir);
  if (sources.size === 0) {
    console.error(`No \`\`\`ts blocks found in ${files.join(", ")}`);
    failed = true;
    return;
  }
  writeFileSync(
    join(dir, "tsconfig.json"),
    JSON.stringify(
      {
        extends: posix(join(root, "tsconfig.json")),
        compilerOptions: {
          baseUrl: posix(root),
          // The engine's own files use the `@/` alias; examples are held to the entries by the import check.
          paths: { "@/*": ["./src/*"], ...Object.fromEntries(Object.entries(ENTRIES).map(([name, path]) => [name, [path]])) },
          // Examples show imports and declarations without always using them.
          noUnusedLocals: false,
          noUnusedParameters: false,
        },
        include: ["./*.ts", ...(ambient ? [posix(join(root, "scripts", "docs-ambient.d.ts"))] : [])],
        exclude: [],
      },
      null,
      2,
    ),
  );
  const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
  try {
    execFileSync(process.execPath, [tsc, "-p", dir, "--pretty", "false"], { cwd: root, encoding: "utf8" });
    console.log(`${sources.size} code blocks in ${files.join(", ")} compile${ambient ? "" : " on their own"}.`);
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    // Point each error at the Markdown file and line rather than the generated file.
    const mapped = output.replace(/^.*?([A-Za-z0-9_]+_L\d+\.ts)\((\d+),(\d+)\)/gm, (match, name, line, column) => {
      const file = sources.get(name);
      return file ? `${file}(${line},${column})` : match;
    });
    console.error(mapped.trim());
    failed = true;
  }
}

if (ambientFiles.length) compile("ambient", ambientFiles, { ambient: true });
if (standaloneFiles.length) compile("standalone", standaloneFiles, { ambient: false });

if (importErrors.length) {
  console.error(importErrors.join("\n"));
  failed = true;
}
if (failed) {
  console.error("\nA documented example no longer compiles. Fix the example or the API it shows.");
  process.exit(1);
}

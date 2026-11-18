// Type-checks every ```ts block in the given Markdown files (default: README.md)
// against the engine source, so documented examples cannot drift from the API.
//
// Each block is compiled as its own module. Package imports resolve to src/.
// Names that a fragment assumes from its surroundings are declared in
// scripts/docs-ambient.d.ts.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["README.md"];
const outDir = join(root, "node_modules", ".cache", "docs-check");
const posix = (path) => path.replaceAll("\\", "/");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

/** Maps a generated file name to where its block came from. */
const sources = new Map();

for (const file of files) {
  const lines = readFileSync(join(root, file), "utf8").split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (start === -1 && /^```(ts|typescript)$/.test(line)) {
      start = i;
    } else if (start !== -1 && line === "```") {
      const name = `${file.replace(/[^a-z0-9]/gi, "_")}_L${start + 1}.ts`;
      // Blank lines before the code keep reported line numbers equal to the Markdown's.
      const body = "\n".repeat(start + 1) + lines.slice(start + 1, i).join("\n") + "\nexport {};\n";
      writeFileSync(join(outDir, name), body);
      sources.set(name, file);
      start = -1;
    }
  }
}

if (sources.size === 0) {
  console.error(`No \`\`\`ts blocks found in ${files.join(", ")}`);
  process.exit(1);
}

writeFileSync(
  join(outDir, "tsconfig.json"),
  JSON.stringify(
    {
      extends: posix(join(root, "tsconfig.json")),
      compilerOptions: {
        baseUrl: posix(root),
        paths: {
          "@/*": ["./src/*"],
          "fenrir-ts": ["./src/index.ts"],
          "fenrir-ts/core": ["./src/core/index.ts"],
          "fenrir-ts/editor": ["./src/editor/index.ts"],
        },
        // Examples show imports and declarations without always using them.
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
      include: ["./*.ts", posix(join(root, "scripts", "docs-ambient.d.ts"))],
      exclude: [],
    },
    null,
    2,
  ),
);

const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
try {
  execFileSync(process.execPath, [tsc, "-p", outDir, "--pretty", "false"], { cwd: root, encoding: "utf8" });
  console.log(`${sources.size} code blocks in ${files.join(", ")} compile.`);
} catch (error) {
  const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  // Point each error at the Markdown file and line rather than the generated file.
  const mapped = output.replace(/^.*?([A-Za-z0-9_]+_L\d+\.ts)\((\d+),(\d+)\)/gm, (match, name, line, column) => {
    const file = sources.get(name);
    return file ? `${file}(${line},${column})` : match;
  });
  console.error(mapped.trim());
  console.error("\nA documented example no longer compiles. Fix the example or the API it shows.");
  process.exit(1);
}

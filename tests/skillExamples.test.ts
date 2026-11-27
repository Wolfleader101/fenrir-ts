import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Runs the examples of the shipped agent guide, skills/fenrir/SKILL.md, the way a reader would
 * paste them: each ```ts block is written to a file with its `fenrir-ts` imports pointed at the
 * entry files, then imported. A block (or a `// --- name ---` section of one) that needs the DOM
 * game (`document`) is left out; the rest must run without throwing, every `it(...)` inside must
 * pass, and each `console.log(...); // expected` must print what its comment says.
 */
// Vitest runs from the repo root. The tests' tsconfig has no Node types, so files go through ts.sys.
const root = ts.sys.getCurrentDirectory().replaceAll("\\", "/");
const join = (...parts: string[]) => parts.join("/");
const guide = (ts.sys.readFile(join(root, "skills/fenrir/SKILL.md")) ?? "").replace(/\r\n/g, "\n");
const outDir = join(root, "node_modules/.cache/skill-examples");
const ENTRIES: Record<string, string> = {
  "fenrir-ts": "src/index.ts",
  "fenrir-ts/2d": "src/2d.ts",
  "fenrir-ts/ui": "src/ui.ts",
  "fenrir-ts/audio": "src/audio.ts",
};

interface Block {
  line: number;
  code: string;
}

function blocks(): Block[] {
  const found: Block[] = [];
  const pattern = /```ts\n([\s\S]*?)```/g;
  for (const match of guide.matchAll(pattern)) {
    const line = guide.slice(0, match.index).split("\n").length;
    // Keep the sections that run headless.
    const sections = match[1]!.split(/^(?=\/\/ --- )/m).filter((section: string) => !/\bdocument\./.test(section));
    if (sections.length) found.push({ line, code: sections.join("\n") });
  }
  return found;
}

/** `console.log(a, b); // expected` lines, in order. */
function expectations(code: string): string[] {
  return [...code.matchAll(/^\s*console\.log\(.*\);\s*\/\/\s*(.+)$/gm)].map((m) => m[1]!.split(/:\s(?=[a-z])/)[0]!);
}

/** Both sides without whitespace and quotes, so `{ x: 0 }` matches `{"x":0}`. */
const loose = (text: string) => text.replace(/[\s"']/g, "");
const show = (value: unknown) => (value === undefined ? "undefined" : JSON.stringify(value));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("skills/fenrir/SKILL.md examples", () => {
  for (const block of blocks()) {
    it(`runs the block at line ${block.line}`, async () => {
      let code = block.code;
      for (const [name, path] of Object.entries(ENTRIES)) {
        code = code.replaceAll(`from "${name}"`, `from "${join(root, path)}"`);
        code = code.replaceAll(`import "${name}"`, `import "${join(root, path)}"`);
      }
      // Tests inside the block are collected and run here, not registered with Vitest.
      code = code.replace(/import \{([^}]*)\bit\b,?([^}]*)\} from "vitest";/, 'import {$1$2} from "vitest"; const it = (globalThis as any).__skillIt;');
      const tests: (() => Promise<void> | void)[] = [];
      (globalThis as any).__skillIt = (_name: string, fn: () => Promise<void> | void) => void tests.push(fn);
      const logged: string[] = [];
      vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => void logged.push(args.map(show).join(" ")));
      vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "debug").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      const file = join(outDir, `block_L${block.line}.ts`);
      ts.sys.writeFile(file, code); // creates the directory
      await import(/* @vite-ignore */ `${file}?t=${Date.now()}`);
      for (const test of tests) await test();

      const wanted = expectations(block.code);
      expect(logged.map(loose)).toEqual(wanted.map(loose));
    });
  }
});

// @vitest-environment node
/// <reference types="node" />
// `npx fenrir-ts create <dir>` (bin/fenrir-ts.js). The created game's own checks run in
// `pnpm check:template`, which installs it; these tests only run the command.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));
const bin = join(root, "bin", "fenrir-ts.js");
const engine = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const template = JSON.parse(readFileSync(join(root, "templates", "game-2d", "package.json"), "utf8"));

let work: string;
beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "fenrir-create-"));
});
afterEach(() => rmSync(work, { recursive: true, force: true }));

const create = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd: work, encoding: "utf8" });
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));

describe("fenrir-ts create", () => {
  it("copies the template, names the package after the folder and pins this version", () => {
    const result = create("create", "My Game");
    expect(result.status).toBe(0);
    const game = join(work, "My Game");
    const created = readJson(join(game, "package.json"));
    expect(created.name).toBe("my-game");
    expect(created.dependencies).toEqual({ "fenrir-ts": `~${engine.version}`, "pixi.js": engine.peerDependencies["pixi.js"] });
    expect(created.devDependencies).toEqual(template.devDependencies);
    expect(Object.keys(created).indexOf("dependencies")).toBeLessThan(Object.keys(created).indexOf("devDependencies"));
    expect(result.stdout).toContain(`fenrir-ts ${engine.version}`);
  });

  it("renames gitignore to .gitignore, which npm would leave out of the package", () => {
    create("create", "game");
    const files = readdirSync(join(work, "game"));
    expect(files).toContain(".gitignore");
    expect(files).not.toContain("gitignore");
    for (const file of ["AGENTS.md", "CLAUDE.md", "index.html", "playwright.config.ts", "tsconfig.json", "vite.config.ts"]) {
      expect(files).toContain(file);
    }
    expect(existsSync(join(work, "game", ".github", "workflows", "ci.yml"))).toBe(true);
    expect(existsSync(join(work, "game", "public", "star.png"))).toBe(true);
  });

  it("creates into an empty folder that exists, and refuses one that is not empty", () => {
    mkdirSync(join(work, "empty"));
    expect(create("create", "empty").status).toBe(0);

    mkdirSync(join(work, "full"));
    writeFileSync(join(work, "full", "notes.txt"), "mine");
    const result = create("create", "full");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("is not empty");
    expect(readdirSync(join(work, "full"))).toEqual(["notes.txt"]);
  });

  it("falls back to a valid package name when the folder name has none", () => {
    create("create", "___");
    expect(readJson(join(work, "___", "package.json")).name).toBe("fenrir-game");
  });

  it("rejects an unknown command, a missing folder and extra arguments", () => {
    for (const args of [["make", "game"], ["create"], ["create", "--width", "390"], ["create", "a", "b"]]) {
      const result = create(...args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: npx fenrir-ts@latest create <dir>");
    }
    expect(readdirSync(work)).toEqual([]);
  });

  it("prints usage with --help", () => {
    const result = create("--help");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });
});

describe("the template's tools", () => {
  it("are the majors the engine tests with", () => {
    const major = (range: string) => /\d+/.exec(range)?.[0];
    for (const tool of ["typescript", "vitest"]) {
      expect(major(template.devDependencies[tool]), tool).toBe(major(engine.devDependencies[tool]));
    }
  });

  it("leave fenrir-ts and pixi.js to the create command", () => {
    expect(template.dependencies).toBeUndefined();
  });
});

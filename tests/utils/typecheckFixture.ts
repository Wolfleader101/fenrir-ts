import ts from "typescript";

// Vitest runs from the repo root. The tests' tsconfig has no Node types, so no node:path.
const root = ts.sys.getCurrentDirectory();
const fromRoot = (path: string) => `${root}/${path}`;

export type FixtureResult = {
  /** Every error, formatted as `file(line,col): message`. Empty when the fixture compiles. */
  errors: string[];
  /** Whether the program loaded any file of the package, for example `pixi.js`. */
  loads(pkg: string): boolean;
};

/**
 * Type-checks one fixture under tests/types/fixtures as its own program, with
 * `fenrir-ts`, `fenrir-ts/2d` and `fenrir-ts/3d` mapped to their source entries.
 *
 * The project's tsc run is one program that loads every entry, so module
 * augmentations from `fenrir-ts/2d` reach every file in it. A separate program
 * sees only what the fixture imports, as a consumer's program does.
 */
export function typecheckFixture(name: string): FixtureResult {
  const configPath = fromRoot("tsconfig.json");
  const config = ts.getParsedCommandLineOfConfigFile(configPath, {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    },
  });
  if (!config) throw new Error("Could not read tsconfig.json");

  const options: ts.CompilerOptions = {
    ...config.options,
    noEmit: true,
    paths: {
      ...config.options.paths,
      "fenrir-ts": ["./src/index.ts"],
      "fenrir-ts/2d": ["./src/2d.ts"],
      "fenrir-ts/3d": ["./src/3d.ts"],
      "fenrir-ts/audio": ["./src/audio.ts"],
    },
  };
  const program = ts.createProgram([fromRoot(`tests/types/fixtures/${name}`)], options);
  const errors = ts.getPreEmitDiagnostics(program).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (!diagnostic.file || diagnostic.start === undefined) return message;
    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}(${line + 1},${character + 1}): ${message}`;
  });
  const files = program.getSourceFiles().map((file) => file.fileName.replace(/\\/g, "/"));

  return {
    errors,
    loads: (pkg) => files.some((file) => file.includes(`/node_modules/${pkg}/`)),
  };
}

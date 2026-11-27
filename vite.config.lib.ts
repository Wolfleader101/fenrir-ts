import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import dts from "vite-plugin-dts";
import postcssLit from "postcss-lit";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// lucide's package.json "module" names a file it does not ship, so the build fell
// back to its CommonJS bundle, and the editor source map embedded all 546 kB of it.
// Point the editor at lucide's ES modules instead: one small module per icon.
const lucideEsm = resolve(
  dirname(createRequire(import.meta.url).resolve("lucide")),
  "../esm/lucide/src/lucide.js",
);
if (!existsSync(lucideEsm)) {
  throw new Error(`lucide's ES module build is not at ${lucideEsm}. Update the alias in vite.config.lib.ts.`);
}

/**
 * Gives every relative import in the declarations its file: "./core/Game" becomes
 * "./core/Game.js" and "./core/Renderer2D" becomes "./core/Renderer2D/index.js".
 * The same goes for `declare module "./AssetStore"` augmentations, which would
 * otherwise silently not apply. Without it a consumer whose tsconfig uses
 * "moduleResolution": "node16" or "nodenext" cannot resolve them; "bundler"
 * resolution never needed it.
 */
function addDeclarationExtensions(dir: string): void {
  for (const entry of readdirSync(dir, { recursive: true, encoding: "utf8" })) {
    if (!entry.endsWith(".d.ts")) continue;
    const file = resolve(dir, entry);
    const resolveSpecifier = (specifier: string): string => {
      // The lucide alias below leaks into the editor's declarations as a path
      // into this checkout's node_modules; a consumer resolves the package name.
      if (/\/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?lucide\//.test(specifier)) return "lucide";
      if (specifier.includes("/node_modules/")) {
        throw new Error(`${file}: the declaration import "${specifier}" points into node_modules`);
      }
      // Some sources import "./Engine.ts" (allowImportingTsExtensions).
      if (specifier.endsWith(".ts")) specifier = specifier.slice(0, -".ts".length);
      // Asset imports ("./assets/right.png") are left as they are.
      else if (/\.\w+$/.test(specifier) && !/\/\.\.?$/.test(specifier)) return specifier;
      const target = resolve(dirname(file), specifier);
      // "." and "./" name a directory, never the sibling file "<dir>.d.ts".
      if (/(?:^|\/)\.{0,2}\/?$/.test(specifier) && existsSync(resolve(target, "index.d.ts"))) {
        return `${specifier.replace(/\/$/, "")}/index.js`;
      }
      if (existsSync(`${target}.d.ts`)) return `${specifier}.js`;
      if (existsSync(resolve(target, "index.d.ts"))) return `${specifier}/index.js`;
      throw new Error(`${file}: cannot resolve the declaration import "${specifier}"`);
    };
    const code = readFileSync(file, "utf8");
    const fixed = code.replace(
      /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bdeclare\s+module\s+)(["'])(\.\.?(?:\/[^"']*)?)\2/g,
      (_match, lead: string, quote: string, specifier: string) => `${lead}${quote}${resolveSpecifier(specifier)}${quote}`,
    );
    if (fixed !== code) writeFileSync(file, fixed);
  }
}

export default defineConfig({
  publicDir: false,
  plugins: [
    postcssLit.rollupPostCSSLit({
      globInclude: "src/**/*.{js,ts}",
    }),
    dts({
      // No entryRoot: the plugin derives it from the included files (all under
      // src/ once tests/ is excluded). Combined with that exclude, entryRoot:
      // "src" made the plugin skip every declaration as "outside" dist.
      outDir: "dist",
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/demos/**/*",
        // Demo navigation, used only by the demo pages.
        "src/shared/**/*",
        "src/editor/resources/**/*",
        "tests/**/*",
      ],
      tsconfigPath: "./tsconfig.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
        },
      },
      afterBuild: async () => {
        // index, 2d, 3d and physics are src/*.ts files, so their declarations
        // land at dist/<name>.d.ts. The editor entry is src/editor/index.ts and
        // needs a top-level stub to match package.json "exports".
        const fs = await import("node:fs/promises");
        await fs.writeFile(
          "dist/editor.d.ts",
          "export * from './editor/index';\n",
        );
        addDeclarationExtensions("dist");
      },
    }),
  ],
  build: {
    lib: {
      entry: {
        // One entry per package export. Core (index) must import no renderer:
        // scripts/check-entry-imports.mjs checks the output.
        index: resolve(__dirname, "src/index.ts"),
        "2d": resolve(__dirname, "src/2d.ts"),
        "3d": resolve(__dirname, "src/3d.ts"),
        physics: resolve(__dirname, "src/physics.ts"),
        audio: resolve(__dirname, "src/audio.ts"),
        ui: resolve(__dirname, "src/ui.ts"),
        editor: resolve(__dirname, "src/editor/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        /^pixi\.js(\/.*)?$/,
        /^three(\/.*)?$/,
        /^monaco-editor(\/.*)?$/,
        /^jolt-physics(\/.*)?$/,
      ],
      output: {
        preserveModules: false,
        exports: "named",
        assetFileNames: "assets/[name][extname]",
      },
    },
    // "hidden": maps are written for check:imports and check:consumer, but the
    // published files carry no sourceMappingURL and package.json "files" leaves
    // the maps out of the tarball. dist/ is not minified, so stack traces stay readable.
    sourcemap: "hidden",
    outDir: "dist",
  },
  resolve: {
    alias: [
      // fileURLToPath, not URL.pathname: on Windows pathname is "/C:/...", and the
      // declarations then imported the build machine's src/ by absolute path.
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: /^lucide$/, replacement: lucideEsm },
    ],
  },
});

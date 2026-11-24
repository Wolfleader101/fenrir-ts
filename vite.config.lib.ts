import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import dts from "vite-plugin-dts";
import postcssLit from "postcss-lit";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

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
    sourcemap: true,
    outDir: "dist",
  },
  resolve: {
    alias: [
      { find: "@", replacement: new URL("./src", import.meta.url).pathname },
      { find: /^lucide$/, replacement: lucideEsm },
    ],
  },
});

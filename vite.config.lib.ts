import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

export default defineConfig({
  publicDir: false,
  plugins: [
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
        "tests/**/*",
      ],
      tsconfigPath: "./tsconfig.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
        },
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
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        /^pixi\.js(\/.*)?$/,
        /^three(\/.*)?$/,
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
    ],
  },
});

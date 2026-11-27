// The demo pages in demos/: `pnpm dev` serves them, `pnpm build:demos` builds them for
// Vercel. They import the engine by its package names, resolved to the entry files in
// src/, so they read like a game that installed fenrir-ts. The library build is
// vite.config.lib.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vercel from "vite-plugin-vercel";

const at = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Each demo is demos/<name>.html, served at `/<name>`. */
const DEMOS = [
  "animation",
  "bouncing-ball",
  "stacking-blocks",
  "ui-controls",
  "pixi2d",
  "platformer-physics",
  "platformer",
];

/** The package's entry points, as package.json "exports" names them. */
const ENTRIES = ["2d", "3d", "physics", "audio", "ui"];

export default defineConfig({
  root: at("./demos"),
  plugins: [vercel()],
  build: {
    // Not dist/: that is the library build, and this one would empty it first.
    outDir: at("./dist-demos"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: at("./demos/index.html"),
        ...Object.fromEntries(DEMOS.map((name) => [name, at(`./demos/${name}.html`)])),
      },
    },
  },
  vercel: {
    // At the repository root, where Vercel reads it, not under demos/.
    outDir: at("./.vercel/output"),
    rewrites: DEMOS.map((name) => ({ source: `/${name}`, destination: `/${name}.html` })),
  },
  resolve: {
    alias: [
      ...ENTRIES.map((entry) => ({ find: `fenrir-ts/${entry}`, replacement: at(`./src/${entry}.ts`) })),
      { find: /^fenrir-ts$/, replacement: at("./src/index.ts") },
    ],
  },
});

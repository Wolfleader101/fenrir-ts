// The demo pages: `pnpm dev` serves them, `pnpm build:demos` builds them for Vercel.
// The library build is vite.config.lib.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vercel from "vite-plugin-vercel";

/** Each demo is `<name>.html` at the repo root, served at `/<name>`. */
const DEMOS = [
  "animation",
  "bouncing-ball",
  "stacking-blocks",
  "ui-controls",
  "pixi2d",
  "platformer-physics",
  "platformer",
];

export default defineConfig({
  plugins: [vercel()],
  build: {
    // Not dist/: that is the library build, and this one would empty it first.
    outDir: "dist-demos",
    rollupOptions: {
      input: {
        main: "index.html",
        ...Object.fromEntries(DEMOS.map((name) => [name, `${name}.html`])),
      },
    },
  },
  vercel: {
    rewrites: DEMOS.map((name) => ({ source: `/${name}`, destination: `/${name}.html` })),
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});

import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import vercel from "vite-plugin-vercel";

export default defineConfig({
  plugins: [vercel()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        animation: resolve(__dirname, "animation.html"),
        "bouncing-ball": resolve(__dirname, "bouncing-ball.html"),
        "stacking-blocks": resolve(__dirname, "stacking-blocks.html"),
        pixi2d: resolve(__dirname, "pixi2d.html"),
        "ui-controls": resolve(__dirname, "ui-controls.html"),
        platformer: resolve(__dirname, "platformer.html"),
        "platformer-physics": resolve(__dirname, "platformer-physics.html"),
      },
    },
  },
  vercel: {
    rewrites: [
      {
        source: "/animation",
        destination: "/animation.html",
      },
      {
        source: "/bouncing-ball",
        destination: "/bouncing-ball.html",
      },
      {
        source: "/stacking-blocks",
        destination: "/stacking-blocks.html",
      },
      {
        source: "/ui-controls",
        destination: "/ui-controls.html",
      },
      {
        source: "/pixi2d",
        destination: "/pixi2d.html",
      },
      {
        source: "/platformer-physics",
        destination: "/platformer-physics.html",
      },
      {
        source: "/platformer",
        destination: "/platformer.html",
      },
    ],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});

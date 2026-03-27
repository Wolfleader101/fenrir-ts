import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import vercel from "vite-plugin-vercel";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vercel(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        animation: resolve(__dirname, "animation.html"),
        "bouncing-ball": resolve(__dirname, "bouncing-ball.html"),
        "stacking-blocks": resolve(__dirname, "stacking-blocks.html"),
        "monaco-editor": resolve(__dirname, "monaco-editor.html"),
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
        source: "/monaco-editor",
        destination: "/monaco-editor.html",
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
        source: "platformer",
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

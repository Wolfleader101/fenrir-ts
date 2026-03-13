import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";
import postcssLit from "postcss-lit";

export default defineConfig({
  publicDir: false,
  plugins: [
    postcssLit.rollupPostCSSLit({
      globInclude: "src/**/*.{js,ts}",
    }),
    dts({
      entryRoot: "src",
      outDir: "dist",
      exclude: [
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/demos/**/*",
        "src/editor/resources/**/*",
      ],
      tsconfigPath: "./tsconfig.json",
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@/*": ["./src/*"],
        },
      },
      afterBuild: async () => {
        // Create top-level type declaration files for named exports
        const fs = await import("node:fs/promises");
        await fs.writeFile("dist/core.d.ts", "export * from './core/index';\n");
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
        index: resolve(__dirname, "src/index.ts"),
        core: resolve(__dirname, "src/core/index.ts"),
        editor: resolve(__dirname, "src/editor/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
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
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});

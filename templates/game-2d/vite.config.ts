import { defineConfig } from "vitest/config";

export default defineConfig({
  // A system's name is its function's name (`function play`), and `before` / `after` refer to it.
  // Without keepNames the production build's minifier renames or drops those names.
  esbuild: { keepNames: true },
  test: {
    // Headless tests only: e2e/ is Playwright's.
    include: ["tests/**/*.test.ts"],
  },
});

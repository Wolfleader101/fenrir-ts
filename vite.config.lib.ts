import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import dts from "vite-plugin-dts";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

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
  // public/ holds the demo pages' models and textures; the library ships none of it.
  publicDir: false,
  plugins: [
    dts({
      // No entryRoot: the plugin derives it from the included files, all under src/.
      // entryRoot: "src" with this include made it skip every declaration as outside dist.
      include: ["src"],
      exclude: ["src/demos", "src/shared"],
      afterBuild: () => addDeclarationExtensions("dist"),
    }),
  ],
  build: {
    lib: {
      // One entry per package export. Core (index) must import no renderer:
      // scripts/check-entry-imports.mjs checks the output.
      entry: {
        index: "src/index.ts",
        "2d": "src/2d.ts",
        "3d": "src/3d.ts",
        physics: "src/physics.ts",
        audio: "src/audio.ts",
        ui: "src/ui.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^pixi\.js(\/.*)?$/, /^three(\/.*)?$/, /^jolt-physics(\/.*)?$/],
    },
    // "hidden": maps are written for check:imports and check:consumer, but the
    // published files carry no sourceMappingURL and package.json "files" leaves
    // the maps out of the tarball. dist/ is not minified, so stack traces stay readable.
    sourcemap: "hidden",
  },
});

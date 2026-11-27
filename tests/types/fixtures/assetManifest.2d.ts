// A program that imports `fenrir-ts` and `fenrir-ts/2d` and declares an asset manifest. Compiled
// on its own by tests/types/assetManifest.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import type { Texture } from "pixi.js";
import {
  defineAssets,
  getAsset,
  loadAsset,
  loadAssets,
  unloadAsset,
  unloadAssets,
  type AssetName,
  type AssetProgress,
  type BundleName,
  type SystemCtx,
} from "fenrir-ts";
import "fenrir-ts/2d";

// No `as const`: kinds, names and bundle lists are inferred as literals.
const GameAssets = defineAssets("fixture.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

expectTypeOf<AssetName<typeof GameAssets>>().toEqualTypeOf<"logo" | "missing" | "reef">();
expectTypeOf<BundleName<typeof GameAssets>>().toEqualTypeOf<"boot" | "reef">();

declare const ctx: SystemCtx;
expectTypeOf(getAsset(ctx, GameAssets, "reef")).toEqualTypeOf<Texture>();
expectTypeOf(loadAssets(ctx, GameAssets, "boot")).toEqualTypeOf<Promise<void>>();
void loadAssets(ctx, GameAssets, ["boot", "reef"]);
unloadAssets(ctx, GameAssets, "reef");

const progress = ctx.resources.get(GameAssets.progress);
expectTypeOf(progress).toEqualTypeOf<AssetProgress<"logo" | "missing" | "reef", "boot" | "reef">>();
expectTypeOf(progress.bundles.reef.fraction).toEqualTypeOf<number>();
expectTypeOf(progress.assets.logo.status).toEqualTypeOf<"unloaded" | "loading" | "loaded" | "fallback" | "missing" | "failed">();

// A manifest written as plain data elsewhere, `as const`, works the same.
const declared = {
  assets: { hero: { kind: "texture2d", src: "hero.png" } },
  bundles: { boot: ["hero"] },
} as const;
const Declared = defineAssets("fixture.declared", declared);
expectTypeOf(getAsset(ctx, Declared, "hero")).toEqualTypeOf<Texture>();

// Per-asset loading takes asset names, not bundle names.
expectTypeOf(loadAsset(ctx, GameAssets, "reef")).toEqualTypeOf<Promise<void>>();
void loadAsset(ctx, GameAssets, ["reef", "logo"]);
unloadAsset(ctx, GameAssets, "reef");
// @ts-expect-error a bundle name is not an asset name
void loadAsset(ctx, GameAssets, "boot");
// @ts-expect-error not an asset of the manifest
unloadAsset(ctx, GameAssets, "rock");

// An optional asset may be missing: getAsset includes undefined for it, and only for it.
const Optional = defineAssets("fixture.optional", {
  assets: {
    hero: { kind: "texture2d", src: "hero.png" },
    glow: { kind: "texture2d", src: "glow.png", optional: true },
    shine: { kind: "texture2d", src: "shine.png", optional: false },
  },
  bundles: { boot: ["hero", "glow", "shine"] },
});
expectTypeOf(getAsset(ctx, Optional, "glow")).toEqualTypeOf<Texture | undefined>();
expectTypeOf(getAsset(ctx, Optional, "hero")).toEqualTypeOf<Texture>();
expectTypeOf(getAsset(ctx, Optional, "shine")).toEqualTypeOf<Texture>();

// @ts-expect-error not an asset of the manifest
getAsset(ctx, GameAssets, "rock");
// @ts-expect-error not a bundle of the manifest
void loadAssets(ctx, GameAssets, "cave");
// @ts-expect-error not a bundle of the manifest
unloadAssets(ctx, GameAssets, ["reef", "cave"]);

defineAssets("fixture.badBundle", {
  assets: { logo: { kind: "texture2d", src: "img/logo.png" } },
  // @ts-expect-error a bundle lists an asset that is not declared
  bundles: { boot: ["logo", "rock"] },
});

defineAssets("fixture.badFallback", {
  assets: {
    // @ts-expect-error a fallback that is not declared
    logo: { kind: "texture2d", src: "img/logo.png", fallback: "rock" },
  },
  bundles: { boot: ["logo"] },
});

defineAssets("fixture.badKind", {
  // @ts-expect-error the 3D kinds need fenrir-ts/3d
  assets: { ship: { kind: "model", src: "ship.glb" } },
  bundles: { boot: ["ship"] },
});

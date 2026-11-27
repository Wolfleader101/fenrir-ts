# Assets

<!-- Generated from README.md by scripts/agent-docs.mjs. Do not edit: change README.md, then run pnpm docs:agent. -->

The full rules for asset manifests, bundles, per-asset loading, fallbacks and optional assets. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Assets

Declare a game's assets once, by name, in bundles: `boot`, and one per level or location. `defineAssets` from `fenrir-ts` takes plain data (no `as const` needed), so a tool or test can read `manifest.assets` and `manifest.bundles`. `getAsset` returns the type of the asset's kind (a Pixi `Texture` for `texture2d`), and a wrong asset or bundle name is a compile error. A game that does not call `defineAssets` ships none of this code.

```ts
import { AssetBundleLoaded, EntityBuilder, Schedule, createGame, defineAssets, defineState, getAsset, loadAssets, unloadAssets, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { Graphics, Sprite } from "pixi.js";

export const GameAssets = defineAssets("myGame.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    // If reef.webp fails, the reef asset is the missing texture instead.
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

const Level = defineState("myGame.Level", { values: ["loading", "reef"], initial: "loading" });
const pixi = pixi2d({ design: { width: 390, minHeight: 520 } });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const bar = new Graphics();

// Awaited in PreInit, so run() waits for boot and rejects if it fails.
async function loadBoot(ctx: SystemCtx): Promise<void> {
  await loadAssets(ctx, GameAssets, "boot");
}

function showTitle(ctx: SystemCtx): void {
  EntityBuilder.create().transform2D(195, 80).renderSprite("logo").spawn(ctx.entities); // by name, through game.assets
  pixi.renderer.root.addChild(bar);
  void loadAssets(ctx, GameAssets, "reef"); // not awaited: progress below, then AssetBundleLoaded
}

function drawProgress({ resources }: SystemCtx): void {
  const { fraction } = resources.get(GameAssets.progress).bundles.reef;
  bar.clear().rect(20, 500, 350 * fraction, 6).fill(0xffffff);
}

game.on(AssetBundleLoaded, ({ bundle }, { states }) => {
  if (bundle === "reef") states.set(Level, "reef");
});

game
  .onEnter(Level, "reef", (ctx) => {
    const reef = new Sprite(getAsset(ctx, GameAssets, "reef")); // a Texture, no cast
    EntityBuilder.create().transform2D(0, 0).pixiNode(reef).spawn(ctx.entities);
  })
  // Leaving the level: despawn what shows its textures first, then unload. logo stays: boot holds it.
  .onExit(Level, "reef", (ctx) => unloadAssets(ctx, GameAssets, "reef"))
  .addSystem(Schedule.PreInit, loadBoot)
  .addSystem(Schedule.Init, showTitle)
  .addSystem(Schedule.Update, drawProgress);
await game.run();
```

- **Where.** `loadAssets(ctx, manifest, bundle | bundles)`, `unloadAssets(...)` and `getAsset(ctx, manifest, name)` take a `SystemCtx` or the game itself; a helper of your own that calls them takes `AssetCtx`. An asset's `src` is a URL the browser fetches relative to the page: with Vite, a file in `public/img/` is `img/logo.png`. `ctx.assets` is `game.assets`, the asset store; a manifest loads through its loaders (chosen by kind and extension) and stores each asset under its name, so `getTexture2D("logo")` and `renderSprite("logo")` see it too. Two manifests may share a name only for the same kind and source.
- **Loading.** A loading or loaded bundle returns the same promise; an asset in two bundles loads once. Await `loadAssets` in a `PreInit` system to hold `run()` until a bundle is ready, or call it without awaiting and watch progress. Loads are not tied to a run: they finish after `stop()`, and loaded bundles stay loaded across `stop()` and `run()`, like entities.
- **Progress.** `ctx.resources.get(manifest.progress)` is plain data updated as each asset settles: `loaded`, `missing`, `failed`, `total` and `fraction` (`(loaded + missing) / total`) over every held asset, the same per bundle with its `status` (`unloaded`, `loading`, `loaded`, `failed`), and each asset's `status` (`unloaded`, `loading`, `loaded`, `fallback`, `missing`, `failed`), `error`, the `bundles` holding it and `direct` (held by `loadAsset`). `inspect(game)` shows it under the manifest's name. A bundle sends `AssetBundleLoaded { manifest, bundle, fallbacks, missing }` or `AssetBundleFailed { manifest, bundle, failures }` when it settles.
- **Failure.** Every asset of a bundle is tried. One that fails shows its declared `fallback` (another asset of the same kind, which every bundle listing it also loads) and the failure is logged as a warning. One that fails without a fallback fails the bundle: it is logged, `AssetBundleFailed` is sent and the promise rejects with an `AssetBundleError` whose `failures` name each asset, source and error. The assets that loaded stay loaded. Calling `loadAssets` again retries the failed assets; nothing retries on its own.
- **Optional assets.** `{ kind, src, optional: true }` marks a failure as cosmetic. An optional asset that fails (after its `fallback`, if it has one) is `missing`: logged as a warning, counted in `missing`, listed in `AssetBundleLoaded`'s `missing`, and its bundle still loads. `getAsset` returns `undefined` for it, and its type includes `undefined` only for assets declared `optional: true`; `getTexture2D(name)` resolves with `undefined`. A missing asset is not loaded again until a hold on it is dropped and taken again.
- **One asset at a time.** `loadAsset(ctx, manifest, name | names)` loads assets by name with no bundle, for a game that loads images lazily as they come into view; `unloadAsset(ctx, manifest, name | names)` drops that hold. A name is held like a one-asset bundle with its fallback, shared with any bundle that lists it: an asset is released only when no bundle and no `loadAsset` hold has it. It counts in the top-level progress and `assets[name]` (with `direct: true`), not in `progress.bundles`. It sends `AssetLoaded { manifest, asset, status }` (`loaded`, `fallback` or `missing`) or `AssetFailed { manifest, asset, src, error }`, and rejects with an `AssetLoadError`; calling it again retries a failed asset. `setAssetLoader` applies to it.

```ts
import { AssetLoaded, defineAssets, getAsset, loadAsset, unloadAsset, type SystemCtx } from "fenrir-ts";
import "fenrir-ts/2d";

const Cards = defineAssets("myGame.cards", {
  assets: {
    ace: { kind: "texture2d", src: "cards/ace.png" },
    // Decoration: if it fails the card still shows, with no shine.
    shine: { kind: "texture2d", src: "cards/shine.png", optional: true },
  },
  bundles: {},
});

function cardScrolledIn(ctx: SystemCtx): void {
  void loadAsset(ctx, Cards, ["ace", "shine"]); // not awaited: AssetLoaded fires per asset
}

function cardScrolledOut(ctx: SystemCtx): void {
  unloadAsset(ctx, Cards, ["ace", "shine"]); // despawn what shows them first
}

game.on(AssetLoaded, ({ manifest, asset }, ctx) => {
  if (manifest !== Cards.name || asset !== "shine") return;
  const shine = getAsset(ctx, Cards, "shine"); // Texture | undefined: optional
  if (shine) ctx.logger.info("shine ready");
});
```

- **Unloading.** `unloadAssets` drops each asset no other loading or loaded bundle holds, from any manifest, and calls its loader's `unload`. For 2D textures that is Pixi's `Assets.unload`, which destroys the texture: Pixi's cache owns 2D textures. Despawn the entities that show a bundle's textures before unloading it; nothing tracks them, and a sprite left on a destroyed texture draws nothing or fails to render. Unloading a bundle that is still loading rejects its promise. A custom loader frees its assets with `unload` in its `LoaderConfig`.

Tests replace the loaders with `setAssetLoader(game, { load, unload? })`, so each asset resolves or fails when the test says, with no network and no canvas:

```ts
import { createTestGame, defineAssets, getAsset, loadAssets, setAssetLoader } from "fenrir-ts";
import "fenrir-ts/2d"; // the texture2d kind
import type { Texture } from "pixi.js";
import { expect, it } from "vitest";

const GameAssets = defineAssets("myGame.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

it("shows the reef's progress and falls back when reef.webp fails", async () => {
  const game = await createTestGame({ seed: 1 });
  const textures: Record<string, Texture> = { logo: {} as Texture, missing: {} as Texture };
  setAssetLoader(game, {
    load: async ({ name }) => textures[name] ?? Promise.reject(new Error("404")),
  });
  await loadAssets(game, GameAssets, "reef");
  expect(game.resources.get(GameAssets.progress).bundles.reef).toMatchObject({ status: "loaded", fraction: 1 });
  expect(getAsset(game, GameAssets, "reef")).toBe(textures.missing);
});
```

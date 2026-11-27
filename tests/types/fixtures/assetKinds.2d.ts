// A program that imports `fenrir-ts` and `fenrir-ts/2d`. Compiled on its own by
// tests/types/assetKinds.2d.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import type { Texture } from "pixi.js";
import { AssetStore, assetKey, createTestGame, type Asset, type AssetKind, type AssetLoader, type SystemCtx } from "fenrir-ts";
import { getSupportedTexture2DExtensions, getTexture2D, loadTexture2D, registerTexture2DLoader, requestTexture2D, type Texture2DHandle } from "fenrir-ts/2d";

declare const texture: Texture;
const store = new AssetStore();
const key = assetKey("hero");

expectTypeOf<AssetKind>().toEqualTypeOf<"texture2d">();
expectTypeOf<Asset>().toEqualTypeOf<Texture>();
expectTypeOf(store.get(key)).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(store.get(key, "texture2d")).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(store.peek(key, "texture2d")).toEqualTypeOf<Promise<Texture> | undefined>();
expectTypeOf(store.kindOf(key)).toEqualTypeOf<"texture2d" | undefined>();
expectTypeOf(store.resolveLoader("texture2d", "hero.png")).toEqualTypeOf<AssetLoader<Texture>>();

// The texture functions take a SystemCtx, the game, or anything with its assets.
declare const ctx: SystemCtx;
const game = await createTestGame({ seed: 1 });
expectTypeOf(getTexture2D(ctx, key)).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(getTexture2D(game, key)).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(requestTexture2D({ assets: store }, key, "hero.png")).toEqualTypeOf<Texture2DHandle>();
expectTypeOf(loadTexture2D(ctx, "hero", "hero.png")).toEqualTypeOf<Promise<void>>();
expectTypeOf(getSupportedTexture2DExtensions(game)).toEqualTypeOf<string[]>();
registerTexture2DLoader(ctx, "custom", { loader: async () => texture, extensions: ["tex"] });
// @ts-expect-error a 2D texture loader must load Pixi textures
registerTexture2DLoader(ctx, "bad", { loader: async () => 1, extensions: ["bad"] });
// @ts-expect-error fenrir-ts/2d adds no methods to AssetStore
void store.requestTexture2D(key, "hero.png");
// @ts-expect-error fenrir-ts/2d adds no methods to AssetStore
void store.getTexture2D(key);
store.setAsset(key, "texture2d", Promise.resolve(texture));
store.registerLoader("texture2d", "custom", { loader: async () => texture, extensions: ["tex"] });

// @ts-expect-error the 3D kinds need fenrir-ts/3d
void store.get(key, "model");
// @ts-expect-error the 3D kinds need fenrir-ts/3d
void store.get(key, "texture3d");
// @ts-expect-error a 2D texture must be a Pixi texture
store.setAsset(key, "texture2d", Promise.resolve(1));
// @ts-expect-error a 2D texture loader must load Pixi textures
store.registerLoader("texture2d", "bad", { loader: async () => 1, extensions: ["bad"] });
// @ts-expect-error loadModel needs fenrir-ts/3d
void store.loadModel(key, "hero.glb");

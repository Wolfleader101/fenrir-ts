// A program that imports `fenrir-ts` and `fenrir-ts/2d`. Compiled on its own by
// tests/types/assetKinds.2d.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import type { Texture } from "pixi.js";
import { AssetStore, assetKey, type Asset, type AssetKind, type AssetLoader, type IAssetStore } from "fenrir-ts";
import { getTexture2D, requestTexture2D, type Texture2DHandle } from "fenrir-ts/2d";

const store = new AssetStore();
const key = assetKey("hero");

expectTypeOf<AssetKind>().toEqualTypeOf<"texture2d">();
expectTypeOf<Asset>().toEqualTypeOf<Texture>();
expectTypeOf(store.get(key)).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(store.get(key, "texture2d")).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(store.peek(key, "texture2d")).toEqualTypeOf<Promise<Texture> | undefined>();
expectTypeOf(store.kindOf(key)).toEqualTypeOf<"texture2d" | undefined>();
expectTypeOf(store.resolveLoader("texture2d", "hero.png")).toEqualTypeOf<AssetLoader<Texture>>();
expectTypeOf(getTexture2D(store, key)).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(requestTexture2D(store, key, "hero.png")).toEqualTypeOf<Texture2DHandle>();
expectTypeOf<ReturnType<IAssetStore["get"]>>().toEqualTypeOf<Promise<Texture>>();
// @ts-expect-error 2D textures load with functions: nothing adds methods to AssetStore
void store.requestTexture2D(key, "hero.png");

declare const texture: Texture;
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

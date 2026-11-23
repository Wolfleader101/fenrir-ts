// A program that imports `fenrir-ts` and `fenrir-ts/3d`. Compiled on its own by
// tests/types/assetKinds.3d.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import type { Texture } from "three";
import { AssetStore, assetKey, type Asset, type AssetKind } from "fenrir-ts";
import { AssetStore3D, type LoadedModel } from "fenrir-ts/3d";

const store = new AssetStore();
const key = assetKey("hero");

expectTypeOf<AssetKind>().toEqualTypeOf<"model" | "texture3d">();
expectTypeOf<Asset>().toEqualTypeOf<LoadedModel | Texture>();
expectTypeOf(store.get(key)).toEqualTypeOf<Promise<LoadedModel | Texture>>();
expectTypeOf(store.get(key, "model")).toEqualTypeOf<Promise<LoadedModel>>();
expectTypeOf(store.get(key, "texture3d")).toEqualTypeOf<Promise<Texture>>();
expectTypeOf(store.peek(key, "model")).toEqualTypeOf<Promise<LoadedModel> | undefined>();
expectTypeOf(new AssetStore3D().getTexture(key)).toEqualTypeOf<Promise<Texture>>();
// @ts-expect-error the 3D methods are on AssetStore3D, not on every AssetStore
void store.getTexture(key);

// @ts-expect-error the 2D kind needs fenrir-ts/2d
void store.get(key, "texture2d");
// @ts-expect-error a model loader must load models
store.registerLoader("model", "bad", { loader: async () => 1, extensions: ["bad"] });
// @ts-expect-error requestTexture2D needs fenrir-ts/2d
store.requestTexture2D(key, "hero.png");

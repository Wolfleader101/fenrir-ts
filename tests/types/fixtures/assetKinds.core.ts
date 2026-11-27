// A program that imports only `fenrir-ts`. Compiled on its own by
// tests/types/assetKinds.core.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import { AssetStore, assetKey, type Asset, type AssetKind, type IAssetStore } from "fenrir-ts";

const store = new AssetStore();
const key = assetKey("hero");

// Core knows no kinds, so nothing can be stored and a kind-less get never resolves.
expectTypeOf<AssetKind>().toEqualTypeOf<never>();
expectTypeOf<Asset>().toEqualTypeOf<never>();
expectTypeOf(store.get(key)).toEqualTypeOf<Promise<never>>();
expectTypeOf(store.kindOf(key)).toEqualTypeOf<undefined>();
expectTypeOf<ReturnType<IAssetStore["clear"]>>().toEqualTypeOf<void>();

// @ts-expect-error the 2D kind needs fenrir-ts/2d
void store.get(key, "texture2d");
// @ts-expect-error the 3D kinds need fenrir-ts/3d
void store.get(key, "model");
// @ts-expect-error the 3D kinds need fenrir-ts/3d
store.peek(key, "texture3d");
// @ts-expect-error an unknown kind cannot be stored
store.setAsset(key, "level", Promise.resolve(1));
// @ts-expect-error an unknown kind has no loader
store.registerLoader("level", "json", { loader: async () => 1, extensions: ["level"] });
// @ts-expect-error requestTexture2D is a function of fenrir-ts/2d, not a method
store.requestTexture2D(key, "hero.png");
// @ts-expect-error loadModel needs fenrir-ts/3d
void store.loadModel(key, "hero.glb");

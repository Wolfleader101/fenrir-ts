// A program that imports only `fenrir-ts` and adds its own asset kind, the way
// a game does. Compiled on its own by tests/types/assetKinds.core.test.ts.
import { expectTypeOf } from "vitest";
import { AssetStore, assetKey, type AssetKind } from "fenrir-ts";

type Level = { tiles: number[] };

declare module "fenrir-ts" {
  interface AssetKinds {
    "myGame.level": Level;
  }
}

const store = new AssetStore();
const key = assetKey("first");

store.registerLoader("myGame.level", "json", {
  loader: async ({ url }) => ({ tiles: [url.length] }),
  extensions: ["level"],
});
store.setAsset(key, "myGame.level", store.resolveLoader("myGame.level", "first.level")({ url: "first.level" }));

expectTypeOf<AssetKind>().toEqualTypeOf<"myGame.level">();
expectTypeOf(store.get(key)).toEqualTypeOf<Promise<Level>>();
expectTypeOf(store.get(key, "myGame.level")).toEqualTypeOf<Promise<Level>>();

// @ts-expect-error a level loader must load levels
store.registerLoader("myGame.level", "bad", { loader: async () => 1, extensions: ["bad"] });

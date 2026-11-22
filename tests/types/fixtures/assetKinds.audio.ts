// A program that imports `fenrir-ts` and `fenrir-ts/audio`. Compiled on its own by
// tests/types/assetKinds.audio.test.ts; excluded from the project's tsc run.
import { expectTypeOf } from "vitest";
import { AssetStore, assetKey, createTestGame, defineAssets, getAsset, type Asset, type AssetKind } from "fenrir-ts";
import type { AudioClip } from "fenrir-ts/audio";
import "fenrir-ts/audio";

expectTypeOf<AssetKind>().toEqualTypeOf<"audio">();
expectTypeOf<Asset>().toEqualTypeOf<AudioClip>();
expectTypeOf(new AssetStore().peek(assetKey("tap"), "audio")).toEqualTypeOf<Promise<AudioClip> | undefined>();

const Sounds = defineAssets("fixture.sounds", { assets: { tap: { kind: "audio", src: "tap.mp3" } }, bundles: { boot: ["tap"] } });
const game = await createTestGame({ seed: 1 });
expectTypeOf(getAsset(game, Sounds, "tap")).toEqualTypeOf<AudioClip>();

// @ts-expect-error the 2D kind needs fenrir-ts/2d
defineAssets("fixture.bad", { assets: { logo: { kind: "texture2d", src: "logo.png" } }, bundles: {} });

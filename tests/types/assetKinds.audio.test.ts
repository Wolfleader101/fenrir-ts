import { describe, expect, it } from "vitest";
import { typecheckFixture } from "../utils/typecheckFixture";

describe("asset kinds seen by a program that imports fenrir-ts/audio", () => {
  it("has the audio kind typed as AudioClip and no renderer kinds", () => {
    const result = typecheckFixture("assetKinds.audio.ts");

    expect(result.errors).toEqual([]);
    expect(result.loads("pixi.js")).toBe(false);
    expect(result.loads("@types/three")).toBe(false);
  });
}, 60_000);

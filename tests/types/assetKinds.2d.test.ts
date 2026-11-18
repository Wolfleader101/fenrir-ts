import { describe, expect, it } from "vitest";
import { typecheckFixture } from "../utils/typecheckFixture";

describe("asset kinds seen by a program that imports fenrir-ts/2d", () => {
  it("has texture2d typed with Pixi's Texture and no 3D kinds", () => {
    const result = typecheckFixture("assetKinds.2d.ts");

    expect(result.errors).toEqual([]);
    expect(result.loads("@types/three")).toBe(false);
  });
}, 60_000);

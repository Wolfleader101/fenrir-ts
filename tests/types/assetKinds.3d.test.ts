import { describe, expect, it } from "vitest";
import { typecheckFixture } from "../utils/typecheckFixture";

describe("asset kinds seen by a program that imports fenrir-ts/3d", () => {
  it("has model and texture3d typed with Three and no 2D kind", () => {
    const result = typecheckFixture("assetKinds.3d.ts");

    expect(result.errors).toEqual([]);
    expect(result.loads("pixi.js")).toBe(false);
  });
}, 60_000);

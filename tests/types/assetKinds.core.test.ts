import { describe, expect, it } from "vitest";
import { typecheckFixture } from "../utils/typecheckFixture";

// Each fixture is its own program, so only the entries it imports add asset kinds.
describe("asset kinds seen by a program that imports only fenrir-ts", () => {
  it("has no 2D or 3D kinds and loads no renderer types", () => {
    const result = typecheckFixture("assetKinds.core.ts");

    expect(result.errors).toEqual([]);
    expect(result.loads("pixi.js")).toBe(false);
    expect(result.loads("@types/three")).toBe(false);
  });

  it("types a kind the game declares itself", () => {
    expect(typecheckFixture("assetKinds.custom.ts").errors).toEqual([]);
  });
}, 60_000);

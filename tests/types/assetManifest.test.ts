import { describe, expect, it } from "vitest";
import { typecheckFixture } from "../utils/typecheckFixture";

describe("asset manifest types seen by a program that imports fenrir-ts/2d", () => {
  it("types assets by kind and rejects unknown names, bundles, fallbacks and kinds", () => {
    expect(typecheckFixture("assetManifest.2d.ts").errors).toEqual([]);
  });
}, 60_000);

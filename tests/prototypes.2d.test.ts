import { describe, expect, it } from "vitest";

// What importing fenrir-ts and then fenrir-ts/2d does to core classes. Runs in its own file, so
// no other test has loaded fenrir-ts/2d (or 3D) before the first snapshot.
const members = (prototype: object): string[] => Object.getOwnPropertyNames(prototype).sort();

describe("prototypes after importing fenrir-ts and fenrir-ts/2d", () => {
  // The first import of fenrir-ts/2d loads Pixi cold, which takes seconds on a busy machine.
  it("patches no AssetStore, Scene, Game or core EntityBuilder member", { timeout: 60_000 }, async () => {
    const core = await import("@/index");
    const { GameImpl } = await import("@/core/Game");
    const before = {
      assetStore: members(core.AssetStore.prototype),
      scene: members(core.Scene.prototype),
      game: members(GameImpl.prototype),
      entityBuilder: members(core.EntityBuilder.prototype),
    };
    expect(before.entityBuilder).toEqual(expect.arrayContaining(["transform", "name", "transform2D", "display2D"]));

    await import("@/2d");

    expect(members(core.AssetStore.prototype)).toEqual(before.assetStore);
    expect(members(core.Scene.prototype)).toEqual(before.scene);
    expect(members(GameImpl.prototype)).toEqual(before.game);
    // The one patch left: fenrir-ts/2d's builder methods (pixiNode, renderSprite, ...), listed
    // in AGENTS.md. Nothing else on EntityBuilder changes.
    expect(members(core.EntityBuilder.prototype).filter((name) => !before.entityBuilder.includes(name)).sort()).toEqual(
      ["pixiNode", "renderCircle", "renderRect", "renderSprite", "renderText"],
    );
  });
});

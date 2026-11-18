import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Texture } from "pixi.js";

// The 2D entry needs pixi.js only. Each of these throws if it reaches another peer.
vi.mock("three", () => {
  throw new Error("fenrir-ts/2d imported three");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/2d imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("fenrir-ts/2d imported monaco-editor");
});

/** `fenrir-ts` plus `fenrir-ts/2d`, imported the way a 2D game does. */
let core: typeof import("@/index");
let twoD: typeof import("@/2d");

beforeAll(async () => {
  core = await import("@/index");
  twoD = await import("@/2d");
});

describe("fenrir-ts/2d public API", () => {
  it("exports the Pixi renderer and its system", () => {
    expect(twoD.createPixiRendererSystem).toBeTypeOf("function");
    expect(twoD.PixiRenderer).toBeTypeOf("function");
    expect(twoD.createPixiTextureLoader).toBeTypeOf("function");
  });

  it("adds the 2D entity builder methods", () => {
    const { EntityBuilder, EntityList } = core;
    const entities = new EntityList();
    const entity = EntityBuilder.create().renderCircle(5, { fillColor: 0xff0000 }).spawn(entities);

    expect(entities.get(entity, twoD.Renderable2D).graphics).toMatchObject({ shape: "circle", data: { radius: 5 } });
  });

  it("adds 2D texture requests to the core asset store", async () => {
    const { AssetStore, assetKey } = core;
    const assets = new AssetStore();
    expect(assets.getSupportedTexture2DExtensions()).toContain("png");

    assets.registerTexture2DLoader("test", { loader: async () => Texture.EMPTY, extensions: ["test"] });
    const handle = assets.requestTexture2D(assetKey("hero"), "hero.test");
    expectTypeOf(handle).toEqualTypeOf<import("@/2d").Texture2DHandle>();
    expect(handle.state).toEqual({ status: "loading" });
    await expect(handle.ready).resolves.toBe(Texture.EMPTY);
    expect(handle.state).toEqual({ status: "ready", texture: Texture.EMPTY });

    // The 2D entry adds the "texture2d" kind; tests/types/ checks the types per entry.
    await expect(assets.get(assetKey("hero"), "texture2d")).resolves.toBe(Texture.EMPTY);
    expect(assets.kindOf(assetKey("hero"))).toBe("texture2d");
  });

  it("keeps default transforms plain, without Three", () => {
    const { EntityList, Transform } = core;
    const entities = new EntityList();
    expect(entities.get(entities.createEntity(), Transform).position).toEqual({ x: 0, y: 0, z: 0 });
  });
});

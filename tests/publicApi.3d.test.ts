import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { Quaternion, Vector3 } from "three";

// The 3D entry needs three only. Each of these throws if it reaches another peer.
vi.mock("pixi.js", () => {
  throw new Error("fenrir-ts/3d imported pixi.js");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/3d imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("fenrir-ts/3d imported monaco-editor");
});

/** `fenrir-ts` plus `fenrir-ts/3d`, imported the way a 3D game does. */
describe("fenrir-ts/3d public API", () => {
  it("loads without a WebGPU global", async () => {
    // Regression for #21: three/webgpu read GPUShaderStage while loading, so
    // importing the entry with the Three renderer threw wherever WebGPU was missing (jsdom too).
    expect("GPUShaderStage" in globalThis).toBe(false);
    await expect(import("@/3d")).resolves.toHaveProperty("bootstrapEngine");
  });

  it("exports the Three renderer, camera, skybox, animation and stats", async () => {
    const threeD = await import("@/3d");
    for (const name of [
      "createThreeRendererSystem",
      "ThreeRenderer",
      "Renderable",
      "Camera",
      "createCameraSystem",
      "SkyboxUtils",
      "createSkyboxSystem",
      "Animation",
      "createAnimationSystem",
      "createStatsSystem",
    ]) {
      expect(threeD).toHaveProperty(name);
    }
  });

  it("types Transform with Three and makes default transforms out of Three objects", async () => {
    const { EntityBuilder, EntityList, Transform: CoreTransform } = await import("@/index");
    const { Transform } = await import("@/3d");
    expect(Transform).toBe(CoreTransform);

    const entities = new EntityList();
    const transform = entities.get(entities.createEntity(), Transform);
    expectTypeOf(transform.position).toEqualTypeOf<Vector3>();
    expect(transform.position).toBeInstanceOf(Vector3);
    expect(transform.rotation).toBeInstanceOf(Quaternion);

    const box = EntityBuilder.create().transform().renderBox([1, 1, 1]).spawn(entities);
    expect(entities.get(box, Transform).scale).toBeInstanceOf(Vector3);
  });

  it("adds model and texture loading to the core asset store", async () => {
    const { AssetStore } = await import("@/index");
    await import("@/3d");
    const assets = new AssetStore();
    expect(assets.getSupportedModelExtensions()).toEqual(["glb", "gltf"]);
    expect(assets.getSupportedTextureExtensions()).toContain("png");
    expect((assets as unknown as Record<string, unknown>).requestTexture2D).toBeUndefined();
  });
});

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
      // Window-level input for the 3D path, moved here from the core entry.
      "createDomInputSystems",
      "createInputStateSystem",
      "InputState",
      "InputEvent",
    ]) {
      expect(threeD).toHaveProperty(name);
    }
  });

  it("registers every bootstrapEngine system under a namespaced fenrir name", async () => {
    const { Engine, EventBus, NullLogger, SceneManager, Scheduler } = await import("@/index");
    const { bootstrapEngine } = await import("@/3d");
    const scheduler = new Scheduler();
    const logger = new NullLogger();
    const engine = new Engine({ scheduler, sceneManager: new SceneManager(logger), events: new EventBus(), logger });
    const physics = { init: function init() {}, tick: function tick() {}, exit: function exit() {} };
    for (const [key, fn] of Object.entries(physics)) Object.defineProperty(fn, "name", { value: `fenrir.physics.${key}` });

    bootstrapEngine(engine, logger, { canvas: document.createElement("canvas"), physics, enableAnimations: true });

    expect(scheduler.describe()).toBe([
      "preInit: ",
      "init: fenrir.input.dom.init, fenrir.three.init, fenrir.animation.init, fenrir.physics.init, fenrir.camera.init, fenrir.skybox.init",
      "postInit: ",
      "preUpdate: fenrir.input.state.preUpdate, fenrir.camera.preUpdate, fenrir.skybox.preUpdate, fenrir.animation.preUpdate",
      "tick: fenrir.physics.tick",
      "update: fenrir.camera.update, fenrir.three.update",
      "postUpdate: fenrir.three.postUpdate",
      "exit: fenrir.input.dom.exit, fenrir.three.exit, fenrir.animation.exit, fenrir.physics.exit, fenrir.camera.exit, fenrir.skybox.exit",
    ].join("\n"));
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

import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";

// The core entry must not load any renderer, physics or editor package. Each of
// these throws if anything the core imports reaches it.
vi.mock("three", () => {
  throw new Error("the core entry imported three");
});
vi.mock("pixi.js", () => {
  throw new Error("the core entry imported pixi.js");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("the core entry imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("the core entry imported monaco-editor");
});

/**
 * Everything here goes through the published core entry point, `fenrir-ts`, the
 * way a consuming game does. The README quick start mirrors the engine test below.
 */
type Core = typeof import("@/index");
let core: Core;

beforeAll(async () => {
  core = await import("@/index");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("fenrir-ts core public API", () => {
  it("exports no renderer, physics or 3D setup", () => {
    for (const name of ["bootstrapEngine", "createPixiRendererSystem", "PixiRenderer", "Renderable2D", "Camera", "SkyboxUtils", "PhysicsBody"]) {
      expect(core).not.toHaveProperty(name);
    }
  });

  it("adds only the core entity builder methods", () => {
    const prototype = core.EntityBuilder.prototype as unknown as Record<string, unknown>;
    expect(prototype.transform).toBeTypeOf("function");
    expect(prototype.name).toBeTypeOf("function");
    for (const method of ["renderSprite", "renderBox", "model", "physicsBody", "perspectiveCamera"]) {
      expect(prototype[method]).toBeUndefined();
    }
  });

  it("gives entities a plain transform and an asset store with no renderer loaders", () => {
    const { AssetStore, EntityList, Transform } = core;
    const entities = new EntityList();
    expect(entities.get(entities.createEntity(), Transform)).toEqual({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });

    const assets = new AssetStore() as InstanceType<typeof AssetStore> & Record<string, unknown>;
    expect(assets.requestTexture2D).toBeUndefined();
    expect(assets.loadModel).toBeUndefined();
  });

  it("defines and queries a custom component", () => {
    const { EntityList, defineComponent } = core;
    type Health = { current: number; max: number };
    const Health = defineComponent<Health>("publicApi.Health");

    const entities = new EntityList();
    const wounded = entities.createEntity();
    entities.set(wounded, Health, { current: 3, max: 10 });
    entities.createEntity();

    const seen: Array<[number, number]> = [];
    entities.each([Health] as const, (entity, health) => {
      expectTypeOf(health).toEqualTypeOf<Health>();
      seen.push([entity, health.current]);
    });

    expect(seen).toEqual([[wounded, 3]]);
  });

  it("rejects a component value of the wrong shape at compile time", () => {
    const { EntityList, defineComponent } = core;
    const Score = defineComponent<{ points: number }>("publicApi.Score");
    const entities = new EntityList();
    const entity = entities.createEntity();

    // @ts-expect-error points must be a number
    entities.set(entity, Score, { points: "ten" });
    expect(entities.has(entity, Score)).toBe(true);
  });

  it("runs the README quick start and gives systems a run lifetime", async () => {
    const { ConsoleLogger, Engine, EventBus, NullLogger, SceneManager, Schedule, Scheduler } = core;
    expect(ConsoleLogger).toBeTypeOf("function");
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const logger = new NullLogger();
    const engine = new Engine({
      scheduler: new Scheduler(),
      sceneManager: new SceneManager(logger),
      events: new EventBus(),
      logger,
    });

    const cleanup = vi.fn();
    let lifetime: AbortSignal | undefined;
    engine.addSystem(Schedule.Init, ({ signal, onCleanup }) => {
      expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
      lifetime = signal;
      onCleanup(cleanup);
    });

    await engine.run();
    expect(engine.isRunning()).toBe(true);
    expect(lifetime?.aborted).toBe(false);

    await engine.stop();
    expect(lifetime?.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

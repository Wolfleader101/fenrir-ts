import { afterAll, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";

/**
 * Everything here goes through the published core entry point, the way a
 * consuming game does. The README quick start mirrors the engine test below.
 */
type Core = typeof import("@/core/index");
let core: Core;

beforeAll(async () => {
  core = await import("@/core/index");
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("fenrir-ts/core public API", () => {
  it("loads without a WebGPU global", async () => {
    // Regression for #21: three/webgpu read GPUShaderStage while loading, so
    // importing the core entry threw wherever WebGPU was missing (jsdom too).
    expect("GPUShaderStage" in globalThis).toBe(false);
    vi.resetModules();
    await expect(import("@/core/index")).resolves.toHaveProperty("bootstrapEngine");
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

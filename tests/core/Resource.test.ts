import { AssetStore } from "@/core/Assets/AssetStore";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Resources, defineResource } from "@/core/Resource";
import type { ResourceType } from "@/core/Resource";
import { createGame } from "@/core/Game";
import { Engine } from "@/core/Engine";
import { Scheduler, Schedule } from "@/core/Scheduler";
import { SceneManager } from "@/core/SceneManager";
import { EventBus } from "@/core/EventBus";
import { NullLogger } from "@/core/NullLogger";
import type { SystemCtx } from "@/core/SystemCtx";
import { GameStates } from "@/core/State";
import { InputImpl } from "@/core/Input/Input";
import { Random } from "@/core/Random";

/** Stubs the frame loop. `frame()` runs the scheduled animation frame. */
function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { callback = undefined; }));
  return () => {
    const next = callback;
    callback = undefined;
    next?.(performance.now());
  };
}

const canvas = () => document.createElement("canvas");
const logger = new NullLogger();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("defineResource", () => {
  it("returns a frozen handle that carries the name", () => {
    const Score = defineResource<number>("test.resource.handle");
    expect(Score.name).toBe("test.resource.handle");
    expect(Object.isFrozen(Score)).toBe(true);
  });

  it("infers the type from the factory", () => {
    const Round = defineResource("test.resource.infer", () => ({ meter: 0.5, score: 0 }));
    expectTypeOf(Round).toEqualTypeOf<ResourceType<{ meter: number; score: number }>>();
  });

  it("allows two definitions with one name, which share one value, as components do", () => {
    const A = defineResource("test.resource.shared", () => 1);
    const B = defineResource("test.resource.shared", () => 2);
    const resources = new Resources();
    expect(resources.get(B)).toBe(2);
    expect(resources.get(A)).toBe(2);
    resources.set(A, 3);
    expect(resources.get(B)).toBe(3);
  });
});

describe("Resources", () => {
  it("runs the factory once, on first get", () => {
    const factory = vi.fn(() => ({ count: 0 }));
    const Counter = defineResource("test.resource.once", factory);
    const resources = new Resources();
    expect(factory).not.toHaveBeenCalled();

    const first = resources.get(Counter);
    first.count += 1;
    expect(resources.get(Counter)).toBe(first);
    expect(resources.get(Counter).count).toBe(1);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("returns a set value instead of running the factory", () => {
    const factory = vi.fn(() => 1);
    const Level = defineResource("test.resource.setFirst", factory);
    const resources = new Resources();
    resources.set(Level, 7);
    expect(resources.get(Level)).toBe(7);
    expect(factory).not.toHaveBeenCalled();
  });

  it("keeps a set value of undefined", () => {
    const Target = defineResource<string | undefined>("test.resource.undefined", () => "x");
    const resources = new Resources();
    resources.set(Target, undefined);
    expect(resources.get(Target)).toBeUndefined();
  });

  it("throws on get of a resource with no factory and no value, naming it and saying where to set it", () => {
    const Seed = defineResource<number>("test.resource.missing");
    const resources = new Resources();
    expect(() => resources.get(Seed)).toThrow(
      'Resource "test.resource.missing" has no value. It has no factory, so set it before it is read: ' +
        "call game.resources.set before game.run(), or ctx.resources.set in an earlier system. " +
        'Or pass a factory: defineResource("test.resource.missing", () => value).',
    );
    resources.set(Seed, 42);
    expect(resources.get(Seed)).toBe(42);
  });

  it("does not cache a factory that throws, so the next get runs it again", () => {
    let fail = true;
    const Flaky = defineResource("test.resource.flaky", () => {
      if (fail) throw new Error("not ready");
      return 5;
    });
    const resources = new Resources();
    expect(() => resources.get(Flaky)).toThrow("not ready");
    fail = false;
    expect(resources.get(Flaky)).toBe(5);
  });

  it("throws when a factory reads its own resource", () => {
    const resources = new Resources();
    const Loop: ResourceType<number> = defineResource("test.resource.loop", (): number => resources.get(Loop) + 1);
    expect(() => resources.get(Loop)).toThrow(
      'The factory of resource "test.resource.loop" reads "test.resource.loop".',
    );
  });

  it("lets a factory read another resource", () => {
    const Base = defineResource("test.resource.base", () => 2);
    const resources = new Resources();
    const Double = defineResource("test.resource.double", () => resources.get(Base) * 2);
    expect(resources.get(Double)).toBe(4);
  });

  it("types get as exactly T and rejects a wrong shape in set", () => {
    const Round = defineResource("test.resource.types", () => ({ meter: 0.5, score: 0 }));
    const resources = new Resources();
    expectTypeOf(resources.get(Round)).toEqualTypeOf<{ meter: number; score: number }>();

    // @ts-expect-error score must be a number
    resources.set(Round, { meter: 1, score: "high" });
    // @ts-expect-error score is required
    resources.set(Round, { meter: 1 });
    resources.set(Round, { meter: 1, score: 2 });
    expect(resources.get(Round)).toEqual({ meter: 1, score: 2 });
  });
});

describe("resources on a game", () => {
  it("are one object on game and ctx", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    let seen: SystemCtx | undefined;
    game.addSystem(Schedule.Init, function capture(ctx) { seen = ctx; });
    await game.run();
    expect(game.resources).toBeInstanceOf(Resources);
    expect(seen?.resources).toBe(game.resources);
    await game.stop();
  });

  it("belong to one game: two games never share values or factory runs", async () => {
    const factory = vi.fn(() => ({ score: 0 }));
    const Score = defineResource("test.resource.isolated", factory);
    const a = await createGame({ canvas: canvas(), logger });
    const b = await createGame({ canvas: canvas(), logger });

    a.resources.get(Score).score = 10;
    expect(b.resources.get(Score).score).toBe(0);
    expect(factory).toHaveBeenCalledTimes(2);

    const Seed = defineResource<number>("test.resource.isolatedSeed");
    a.resources.set(Seed, 1);
    expect(() => b.resources.get(Seed)).toThrow('Resource "test.resource.isolatedSeed" has no value');
  });

  it("can be seeded before run() and read by startup and frame systems", async () => {
    const frame = stubFrames();
    const Seed = defineResource<{ level: number }>("test.resource.seeded");
    const game = await createGame({ canvas: canvas(), logger });
    game.resources.set(Seed, { level: 3 });

    const seen: number[] = [];
    game
      .addSystem(Schedule.Init, function readAtInit({ resources }) { seen.push(resources.get(Seed).level); })
      .addSystem(Schedule.Update, function readInFrame({ resources }) { seen.push(resources.get(Seed).level); });
    await game.run();
    frame();
    expect(seen).toEqual([3, 3]);
    await game.stop();
  });

  it("let a system read and mutate a resource across frames", async () => {
    const frame = stubFrames();
    const Round = defineResource("test.resource.frames", () => ({ frames: 0 }));
    const game = await createGame({ canvas: canvas(), logger });
    game.addSystem(Schedule.Update, function count({ resources }) { resources.get(Round).frames += 1; });
    await game.run();
    frame();
    frame();
    frame();
    expect(game.resources.get(Round).frames).toBe(3);
    await game.stop();
  });

  it("let one system set a value that a later system reads", async () => {
    const frame = stubFrames();
    const Target = defineResource<string>("test.resource.handoff");
    const game = await createGame({ canvas: canvas(), logger });
    let read: string | undefined;
    game
      .addSystem(Schedule.Init, function pick({ resources }) { resources.set(Target, "door"); })
      .addSystem(Schedule.Update, function use({ resources }) { read = resources.get(Target); });
    await game.run();
    frame();
    expect(read).toBe("door");
    await game.stop();
  });

  it("keep their values when the game stops and runs again", async () => {
    stubFrames();
    const factory = vi.fn(() => ({ runs: 0 }));
    const Runs = defineResource("test.resource.stopRun", factory);
    const game = await createGame({ canvas: canvas(), logger });
    game.addSystem(Schedule.Init, function countRuns({ resources }) { resources.get(Runs).runs += 1; });
    await game.run();
    await game.stop();
    await game.run();
    expect(game.resources.get(Runs).runs).toBe(2);
    expect(factory).toHaveBeenCalledTimes(1);
    await game.stop();
  });
});

describe("resources on an engine", () => {
  function engine(resources?: Resources) {
    return new Engine({
      scheduler: new Scheduler(),
      sceneManager: new SceneManager(logger),
      events: new EventBus(),
      logger,
      services: resources ? { resources, states: new GameStates(), random: new Random(1), input: new InputImpl(resources), assets: new AssetStore() } : undefined,
    });
  }

  it("makes its own when no services are passed", async () => {
    stubFrames();
    const e = engine();
    let seen: Resources | undefined;
    e.addSystem(Schedule.Init, function capture({ resources }) { seen = resources; });
    await e.run();
    expect(seen).toBeInstanceOf(Resources);
    await e.stop();
  });

  it("drops every value on reset, so factories run again and set values are gone", async () => {
    stubFrames();
    const factory = vi.fn(() => ({ score: 0 }));
    const Score = defineResource("test.resource.reset", factory);
    const Seed = defineResource<number>("test.resource.resetSeed");
    const resources = new Resources();
    const e = engine(resources);
    e.addSystem(Schedule.Init, function score({ resources }) { resources.get(Score).score += 5; });
    resources.set(Seed, 1);
    await e.run();
    expect(resources.get(Score).score).toBe(5);

    await e.reset();
    // reset re-ran Init, which read Score from a fresh factory value.
    expect(resources.get(Score).score).toBe(5);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(() => resources.get(Seed)).toThrow('Resource "test.resource.resetSeed" has no value');
    await e.stop();
  });
});

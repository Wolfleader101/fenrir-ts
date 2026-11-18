import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame, type Game } from "@/core/Game";
import { createTestGame } from "@/core/TestGame";
import type { GameSnapshot } from "@/core/Inspect";
import { defineComponent } from "@/core/ECS/Component";
import { Name } from "@/core/ECS/DefaultComponents";
import { NullLogger } from "@/core/NullLogger";
import { defineResource } from "@/core/Resource";
import { Schedule } from "@/core/Scheduler";
import { defineState, inState } from "@/core/State";
import type { SystemCtx } from "@/core/SystemCtx";
import type { ILogger } from "@/core/ILogger";

// The engine reads performance.now() through the real clock; each frame moves it 16 ms.
let now = 0;
let frame: FrameRequestCallback | undefined;
beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => ((frame = cb), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => (frame = undefined)));
});
afterEach(() => {
  frame = undefined;
  delete (window as { __FENRIR__?: unknown }).__FENRIR__;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function runFrames(count: number): void {
  for (let i = 0; i < count; i++) {
    now += 16;
    const next = frame;
    frame = undefined;
    next?.(now);
  }
}

const roundTrip = (snapshot: GameSnapshot): unknown => JSON.parse(JSON.stringify(snapshot));
const newGame = (options: { debug?: boolean; logger?: ILogger } = {}): Promise<Game> =>
  createGame({ canvas: document.createElement("canvas"), logger: new NullLogger(), ...options });

// A Pixi-like display object: a class whose fields are not all primitives.
class Container {
  public children: Container[] = [];
  public position = { x: 0, y: 0 };
}

type Health = { current: number; max: number };
const Health = defineComponent<Health>("test.inspect.Health");
const View = defineComponent<{ sprite: Container; onHit: () => void }>("test.inspect.View");
const Phase = defineState("test.inspect.Phase", { values: ["menu", "playing"], initial: "menu" });
const Weather = defineState("test.inspect.Weather", { values: ["clear", "rain"], initial: "clear" });
const Session = defineResource("test.inspect.Session", () => ({ scores: new Map([["ana", 3], ["bo", 1]]), round: 1 }));
const Level = defineResource<number>("test.inspect.Level");

async function smallGame(): Promise<Game> {
  const game = await newGame();
  game.resources.set(Level, 2);
  game
    .addSystem(Schedule.Init, function spawnWorld({ entities, resources }: SystemCtx) {
      const world = entities.createEntity();
      entities.set(world, Name, { name: "World" });
      for (const name of ["Player", "Enemy"]) {
        const child = entities.createEntity();
        entities.set(child, Name, { name });
        entities.set(child, Health, { current: 10, max: 10 });
        entities.addChild(world, child);
      }
      entities.set(world, View, { sprite: new Container(), onHit: function onHit() {} });
      resources.get(Session);
    })
    .addSystem(Schedule.PostInit, function startPlaying({ states }: SystemCtx) {
      states.set(Phase, "playing");
    })
    .addSystem(Schedule.Update, function hurtEnemy({ entities }: SystemCtx) {
      entities.get(2, Health).current -= 1;
    }, { runIf: inState(Phase, "playing") })
    .addSystem(Schedule.Update, () => {}, { name: "test.inspect.hud", before: "hurtEnemy" })
    .addSystem(Schedule.Exit, function saveGame() {});
  game.states.get(Weather);
  return game;
}

const transform = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
};

describe("game.inspect()", () => {
  it("reports a small game in full", async () => {
    const game = await smallGame();
    await game.run();
    runFrames(3);

    expect(game.inspect()).toEqual({
      frame: 3,
      time: { elapsed: 0.048, delta: 0.016 },
      schedule: {
        preInit: [],
        init: ["spawnWorld"],
        postInit: ["startPlaying"],
        preUpdate: [],
        tick: [],
        update: ["test.inspect.hud", "hurtEnemy"],
        postUpdate: [],
        exit: ["saveGame"],
      },
      states: {
        "test.inspect.Phase": { value: "playing", timeIn: 0.048 },
        "test.inspect.Weather": { value: "clear", timeIn: 0.048 },
      },
      resources: {
        "test.inspect.Level": 2,
        "test.inspect.Session": { scores: { $type: "Map", entries: [["ana", 3], ["bo", 1]] }, round: 1 },
      },
      entities: [
        {
          id: 0,
          name: "World",
          parent: null,
          components: {
            "fenrir.Transform": transform,
            "test.inspect.View": { sprite: { $type: "Container" }, onHit: { $type: "function", name: "onHit" } },
          },
        },
        { id: 1, name: "Player", parent: 0, components: { "fenrir.Transform": transform, "test.inspect.Health": { current: 10, max: 10 } } },
        { id: 2, name: "Enemy", parent: 0, components: { "fenrir.Transform": transform, "test.inspect.Health": { current: 7, max: 10 } } },
      ],
    });
    await game.stop();
  });

  it("returns equal snapshots when no frame runs between two calls, even as the clock moves", async () => {
    const game = await smallGame();
    await game.run();
    runFrames(2);
    const first = game.inspect();
    now += 500;
    expect(game.inspect()).toEqual(first);
    expect(JSON.stringify(game.inspect())).toBe(JSON.stringify(first));
    await game.stop();
  });

  it("survives a JSON round trip unchanged", async () => {
    const game = await smallGame();
    await game.run();
    runFrames(1);
    const snapshot = game.inspect();
    expect(roundTrip(snapshot)).toEqual(snapshot);
    await game.stop();
  });

  it("orders entities by id, components, states and resources by name, whatever the order they were made in", async () => {
    const game = await newGame();
    const B = defineComponent<number>("test.inspect.order.B");
    const A = defineComponent<number>("test.inspect.order.A");
    game.resources.set(defineResource<number>("test.inspect.order.z"), 1);
    game.resources.set(defineResource<number>("test.inspect.order.a"), 2);
    game.states.get(defineState("test.inspect.order.Z", { values: ["x"], initial: "x" }));
    game.states.get(defineState("test.inspect.order.A", { values: ["x"], initial: "x" }));
    game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
      const first = entities.createEntity();
      const second = entities.createEntity();
      entities.set(second, B, 1);
      entities.set(second, A, 2);
      entities.destroyEntity(first);
    });
    await game.run();

    const snapshot = game.inspect();
    expect(Object.keys(snapshot.resources)).toEqual(["test.inspect.order.a", "test.inspect.order.z"]);
    expect(Object.keys(snapshot.states)).toEqual(["test.inspect.order.A", "test.inspect.order.Z"]);
    expect(snapshot.entities.map((e) => e.id)).toEqual([1]);
    expect(Object.keys(snapshot.entities[0]!.components)).toEqual(["fenrir.Transform", "test.inspect.order.A", "test.inspect.order.B"]);
    await game.stop();
  });

  it("reports a recycled entity by its handle, which carries its generation", async () => {
    const game = await newGame();
    let reused = 0;
    game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
      entities.destroyEntity(entities.createEntity());
      reused = entities.createEntity();
    });
    await game.run();
    expect(reused).not.toBe(0);
    expect(game.inspect().entities).toMatchObject([{ id: reused, name: "Entity 0" }]);
    await game.stop();
  });

  it("names a component keyed by a symbol defineComponent did not make by the symbol's text", async () => {
    const game = await newGame();
    game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
      entities.set(entities.createEntity(), Symbol("loose"), { a: 1 });
    });
    await game.run();
    expect(game.inspect().entities[0]!.components["Symbol(loose)"]).toEqual({ a: 1 });
    await game.stop();
  });

  it("reports the active scene", async () => {
    const game = await newGame();
    game.addSystem(Schedule.Init, function spawn({ entities, scenes }: SystemCtx) {
      entities.createEntity();
      scenes.createScene("level2");
      scenes.changeActiveScene("level2");
    });
    await game.run();
    expect(game.inspect().entities).toEqual([]);
    await game.stop();
  });

  it("works before run, while paused and after stop", async () => {
    const game = await smallGame();
    const before = game.inspect();
    expect(before.frame).toBe(0);
    expect(before.time).toEqual({ elapsed: 0, delta: 0 });
    expect(before.entities).toEqual([]);
    // Only states the game has used appear: Weather was read during setup, Phase not yet.
    expect(before.states).toEqual({ "test.inspect.Weather": { value: "clear", timeIn: 0 } });
    expect(before.schedule.update).toEqual(["test.inspect.hud", "hurtEnemy"]);

    await game.run();
    runFrames(2);
    game.pause();
    now += 1000;
    const paused = game.inspect();
    expect(paused.frame).toBe(2);
    expect(paused.time.elapsed).toBeCloseTo(0.032);

    game.resume();
    runFrames(1);
    await game.stop();
    const after = game.inspect();
    expect(after.frame).toBe(3);
    expect(after.entities).toHaveLength(3);
  });

  it("counts frames from 0 again when the game runs again", async () => {
    const game = await smallGame();
    await game.run();
    runFrames(4);
    await game.stop();
    await game.run();
    expect(game.inspect().frame).toBe(0);
    runFrames(1);
    expect(game.inspect().frame).toBe(1);
    await game.stop();
  });

  it("reports the frame a system runs in", async () => {
    const game = await newGame();
    const seen: number[] = [];
    game.addSystem(Schedule.Update, function look() {
      seen.push(game.inspect().frame);
    });
    await game.run();
    runFrames(2);
    expect(seen).toEqual([1, 2]);
    await game.stop();
  });

  it("does not throw when a component's getter throws", async () => {
    const game = await newGame();
    const Bad = defineComponent<object>("test.inspect.Bad");
    game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
      entities.set(entities.createEntity(), Bad, { get boom(): number { throw new Error("boom"); } });
    });
    await game.run();
    expect(game.inspect().entities[0]!.components["test.inspect.Bad"]).toEqual({ boom: { $type: "Thrown", message: "boom" } });
    await game.stop();
  });

  it("shows registration order when the schedule cannot be resolved, instead of throwing", async () => {
    const game = await newGame();
    game.addSystem(Schedule.Update, function a() {}, { after: "missing" });
    expect(game.inspect().schedule.update).toEqual(["a"]);
  });
});

describe("inspect on a test game", () => {
  it("counts stepped frames and reports stepped time, resetting at start()", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    game.addSystem(Schedule.Update, function hurt({ entities }: SystemCtx) {
      entities.get(0, Health).current -= 1;
    });
    game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
      entities.set(entities.createEntity(), Health, { current: 10, max: 10 });
    });
    await game.start();
    game.step(0.1, 3);
    const snapshot = game.inspect();
    expect(snapshot.frame).toBe(3);
    expect(snapshot.time.delta).toBeCloseTo(0.1);
    expect(snapshot.time.elapsed).toBeCloseTo(0.3); // three frames of 0.1 s, as the third frame saw it
    expect(snapshot.entities[0]!.components["test.inspect.Health"]).toEqual({ current: 7, max: 10 });
    await game.stop();
    await game.start();
    expect(game.inspect().frame).toBe(0);
    await game.stop();
  });
});

describe("createGame({ debug })", () => {
  it("puts inspect on window.__FENRIR__ with debug: true", async () => {
    const game = await smallGame();
    const debugGame = await newGame({ debug: true });
    debugGame.resources.set(Level, 9);
    expect(window.__FENRIR__!.inspect()).toEqual(debugGame.inspect());
    expect(window.__FENRIR__!.inspect().resources).toEqual({ "test.inspect.Level": 9 });
    void game;
  });

  it("leaves window.__FENRIR__ alone by default", async () => {
    await newGame();
    expect(window.__FENRIR__).toBeUndefined();
  });

  it("gives window.__FENRIR__ to the last debug game created, with a warning, and keeps it after stop", async () => {
    const logger = { ...new NullLogger(), warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as unknown as ILogger;
    const first = await newGame({ debug: true });
    first.resources.set(Level, 1);
    const second = await newGame({ debug: true, logger });
    second.resources.set(Level, 2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("window.__FENRIR__"));
    expect(window.__FENRIR__!.inspect().resources["test.inspect.Level"]).toBe(2);

    await second.run();
    await second.stop();
    expect(window.__FENRIR__!.inspect().resources["test.inspect.Level"]).toBe(2);
  });

  it("two games report their own state", async () => {
    const one = await newGame();
    const two = await newGame();
    one.resources.set(Level, 1);
    two.resources.set(Level, 2);
    expect(one.inspect().resources).toEqual({ "test.inspect.Level": 1 });
    expect(two.inspect().resources).toEqual({ "test.inspect.Level": 2 });
  });

  it("does nothing where there is no window", async () => {
    vi.stubGlobal("window", undefined);
    const game = await newGame({ debug: true });
    expect(game.inspect().frame).toBe(0);
    vi.unstubAllGlobals();
    expect(window.__FENRIR__).toBeUndefined();
  });
});

declare global {
  interface Window {
    __FENRIR__?: { inspect(): GameSnapshot };
  }
}

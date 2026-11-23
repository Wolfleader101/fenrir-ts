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
    for (const name of ["bootstrapEngine", "createPixiRendererSystem", "PixiRenderer", "Renderable2D", "PixiNode", "Camera", "SkyboxUtils", "PhysicsBody",
      "createDomInputSystems", "createInputStateSystem", "createPointerInputSystems", "InputState", "InputEvent"]) {
      expect(core).not.toHaveProperty(name);
    }
  });

  it("adds only the core entity builder methods", () => {
    const prototype = core.EntityBuilder.prototype as unknown as Record<string, unknown>;
    expect(prototype.transform).toBeTypeOf("function");
    expect(prototype.name).toBeTypeOf("function");
    expect(prototype.transform2D).toBeTypeOf("function");
    for (const method of ["pixiNode", "renderSprite", "renderBox", "model", "physicsBody", "perspectiveCamera"]) {
      expect(prototype[method]).toBeUndefined();
    }
  });

  it("exports Transform2D as plain data, opt in per entity", () => {
    const { EntityBuilder, EntityList, Transform2D } = core;
    const entities = new EntityList();
    expect(entities.has(entities.createEntity(), Transform2D)).toBe(false);
    const entity = EntityBuilder.create().transform2D(1, 2, { rotation: 0.5 }).spawn(entities);
    expect(entities.get(entity, Transform2D)).toEqual({ x: 1, y: 2, rotation: 0.5, scaleX: 1, scaleY: 1 });
  });

  it("exports Display2D as plain data, opt in per entity", () => {
    const { Display2D, EntityBuilder, EntityList } = core;
    const entities = new EntityList();
    expect(entities.has(entities.createEntity(), Display2D)).toBe(false);
    expect(entities.get(EntityBuilder.create().display2D().spawn(entities), Display2D)).toEqual({ alpha: 1, visible: true });
    expect(entities.get(EntityBuilder.create().display2D({ alpha: 0.5 }).spawn(entities), Display2D)).toEqual({ alpha: 0.5, visible: true });
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
    }, { name: "test.lifetime" });

    await engine.run();
    expect(engine.isRunning()).toBe(true);
    expect(lifetime?.aborted).toBe(false);

    await engine.stop();
    expect(lifetime?.aborted).toBe(true);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs a test game headless: start, step, clock.advance and stop, with exact types", async () => {
    const { Schedule, createTestGame, defineState, inState, NullLogger } = core;
    type TestGame = import("@/index").TestGame;
    type Game = import("@/index").Game;
    const Phase = defineState("publicApi.testGame.Phase", { values: ["waiting", "casting"], initial: "waiting" });

    const game = await createTestGame({ seed: 1, now: 1_700_000_000_000, logger: new NullLogger() });
    expectTypeOf(game).toEqualTypeOf<TestGame>();
    expectTypeOf(game.step).toEqualTypeOf<(dt?: number, frames?: number) => void>();
    expectTypeOf(game.clock.advance).toEqualTypeOf<(ms: number) => void>();
    expectTypeOf<TestGame>().not.toHaveProperty("canvas");
    expectTypeOf<TestGame>().not.toHaveProperty("run");
    expectTypeOf<TestGame>().not.toHaveProperty("pause");
    expectTypeOf<Game["step"]>().toEqualTypeOf<TestGame["step"]>();

    let ticks = 0;
    let now = 0;
    game
      .addSystem(Schedule.Tick, function meter() { ticks++; }, { runIf: inState(Phase, "casting") })
      .addSystem(Schedule.Update, function read({ time }) { now = time.now(); });
    expect(game.addSystem(Schedule.Update, function chained() {})).toBe(game);
    await game.start();
    game.states.set(Phase, "casting");
    game.step(1 / 60);
    game.step(1 / 60, 29);
    game.clock.advance(5_000);
    expect(ticks).toBe(30);
    expect(now).toBeCloseTo(1_700_000_000_500, 6);
    await game.stop();
  });

  it("runs timers and tweens headless with the motion() plugin, as plain data (#38)", async () => {
    const { Display2D, MotionSettings, Schedule, TimerFired, Transform2D, TweenDone, Tweens, addTimer, addTween, cancelTween, createTestGame, defineEasing, easings, motion, NullLogger } = core;
    type Tween = import("@/index").Tween;
    type NumericKeys<T> = import("@/index").NumericKeys<T>;
    expectTypeOf<NumericKeys<import("@/index").Display2D>>().toEqualTypeOf<"alpha">();
    expectTypeOf(easings.quadOut).toEqualTypeOf<(t: number) => number>();

    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [motion()] });
    const events: string[] = [];
    game.on(TimerFired, ({ name, count }) => void events.push(`${name} ${count}`));
    game.on(TweenDone, ({ name }) => void events.push(`${name} done`));
    defineEasing("publicApi.half", (t) => t / 2);
    let entity = 0;
    let ctx!: import("@/index").SystemCtx;
    game.addSystem(Schedule.Init, function spawn(c) {
      ctx = c;
      entity = core.EntityBuilder.create().transform2D(0, 0).display2D().spawn(c.entities);
      addTween(c, entity, Transform2D, { to: { x: 10 }, duration: 0.5, ease: "publicApi.half" });
      addTween(c, entity, Display2D, { to: { alpha: 0 }, duration: 0.25, name: "publicApi.fade" });
      addTimer(c, entity, "publicApi.timer", { duration: 0.125, repeat: 1 });
      // @ts-expect-error visible is a boolean, not a tweenable number
      expect(() => addTween(c, entity, Display2D, { to: { visible: 1 }, duration: 1 })).toThrow(/not a number/);
    });
    await game.start();
    game.step(0.25);
    expect(events).toEqual(["publicApi.timer 1", "publicApi.timer 2", "publicApi.fade done"]);
    expect(ctx.entities.get(entity, Transform2D).x).toBe(2.5);
    const tween: Tween = ctx.entities.get(entity, Tweens)["fenrir.Transform2D:x"]!;
    expect(tween).toMatchObject({ component: "fenrir.Transform2D", ease: "publicApi.half", elapsed: 0.25 });
    expect(game.inspect().resources["fenrir.MotionSettings"]).toEqual({ paused: {}, pausedAll: false, reducedMotion: false });
    expect(game.inspect().schedule.preUpdate).toEqual(["fenrir.motion.preUpdate"]);
    game.resources.get(MotionSettings).reducedMotion = true;
    game.step(0);
    expect(ctx.entities.get(entity, Transform2D).x).toBe(10);
    expect(cancelTween(ctx, entity, "fenrir.Transform2D:x")).toBe(false);
    await game.stop();
  });

  it("loads an asset manifest headless with progress, a fallback and unload, as plain data (#38)", async () => {
    const { AssetBundleError, AssetBundleLoaded, Schedule, createTestGame, defineAssets, getAsset, loadAssets, setAssetLoader, unloadAssets, NullLogger } = core;
    // The core entry adds no asset kind; a game declares its own, as fenrir-ts/2d declares texture2d.
    type Kind = import("@/index").AssetKind;
    const kind = "texture2d" as Kind;
    const Assets = defineAssets("publicApi.assets", {
      assets: { a: { kind, src: "a.png" }, b: { kind, src: "b.png", fallback: "a" }, c: { kind, src: "c.png" } },
      bundles: { boot: ["a"], level: ["b"], broken: ["c"] },
    });
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    const unloaded: string[] = [];
    setAssetLoader(game, {
      load: async ({ name }) => (name === "a" ? { name } : Promise.reject(new Error(`no ${name}`))),
      unload: ({ name }) => void unloaded.push(name),
    });
    const loaded: string[] = [];
    game.on(AssetBundleLoaded, ({ bundle, fallbacks }) => void loaded.push(`${bundle} ${fallbacks}`));
    game.addSystem(Schedule.PreInit, async function boot(ctx) {
      await loadAssets(ctx, Assets, ["boot", "level"]);
    });
    await game.start();
    expect(loaded).toEqual(["boot ", "level b"]);
    expect(getAsset(game, Assets, "b")).toEqual({ name: "a" });
    await expect(loadAssets(game, Assets, "broken")).rejects.toBeInstanceOf(AssetBundleError);
    expect(game.inspect().resources["publicApi.assets"]).toMatchObject({ loaded: 2, failed: 1, total: 3 });
    unloadAssets(game, Assets, ["level", "boot", "broken"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unloaded).toEqual(["a"]);
    await game.stop();
  });

  it("stores typed values with defaults, migration and a memory fallback, as plain status (#39)", async () => {
    const { StorageStatus, createTestGame, defineStorageKey, getStored, memoryStorage, removeStored, setStored, storage, updateStored, NullLogger } = core;
    const Muted = defineStorageKey("publicApi.muted", { default: false });
    const Best = defineStorageKey("publicApi.best", {
      default: { score: 0 },
      version: 2,
      parse: (v) => (typeof v === "object" && v !== null && typeof (v as { score?: unknown }).score === "number" ? { score: (v as { score: number }).score } : undefined),
      migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v } : v),
    });
    const backend = memoryStorage({ "slot1:publicApi.best": "12", "slot1:publicApi.muted": "{broken" });
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [storage({ backend, prefix: "slot1:" })] });
    expectTypeOf(getStored(game, Best)).toEqualTypeOf<{ score: number }>();
    // @ts-expect-error a stored value has its key's type
    void (() => setStored(game, Muted, "yes"));
    expect(getStored(game, Muted)).toBe(false);
    expect(getStored(game, Best)).toEqual({ score: 12 });
    expect(backend.items.get("slot1:publicApi.best")).toBe('{"v":2,"value":{"score":12}}');
    expect(setStored(game, Muted, true)).toBe(true);
    expect(updateStored(game, Best, ({ score }) => ({ score: score + 1 }))).toEqual({ score: 13 });
    removeStored(game, Muted);
    expect(getStored(game, Muted)).toBe(false);
    expect(game.inspect().resources["fenrir.StorageStatus"]).toEqual({
      backend: "memory",
      persistent: true,
      lastError: { key: "publicApi.muted", message: expect.stringContaining("invalid value") },
    });
    expect(game.resources.get(StorageStatus).persistent).toBe(true);
  });

  it("closes the gaps a first consumer found: key families, lazy migration, resource binding, has, pausedAll, maxFrameDelta", async () => {
    const { MotionSettings, Schedule, createTestGame, defineResource, defineStorageKey, defineStorageKeyFamily, getStored, memoryStorage, motion, persistResource, setStored, storage, NullLogger } = core;
    const Best = defineStorageKeyFamily("publicApi.best.", { default: 0, version: 2, migrate: (v) => v, writeMigrated: false });
    expectTypeOf(Best("reef")).toEqualTypeOf<import("@/index").StorageKey<number>>();
    expect(Best("reef")).toBe(Best("reef"));
    const Settings = defineResource("publicApi.Settings", () => ({ hints: true }));
    const Hints = defineStorageKey("publicApi.hints", { default: true });
    const backend = memoryStorage({ "publicApi.best.reef": "7", "publicApi.hints": '{"v":1,"value":false}' });
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), maxFrameDelta: 0.1, plugins: [storage({ backend }), motion()] });
    expect(game.resources.has(Settings)).toBe(false);
    persistResource(game, Settings, "hints", Hints);
    expect(game.resources.get(Settings).hints).toBe(false);
    expect(getStored(game, Best("reef"))).toBe(7);
    expect(backend.items.get("publicApi.best.reef")).toBe("7");
    setStored(game, Best("reef"), 6);
    expect(backend.items.get("publicApi.best.reef")).toBe('{"v":2,"value":6}');
    game.addSystem(Schedule.PreUpdate, function pause({ resources }) {
      resources.get(MotionSettings).pausedAll = true;
    }, { before: "fenrir.motion.preUpdate" });
    await game.start();
    game.resources.get(Settings).hints = true;
    game.step(0.1);
    expect(() => game.step(0.2)).toThrow(/0 to 0.1 s/);
    expect(backend.items.get("publicApi.hints")).toBe('{"v":1,"value":true}');
    expect(game.inspect().resources["fenrir.MotionSettings"]).toMatchObject({ pausedAll: true });
    await game.stop();
  });

  it("ships no skybox members on Scene: fenrir-ts/3d adds them (#66)", () => {
    const scene = new core.Scene("publicApi.scene");
    expect(["skybox", "setSkybox", "removeSkybox", "hasSkybox"].filter((member) => member in scene)).toEqual([]);
  });

  it("tells whether a game is running after run(), with isRunning (#65)", async () => {
    const { Schedule, createGame, NullLogger } = core;
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger() });
    expectTypeOf(game.isRunning).toEqualTypeOf<() => boolean>();
    game.addSystem(Schedule.Init, function quit({ stop }) {
      stop();
    });
    await game.run();
    expect(game.isRunning()).toBe(false);
    game.removeSystem("quit");
    await game.run();
    expect(game.isRunning()).toBe(true);
    await game.stop();
  });

  it("reads actions on ctx.input, driven by a test game's input and by keys on the canvas", async () => {
    const { Schedule, createGame, createTestGame, defineAction, NullLogger } = core;
    type Input = import("@/index").Input;
    type SystemCtx = import("@/index").SystemCtx;
    const Tap = defineAction("publicApi.input.tap", ["pointer.primary", "Space", "Enter"]);
    expectTypeOf<SystemCtx["input"]>().toEqualTypeOf<Input>();

    // The same system runs in a test game and in a real one.
    const taps: Array<{ x: number; y: number }> = [];
    function countTaps({ input }: SystemCtx): void {
      if (input.pressed(Tap)) taps.push({ x: input.pointer.x, y: input.pointer.y });
    }

    const test = await createTestGame({ seed: 1, logger: new NullLogger() });
    test.addSystem(Schedule.Update, countTaps);
    await test.start();
    test.input.pointerDown(120, 340);
    test.input.pointerUp();
    test.step(1 / 60, 2);
    test.input.press(Tap);
    test.step();
    expect(taps).toEqual([{ x: 120, y: 340 }, { x: 120, y: 340 }]);
    await test.stop();

    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const canvas = document.createElement("canvas");
    const game = await createGame({ canvas, logger: new NullLogger() });
    game.addSystem(Schedule.Update, countTaps);
    await game.run();
    game.pause();
    const space = new KeyboardEvent("keydown", { code: "Space", cancelable: true });
    canvas.dispatchEvent(space);
    game.step();
    expect([taps.length, space.defaultPrevented, canvas.tabIndex]).toEqual([3, true, 0]);
    await game.stop();
  });

  it("claims keys, runs gesture code, orders edges, consumes keys and reports focus and cancels", async () => {
    const { Schedule, createGame, createTestGame, defineAction, NullLogger } = core;
    type InputEdge = import("@/index").InputEdge;
    const FocusNext = defineAction("publicApi.input.focusNext", ["Tab"]);
    const Activate = defineAction("publicApi.input.activate", ["Enter", "pointer.primary"]);

    const test = await createTestGame({ seed: 1, logger: new NullLogger() });
    const seen: Array<{ edges: readonly InputEdge[]; focused: boolean; cancelled: boolean; activated: boolean }> = [];
    test
      .addSystem(Schedule.Update, function ui({ input }) {
        if (input.pressed(Activate)) input.consume(Activate);
      })
      .addSystem(Schedule.Update, function play({ input }) {
        seen.push({ edges: input.edges([FocusNext]), focused: input.focused, cancelled: input.pointer.cancelled, activated: input.pressed(Activate) });
      });
    const gestures: string[] = [];
    test.input.onGesture(() => void gestures.push("gesture"));
    test.input.onDown(FocusNext, () => true);
    await test.start();
    test.input.focus();
    expect(test.input.press(FocusNext)).toBe(true);
    test.input.release(FocusNext);
    test.input.press(Activate);
    test.step();
    test.input.pointerDown(1, 1);
    test.step();
    test.input.pointerCancel();
    test.step();
    expect(gestures).toHaveLength(3);
    expect(seen.map(({ edges, ...rest }) => ({ edges: edges.map((edge) => edge.kind), ...rest }))).toEqual([
      { edges: ["pressed", "released"], focused: true, cancelled: false, activated: false },
      { edges: [], focused: true, cancelled: false, activated: false },
      { edges: [], focused: true, cancelled: true, activated: false },
    ]);
    await test.stop();

    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const canvas = document.createElement("canvas");
    const game = await createGame({ canvas, logger: new NullLogger() });
    game.input.onDown(FocusNext, () => true);
    await game.run();
    const tab = new KeyboardEvent("keydown", { code: "Tab", cancelable: true });
    canvas.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    await game.stop();
  });

  it("delivers events to game.on and ctx.events.on listeners, each with its own lifetime", async () => {
    const { Schedule, createGame, defineEvent, NullLogger } = core;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const Scored = defineEvent<{ points: number }>("publicApi.scored");
    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger() });
    const forGame: number[] = [];
    const forRun: number[] = [];
    const off = game.on(Scored, ({ points }, ctx) => {
      expectTypeOf(points).toEqualTypeOf<number>();
      expectTypeOf(ctx).toEqualTypeOf<import("@/index").SystemCtx>();
      forGame.push(points);
    });
    let firstRun = true;
    game.addSystem(Schedule.Init, function listen({ events }) {
      if (firstRun) events.on(Scored, ({ points }) => void forRun.push(points));
      firstRun = false;
    });

    await game.run();
    game.events.send(Scored, { points: 1 });
    await game.stop();
    await game.run();
    game.events.send(Scored, { points: 2 });
    off();
    game.events.send(Scored, { points: 3 });
    await game.stop();

    expect(forGame).toEqual([1, 2]);
    expect(forRun).toEqual([1]);
    expectTypeOf<import("@/index").EventHandler<{ points: number }>>().toBeFunction();
  });

  it("gives each game its own typed resources on game and ctx", async () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { createGame, defineResource, Resources, Schedule, NullLogger } = core;
    const Round = defineResource("publicApi.Round", () => ({ meter: 0.5, score: 0 }));
    const Seed = defineResource<number>("publicApi.Seed");

    const logger = new NullLogger();
    const one = await createGame({ canvas: document.createElement("canvas"), logger });
    const two = await createGame({ canvas: document.createElement("canvas"), logger });
    one.resources.set(Seed, 9);

    let seed: number | undefined;
    one.addSystem(Schedule.Init, function score({ resources }) {
      resources.get(Round).score += 1;
      seed = resources.get(Seed);
    });
    await one.run();

    expect(one.resources).toBeInstanceOf(Resources);
    expect(seed).toBe(9);
    expect(one.resources.get(Round).score).toBe(1);
    expect(two.resources.get(Round).score).toBe(0);
    expect(() => two.resources.get(Seed)).toThrow('Resource "publicApi.Seed" has no value');
    expectTypeOf(one.resources.get(Round)).toEqualTypeOf<{ meter: number; score: number }>();
    // @ts-expect-error a resource of number rejects a string
    one.resources.set(Seed, "nine");
    await one.stop();
  });

  it("runs a state machine with enter and exit hooks and inState", async () => {
    const { createGame, defineState, inState, NullLogger, Schedule } = core;
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((frame = next), 1)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const Phase = defineState("publicApi.Phase", { values: ["idle", "casting"], initial: "idle" });
    expectTypeOf(Phase).toEqualTypeOf<import("@/index").StateType<"idle" | "casting">>();

    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger() });
    const log: string[] = [];
    game
      .onEnter(Phase, "idle", () => log.push("enter idle"))
      .onExit(Phase, "idle", () => log.push("exit idle"))
      .onEnter(Phase, "casting", ({ states }) => log.push(`enter casting, timeIn ${typeof states.timeIn(Phase)}`));
    game.addSystem(Schedule.Update, function cast({ states }) {
      expectTypeOf(states.get(Phase)).toEqualTypeOf<"idle" | "casting">();
      states.set(Phase, "casting");
    }, { runIf: inState(Phase, "idle") });
    game.addSystem(Schedule.Update, function meter() { log.push("meter"); }, { runIf: inState(Phase, "casting") });

    await game.run();
    frame!(0);
    expect(log).toEqual(["enter idle", "exit idle", "enter casting, timeIn number", "meter"]);
    expect(game.states.get(Phase)).toBe("casting");
    await game.stop();
  });

  it("inspects a game as JSON and exposes it on window.__FENRIR__ with inspector({ global: true })", async () => {
    const { createGame, defineComponent, defineResource, inspector, NullLogger, Schedule } = core;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const Score = defineResource("publicApi.inspect.Score", () => new Map([["ana", 3]]));
    const Speed = defineComponent<{ value: number }>("publicApi.inspect.Speed");

    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger(), plugins: [inspector({ global: true })] });
    game.addSystem(Schedule.Init, function spawn({ entities, resources }) {
      entities.set(entities.createEntity(), Speed, { value: 2 });
      resources.get(Score);
    });
    await game.run();

    const snapshot = game.inspect();
    expectTypeOf(snapshot).toEqualTypeOf<import("@/index").GameSnapshot>();
    expectTypeOf(snapshot.resources).toEqualTypeOf<Readonly<Record<string, import("@/index").JsonValue>>>();
    expect(snapshot).toMatchObject({
      frame: 0,
      schedule: { init: ["spawn"] },
      resources: { "publicApi.inspect.Score": { $type: "Map", entries: [["ana", 3]] } },
      entities: [{ id: 0, name: "Entity 0", parent: null, components: { "publicApi.inspect.Speed": { value: 2 } } }],
    });
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect((window as { __FENRIR__?: { inspect(): unknown } }).__FENRIR__!.inspect()).toEqual(snapshot);
    await game.stop();
    delete (window as { __FENRIR__?: unknown }).__FENRIR__;
  });

  it("throws from inspect() on a game without inspector(), naming the plugin", async () => {
    const { createGame, NullLogger } = core;
    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger() });
    expect(() => game.inspect()).toThrow(/inspector\(\)/);
  });
});

describe("fenrir-ts time and random", () => {
  it("seeds ctx.random from createGame and reads time through an injectable clock", async () => {
    const { createGame, Engine, EventBus, NullLogger, Random, SceneManager, Schedule, Scheduler } = core;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger(), seed: 3 });
    expectTypeOf(game.random).toEqualTypeOf<import("@/index").Random>();
    const reference = new Random(3);
    const seen: { roll: number; pick: "a" | "b"; now: number; fixedDelta: number }[] = [];
    game.addSystem(Schedule.Init, ({ random, time }) => {
      const roll = random.int(1, 6);
      const pick = random.pick(["a", "b"] as const);
      expectTypeOf(pick).toEqualTypeOf<"a" | "b">();
      expectTypeOf(time.now()).toEqualTypeOf<number>();
      seen.push({ roll, pick, now: time.now(), fixedDelta: time.fixedDelta });
    }, { name: "test.draw" });
    await game.run();
    await game.stop();
    expect(seen[0]?.roll).toBe(reference.int(1, 6));
    expect(seen[0]?.pick).toBe(reference.pick(["a", "b"]));
    expect(seen[0]?.fixedDelta).toBe(1 / 60);

    // A Clock is two readings; an object literal is enough to control both.
    let ms = 0;
    const clock: import("@/index").Clock = { monotonic: () => ms, now: () => 1_000 + ms };
    const engine = new Engine({ scheduler: new Scheduler(), sceneManager: new SceneManager(), events: new EventBus(), clock });
    const time = engine.getTime();
    ms = 40;
    time.update();
    expect(time.delta).toBe(0.04);
    expect(time.now()).toBe(1_040);
    expect(core).not.toHaveProperty("ManualClock");
  });
});

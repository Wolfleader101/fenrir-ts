import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import { createTestGame } from "@/core/TestGame";
import type { Game, Plugin } from "@/core/Game";
import { AssetStore } from "@/core/Assets/AssetStore";
import { EventBus } from "@/core/EventBus";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { defineEvent } from "@/core/EventQueue";
import type { SystemCtx } from "@/core/SystemCtx";

/** Stubs the frame loop. `frame()` runs the scheduled animation frame. */
function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  const request = vi.fn((next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { callback = undefined; }));
  return {
    request,
    frame: () => {
      const next = callback;
      callback = undefined;
      next?.(performance.now());
    },
  };
}

const canvas = () => document.createElement("canvas");
const logger = new NullLogger();

/** A plugin that records into `log` and registers the systems it is given. */
function plugin(name: string, log: string[], install?: (game: Game) => void | Promise<void>): Plugin {
  return {
    name,
    async install(game) {
      log.push(`install ${name}`);
      await install?.(game);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createGame", () => {
  it("builds the game's services and gives them to systems", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    expect(game.assets).toBeInstanceOf(AssetStore);
    expect(game.events).toBeInstanceOf(EventBus);
    expect(game.logger).toBe(logger);

    let seen: SystemCtx | undefined;
    game.addSystem(Schedule.Init, function capture(ctx) { seen = ctx; });
    await game.run();
    expect(seen?.events).toBe(game.events);
    expect(seen?.logger).toBe(logger);
    expect(seen?.entities).toBeDefined();
    await game.stop();
  });

  it("defaults the logger to a ConsoleLogger", async () => {
    const game = await createGame({ canvas: canvas() });
    expect(game.logger.constructor.name).toBe("ConsoleLogger");
  });

  it("rejects without a canvas, saying what to pass", async () => {
    // @ts-expect-error canvas is required
    await expect(createGame({})).rejects.toThrow("createGame needs { canvas }");
  });

  it("returns a chainable addSystem, removeSystem and replaceSystem", async () => {
    const game = await createGame({ canvas: canvas(), logger });
    function a() {}
    expect(game.addSystem(Schedule.Update, a)).toBe(game);
    expect(game.replaceSystem("a", () => {})).toBe(game);
    expect(game.removeSystem("a")).toBe(game);
  });
});

describe("plugins", () => {
  it("installs plugins in order before createGame resolves, awaiting async installs", async () => {
    const log: string[] = [];
    let release!: () => void;
    const slow = plugin("test.slow", log, async () => {
      await new Promise<void>((resolve) => { release = resolve; });
      log.push("slow done");
    });
    const creating = createGame({ canvas: canvas(), logger, plugins: [plugin("test.first", log), slow, plugin("test.last", log)] });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(log).toEqual(["install test.first", "install test.slow"]);
    release();
    await creating;
    expect(log).toEqual(["install test.first", "install test.slow", "slow done", "install test.last"]);
  });

  it("gives install the canvas, logger, asset store and system registration", async () => {
    stubFrames();
    const target = canvas();
    const ran: string[] = [];
    let seen: { canvas?: HTMLCanvasElement; assets?: unknown; logger?: unknown } = {};
    const game = await createGame({
      canvas: target,
      logger,
      plugins: [{
        name: "test.renderer",
        install(game) {
          seen = { canvas: game.canvas, assets: game.assets, logger: game.logger };
          game.addSystem(Schedule.Init, () => { ran.push("init"); }, { name: "test.renderer.init" });
        },
      }],
    });
    expect(seen).toEqual({ canvas: target, assets: game.assets, logger });
    await game.run();
    expect(ran).toEqual(["init"]);
    await game.stop();
  });

  it("orders plugin systems before game systems in a stage, unless before or after says otherwise", async () => {
    stubFrames();
    const ran: string[] = [];
    const game = await createGame({
      canvas: canvas(),
      logger,
      plugins: [plugin("test.p", [], (g) => { g.addSystem(Schedule.Init, () => { ran.push("plugin"); }, { name: "test.p.init" }); })],
    });
    game.addSystem(Schedule.Init, () => { ran.push("game"); }, { name: "game" });
    game.addSystem(Schedule.Init, () => { ran.push("first"); }, { name: "first", before: "test.p.init" });
    await game.run();
    expect(ran).toEqual(["first", "plugin", "game"]);
    await game.stop();
  });

  it("rejects with the install error, installs no later plugin and leaves nothing running", async () => {
    const { request } = stubFrames();
    const log: string[] = [];
    const error = new Error("no WebGL");
    const init = vi.fn();
    const creating = createGame({
      canvas: canvas(),
      logger,
      plugins: [
        plugin("test.ok", log, (g) => { g.addSystem(Schedule.Init, init, { name: "test.ok.init" }); }),
        plugin("test.broken", log, () => { throw error; }),
        plugin("test.never", log),
      ],
    });
    await expect(creating).rejects.toBe(error);
    expect(log).toEqual(["install test.ok", "install test.broken"]);
    expect(init).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("rejects an async install that rejects", async () => {
    const error = new Error("wasm failed");
    await expect(createGame({ canvas: canvas(), logger, plugins: [plugin("test.async", [], async () => { throw error; })] })).rejects.toBe(error);
  });

  it("rejects a plugin listed twice", async () => {
    const p = plugin("test.twice", []);
    await expect(createGame({ canvas: canvas(), logger, plugins: [p, p] })).rejects.toThrow('Plugin "test.twice" is listed twice');
  });

  it("rolls back startup when a plugin's init system throws: exit and cleanups run once and the run rejects", async () => {
    const { request } = stubFrames();
    const error = new Error("renderer init failed");
    const exit = vi.fn();
    const cleanup = vi.fn();
    const later = vi.fn();
    const game = await createGame({
      canvas: canvas(),
      logger,
      plugins: [plugin("test.renderer", [], (g) => {
        g.addSystem(Schedule.PreInit, ({ onCleanup }) => { onCleanup(cleanup); }, { name: "test.renderer.preInit" })
          .addSystem(Schedule.Init, () => { throw error; }, { name: "test.renderer.init" })
          .addSystem(Schedule.Exit, exit, { name: "test.renderer.exit" });
      })],
    });
    game.addSystem(Schedule.Init, later, { name: "later" });

    await expect(game.run()).rejects.toBe(error);
    expect(later).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    await game.stop();
    expect(exit).toHaveBeenCalledOnce();
  });
});

describe("Game lifecycle", () => {
  it("rejects run when ordering cannot be resolved, before any system runs", async () => {
    const { request } = stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    const init = vi.fn();
    game.addSystem(Schedule.Init, init, { name: "init", after: "missing" });
    await expect(game.run()).rejects.toThrow(/"init" in stage "init" runs after "missing"/);
    expect(init).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
    game.removeSystem("init");
    await expect(game.run()).resolves.toBeUndefined();
    await game.stop();
  });

  it("runs startup stages in order, then resolves when the first frame is scheduled", async () => {
    const { request } = stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    const order: string[] = [];
    for (const stage of [Schedule.PostInit, Schedule.Init, Schedule.PreInit] as const) {
      game.addSystem(stage, async () => { order.push(stage); }, { name: `test.${stage}` });
    }
    await game.run();
    expect(order).toEqual(["preInit", "init", "postInit"]);
    expect(request).toHaveBeenCalledOnce();
    await game.stop();
  });

  it("waits for pending startup on stop, skips later systems, then allows restart", async () => {
    const { request } = stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    let complete!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    const later = vi.fn();
    const clean = vi.fn();
    game.addSystem(Schedule.Init, async ({ signal, onCleanup }) => {
      entered();
      await pending;
      if (signal.aborted) onCleanup(clean);
    }, { name: "slow" });
    game.addSystem(Schedule.Init, later, { name: "later" });

    const starting = game.run();
    await started;
    const stopping = game.stop();
    complete();
    await Promise.all([starting, stopping]);
    expect(later).not.toHaveBeenCalled();
    expect(clean).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();

    await game.run();
    expect(later).toHaveBeenCalledOnce();
    await game.stop();
  });

  it("runs frames, pauses, resumes, and stops a paused game once", async () => {
    const { frame, request } = stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    const update = vi.fn();
    const exit = vi.fn();
    game.addSystem(Schedule.Update, update, { name: "update" }).addSystem(Schedule.Exit, exit, { name: "exit" });
    await game.run();
    frame();
    expect(update).toHaveBeenCalledOnce();

    game.pause();
    frame();
    expect(update).toHaveBeenCalledOnce();
    game.resume();
    frame();
    expect(update).toHaveBeenCalledTimes(2);

    game.pause();
    await Promise.all([game.stop(), game.stop()]);
    expect(exit).toHaveBeenCalledOnce();
    game.resume();
    const scheduled = request.mock.calls.length;
    frame();
    expect(request.mock.calls.length).toBe(scheduled);
  });

  it("aborts the signal and runs cleanups in reverse after exit systems on stop", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const order: string[] = [];
    let signal: AbortSignal | undefined;
    game.addSystem(Schedule.Init, (ctx) => {
      signal = ctx.signal;
      ctx.onCleanup(() => { order.push("cleanup 1"); });
      ctx.onCleanup(() => { order.push("cleanup 2"); });
    }, { name: "init" });
    game.addSystem(Schedule.Exit, () => { order.push("exit"); }, { name: "exit" });
    await game.start();
    expect(signal?.aborted).toBe(false);
    await game.stop();
    expect(signal?.aborted).toBe(true);
    expect(order).toEqual(["exit", "cleanup 2", "cleanup 1"]);
  });

  it("stops when a frame throws, and clears buffered events", async () => {
    const { frame } = stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    const Hit = defineEvent<number>("test.game.hit");
    const exit = vi.fn();
    game.addSystem(Schedule.Update, ({ events }) => {
      events.send(Hit, 1);
      throw new Error("frame failed");
    }, { name: "explode" });
    game.addSystem(Schedule.Exit, exit, { name: "exit" });
    await game.run();
    expect(() => frame()).toThrow("frame failed");
    await vi.waitFor(() => expect(exit).toHaveBeenCalledOnce());
    expect(game.events.read(Hit)).toEqual([]);
  });

  it("evaluates runIf each frame", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let on = false;
    const update = vi.fn();
    game.addSystem(Schedule.Update, update, { name: "gated", runIf: () => on });
    await game.start();
    game.step();
    on = true;
    game.step(1 / 60, 2);
    expect(update).toHaveBeenCalledTimes(2);
    await game.stop();
  });

  it("replaces and removes systems while running, from the next frame", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const ran: string[] = [];
    game.addSystem(Schedule.PreUpdate, function hotReload() {
      if (ran.length === 0) {
        game.replaceSystem("applyDamage", () => { ran.push("applyDamage v2"); });
        game.removeSystem("render");
      }
    });
    game.addSystem(Schedule.Update, function applyDamage() { ran.push("applyDamage"); }, { after: "movePlayer" });
    game.addSystem(Schedule.Update, function movePlayer() { ran.push("movePlayer"); });
    game.addSystem(Schedule.PostUpdate, function render() { ran.push("render"); });
    await game.start();

    game.step();
    expect(ran).toEqual(["movePlayer", "applyDamage", "render"]);
    game.step();
    expect(ran).toEqual(["movePlayer", "applyDamage", "render", "movePlayer", "applyDamage v2"]);
    await game.stop();
  });

  it("adds a system from an Init system so it runs from the next startup stage", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const postInit = vi.fn();
    game.addSystem(Schedule.Init, function addMore() {
      game.addSystem(Schedule.PostInit, postInit, { name: "added" });
    });
    await game.start();
    expect(postInit).toHaveBeenCalledOnce();
    await game.stop();
  });
});

describe("game.isRunning", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is true from the end of startup until stop, paused included", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    const duringStartup: boolean[] = [];
    game.addSystem(Schedule.Init, function look() {
      duringStartup.push(game.isRunning());
    });
    expect(game.isRunning()).toBe(false);
    await game.run();
    expect(game.isRunning()).toBe(true);
    game.pause();
    expect(game.isRunning()).toBe(true);
    game.resume();
    const stopping = game.stop();
    expect(game.isRunning()).toBe(false);
    await stopping;
    expect([game.isRunning(), duringStartup]).toEqual([false, [false]]);
  });

  it("is false after a run that was stopped during startup, though run() resolved (#65)", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    game.addSystem(Schedule.Init, function quit({ stop }: SystemCtx) {
      stop();
    });
    await expect(game.run()).resolves.toBeUndefined();
    expect(game.isRunning()).toBe(false);
  });

  it("is false after a startup that threw", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger });
    game.addSystem(Schedule.Init, function fail() {
      throw new Error("no assets");
    });
    await expect(game.run()).rejects.toThrow("no assets");
    expect(game.isRunning()).toBe(false);
  });

  it("is true for a test game between start and stop", async () => {
    const game = await createTestGame({ seed: 1, logger });
    expect(game.isRunning()).toBe(false);
    await game.start();
    game.step();
    expect(game.isRunning()).toBe(true);
    await game.stop();
    expect(game.isRunning()).toBe(false);
  });
});

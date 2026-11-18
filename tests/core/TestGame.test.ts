import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import type { Plugin } from "@/core/Game";
import { createTestGame } from "@/core/TestGame";
import { defineEvent } from "@/core/EventQueue";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { pixi2d } from "@/core/Renderer2D/pixi2d";

const logger = new NullLogger();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createTestGame", () => {
  it("runs the startup stages on start, with no requestAnimationFrame, and exit stages on stop", async () => {
    const raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    const game = await createTestGame({ seed: 1, logger });
    const order: string[] = [];
    for (const stage of [Schedule.PreInit, Schedule.Init, Schedule.PostInit, Schedule.Exit] as const) {
      game.addSystem(stage, async () => { order.push(stage); }, { name: `test.${stage}` });
    }
    game.addSystem(Schedule.Init, ({ onCleanup }) => onCleanup(() => { order.push("cleanup"); }), { name: "test.cleanup" });

    await game.start();
    expect(order).toEqual(["preInit", "init", "postInit"]);
    await game.stop();
    expect(order).toEqual(["preInit", "init", "postInit", "exit", "cleanup"]);
    expect(raf).not.toHaveBeenCalled();
  });

  it("rolls back a failed start as run() does: exit and cleanups run, start rejects, and step then throws", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const error = new Error("init failed");
    const exit = vi.fn();
    const cleanup = vi.fn();
    game
      .addSystem(Schedule.PreInit, ({ onCleanup }) => onCleanup(cleanup), { name: "test.preInit" })
      .addSystem(Schedule.Init, () => { throw error; }, { name: "test.init" })
      .addSystem(Schedule.Exit, exit, { name: "test.exit" });

    await expect(game.start()).rejects.toBe(error);
    expect(exit).toHaveBeenCalledOnce();
    expect(cleanup).toHaveBeenCalledOnce();
    expect(() => game.step()).toThrow("Await start() first");
  });

  it("needs a seed, saying what to pass", async () => {
    // @ts-expect-error seed is required
    await expect(createTestGame({})).rejects.toThrow("createTestGame needs { seed }");
  });

  it("installs plugins that do not need a canvas, and names the canvas when one reads it", async () => {
    const ran = vi.fn();
    const scoring: Plugin = {
      name: "test.scoring",
      install(game) { game.addSystem(Schedule.Update, ran, { name: "test.scoring.update" }); },
    };
    const game = await createTestGame({ seed: 1, logger, plugins: [scoring] });
    await game.start();
    game.step();
    expect(ran).toHaveBeenCalledOnce();
    await game.stop();

    await expect(createTestGame({ seed: 1, logger, plugins: [pixi2d()] }))
      .rejects.toThrow("A test game has no canvas, so a plugin that draws, such as pixi2d, cannot install in createTestGame");
  });

  it("rejects a plugin listed twice, naming createTestGame", async () => {
    const p: Plugin = { name: "test.twice", install() {} };
    await expect(createTestGame({ seed: 1, logger, plugins: [p, p] })).rejects.toThrow("listed twice in createTestGame's plugins");
  });
});

describe("TestGame.step", () => {
  it("runs whole frames in stage order and advances the event buffers once a frame", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const Ping = defineEvent<number>("test.testGame.ping");
    const ran: string[] = [];
    game
      .addSystem(Schedule.PreUpdate, () => { ran.push("preUpdate"); }, { name: "a" })
      .addSystem(Schedule.Tick, () => { ran.push("tick"); }, { name: "b" })
      .addSystem(Schedule.Update, ({ events }) => { ran.push("update"); events.send(Ping, 1); }, { name: "c" })
      .addSystem(Schedule.PostUpdate, () => { ran.push("postUpdate"); }, { name: "d" });
    await game.start();

    game.step(1 / 60);
    expect(ran).toEqual(["preUpdate", "tick", "update", "postUpdate"]);
    game.step(1 / 60, 2);
    expect(ran).toHaveLength(12);
    // The buffers advanced at the end of each frame, so only the last frame's ping is retained.
    expect(game.events.read(Ping)).toEqual([1]);
    await game.stop();
  });

  it("accumulates fixed ticks from dt exactly: one per 1/60 step, one per two 1/120 steps, two per 1/30", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let ticks = 0;
    game.addSystem(Schedule.Tick, function count() { ticks++; });
    await game.start();

    game.step(1 / 60, 600);
    expect(ticks).toBe(600);
    game.step(1 / 120, 600);
    expect(ticks).toBe(900);
    game.step(1 / 30, 30);
    expect(ticks).toBe(960);
    await game.stop();
  });

  it("follows the fixedDelta a system sets, and runs Update with no tick for step(0)", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let ticks = 0;
    let updates = 0;
    game
      .addSystem(Schedule.Init, function slowTicks({ time }) { time.fixedDelta = 1 / 20; })
      .addSystem(Schedule.Tick, function count() { ticks++; })
      .addSystem(Schedule.Update, function update() { updates++; });
    await game.start();
    game.step(1 / 60, 60);
    expect(ticks).toBe(20);
    game.step(0);
    expect([ticks, updates]).toEqual([20, 61]);
    await game.stop();
  });

  it("bounds catch-up as the browser loop does: at most 8 ticks a frame, the rest dropped", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let ticks = 0;
    let accumulator = -1;
    game
      .addSystem(Schedule.Tick, function count() { ticks++; })
      .addSystem(Schedule.Update, function read({ time }) { accumulator = time.accumulator; });
    await game.start();
    // 0.25 s owes 15 ticks of 1/60.
    game.step(0.25);
    expect(ticks).toBe(8);
    expect(accumulator).toBeLessThan(1 / 60);
    await game.stop();
  });

  it("throws for a dt longer than the frame-delta clamp, saying how many frames to step instead", async () => {
    const game = await createTestGame({ seed: 1, logger });
    await game.start();
    expect(() => game.step(1)).toThrow("step(dt) runs one frame of 0 to 0.25 s (the frame-delta clamp), got 1. To advance 1 s, step more frames: step(1 / 60, 60).");
    expect(() => game.step(-1)).toThrow("step(dt) runs one frame of 0 to 0.25 s (the frame-delta clamp), got -1.");
    expect(() => game.step(Number.NaN)).toThrow("got NaN");
    expect(() => game.step(1 / 60, 0)).toThrow("frames to be a whole number of at least 1");
    expect(() => game.step(1 / 60, 1.5)).toThrow("frames to be a whole number of at least 1");
    await game.stop();
  });

  it("throws before start and after stop, saying to start", async () => {
    const game = await createTestGame({ seed: 1, logger });
    expect(() => game.step()).toThrow("step(dt) needs a started game. Await start() first");
    await game.start();
    game.step();
    await game.stop();
    expect(() => game.step()).toThrow("Await start() first, and start() again after stop()");
    await game.start();
    game.step();
    await game.stop();
  });

  it("throws when a system calls step from inside a frame", async () => {
    const game = await createTestGame({ seed: 1, logger });
    game.addSystem(Schedule.Update, function nested() { game.step(); });
    await game.start();
    expect(() => game.step()).toThrow("called from inside a frame");
    await game.stop();
  });

  it("moves time.now() by dt on each step, and by clock.advance without a frame", async () => {
    const game = await createTestGame({ seed: 1, now: 1_700_000_000_000, logger });
    const seen: number[] = [];
    game.addSystem(Schedule.Update, function read({ time }) { seen.push(time.now()); });
    await game.start();

    game.step(0.25, 2);
    expect(seen).toEqual([1_700_000_000_250, 1_700_000_000_500]);
    game.clock.advance(5_000);
    expect(seen).toHaveLength(2);
    game.step(0.25);
    expect(seen.at(-1)).toBe(1_700_000_005_750);
    await game.stop();
  });

  it("counts stepped time, not clock.advance, in time.elapsed and states.timeIn", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let elapsed = -1;
    let delta = -1;
    game.addSystem(Schedule.Update, function read({ time }) { elapsed = time.elapsed; delta = time.delta; });
    await game.start();
    game.step(1 / 60, 90);
    game.clock.advance(60_000);
    game.step(1 / 60, 30);
    expect(elapsed).toBeCloseTo(2, 9);
    expect(delta).toBe(1 / 60);
    await game.stop();
  });

  it("skips the remaining frames once a system stops the game", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let frames = 0;
    const exit = vi.fn();
    game
      .addSystem(Schedule.Update, function quitAtTen({ stop }) { if (++frames === 10) stop(); })
      .addSystem(Schedule.Exit, exit, { name: "exit" });
    await game.start();
    game.step(1 / 60, 100);
    expect(frames).toBe(10);
    await game.stop();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("stops the game and throws from step when a system throws", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const exit = vi.fn();
    game
      .addSystem(Schedule.Update, function explode() { throw new Error("frame failed"); })
      .addSystem(Schedule.Exit, exit, { name: "exit" });
    await game.start();
    expect(() => game.step()).toThrow("frame failed");
    await game.stop();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("never reads performance.now, Date.now or requestAnimationFrame across a start, 100 steps and a stop", async () => {
    const perf = vi.spyOn(performance, "now");
    const date = vi.spyOn(Date, "now");
    const raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);

    const game = await createTestGame({ seed: 3, now: 1_000 });
    const Rolled = defineEvent<number>("test.testGame.rolled");
    game.on(Rolled, () => {});
    game
      .addSystem(Schedule.Init, function seedWorld({ entities }) { entities.createEntity(); })
      .addSystem(Schedule.Tick, function roll({ random, events }) { events.send(Rolled, random.int(1, 6)); })
      .addSystem(Schedule.Update, function read({ time }) { void time.now(); void time.elapsed; });
    await game.start();
    game.step(1 / 60, 100);
    await game.stop();

    expect(perf).not.toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
  });
});

describe("Game.step", () => {
  /** Stubs the browser loop. `frame()` runs the scheduled animation frame. */
  function stubFrames() {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { callback = undefined; }));
    return () => { const next = callback; callback = undefined; next?.(0); };
  }

  it("throws before run and while running, saying to pause first", async () => {
    stubFrames();
    const game = await createGame({ canvas: document.createElement("canvas"), logger });
    expect(() => game.step()).toThrow("step(dt) runs only while the game is paused. Await run(), then pause()");
    await game.run();
    expect(() => game.step()).toThrow("step(dt) runs only while the game is paused. Call pause() first");
    await game.stop();
  });

  it("advances a paused game by dt whatever the real time, rendering each frame, and resumes cleanly", async () => {
    const frame = stubFrames();
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    const game = await createGame({ canvas: document.createElement("canvas"), logger });
    let ticks = 0;
    let renders = 0;
    let elapsed = -1;
    game
      .addSystem(Schedule.Tick, function count() { ticks++; })
      .addSystem(Schedule.Update, function read({ time }) { elapsed = time.elapsed; })
      .addSystem(Schedule.PostUpdate, function render() { renders++; });
    await game.run();
    game.pause();

    // Real time does not move, yet each step is a full frame of dt.
    game.step(1 / 60, 30);
    expect([ticks, renders]).toEqual([30, 30]);
    expect(elapsed).toBeCloseTo(0.5, 9);

    // A long real pause shows up neither in step nor in the first frame after resume.
    now.mockReturnValue(61_000);
    game.step(1 / 60);
    game.resume();
    now.mockReturnValue(61_020);
    frame();
    expect([ticks, renders]).toEqual([32, 32]);
    expect(elapsed).toBeCloseTo(31 / 60 + 0.02, 6);
    await game.stop();
  });
});

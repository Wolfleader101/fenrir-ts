import { afterEach, describe, expect, it, vi } from "vitest";
import { Engine } from "../../src/core/Engine";
import { EventBus } from "../../src/core/EventBus";
import { SceneManager } from "../../src/core/SceneManager";
import { Schedule, Scheduler } from "../../src/core/Scheduler";
import type { EngineOptions } from "../../src/core/Engine";

function setup(options: Pick<EngineOptions, "maxFrameDelta" | "maxTicksPerFrame"> = {}) {
  let callback: FrameRequestCallback | undefined;
  const request = vi.fn((next: FrameRequestCallback) => {
    callback = next;
    return 1;
  });
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const engine = new Engine({
    ...options, scheduler: new Scheduler(), events: new EventBus(), sceneManager: new SceneManager(),
  });
  return { engine, request, frame: () => callback!(0) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("run lifetime", () => {
  it("rolls back failed startup once, retaining the startup failure when cleanup fails", async () => {
    const { engine, request } = setup();
    const clean = vi.fn();
    const exit = vi.fn();
    const error = new Error("asset init failed");
    engine.addSystem(Schedule.PreInit, ({ onCleanup }) => {
      onCleanup(clean);
      onCleanup(() => { throw new Error("cleanup failed"); });
    }, { name: "test.registerCleanups" });
    engine.addSystem(Schedule.Init, () => { throw error; }, { name: "test.failInit" });
    engine.addSystem(Schedule.Exit, exit);

    await expect(engine.run()).rejects.toBe(error);
    expect(engine.isRunning()).toBe(false);
    expect(request).not.toHaveBeenCalled();
    await engine.stop();
    expect(exit).toHaveBeenCalledTimes(1);
    expect(clean).toHaveBeenCalledTimes(1);
  });

  it("waits for pending startup, skips later systems, then allows restart", async () => {
    const { engine, request } = setup();
    let complete!: () => void;
    let entered!: () => void;
    const started = new Promise<void>((resolve) => { entered = resolve; });
    const pending = new Promise<void>((resolve) => { complete = resolve; });
    const later = vi.fn();
    const clean = vi.fn();
    engine.addSystem(Schedule.Init, async ({ signal, onCleanup }) => {
      entered();
      await pending;
      if (signal.aborted) onCleanup(clean);
    }, { name: "test.slowInit" });
    engine.addSystem(Schedule.Init, later);

    const starting = engine.run();
    await started;
    const stopping = engine.stop();
    complete();
    await Promise.all([starting, stopping]);
    expect(later).not.toHaveBeenCalled();
    expect(clean).toHaveBeenCalledTimes(1);
    expect(request).not.toHaveBeenCalled();
    await engine.run();
    expect(later).toHaveBeenCalledTimes(1);
    await engine.stop();
  });

  it("stops a paused run and only tears down once", async () => {
    const { engine } = setup();
    const exit = vi.fn();
    engine.addSystem(Schedule.Exit, exit);
    await engine.run();
    engine.pause();
    await Promise.all([engine.stop(), engine.stop()]);
    expect(exit).toHaveBeenCalledTimes(1);
    engine.resume();
    expect(engine.isRunning()).toBe(false);
  });
});

describe("frame timing", () => {
  it("excludes startup, caps long frames and retains a fractional tick", async () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const { engine, frame } = setup({ maxFrameDelta: 0.125, maxTicksPerFrame: 2 });
    engine.getTime().tickRate = 0.02;
    const fixedSteps: number[] = [];
    engine.addSystem(Schedule.PostInit, async () => { now = 3_000; }, { name: "test.slowStartup" });
    engine.addSystem(Schedule.Tick, ({ time }) => { fixedSteps.push(time.fixedDeltaTime); }, { name: "test.recordStep" });

    await engine.run();
    frame();
    expect(engine.getTime().deltaTime).toBe(0);
    expect(fixedSteps).toEqual([]);
    now += 3_000;
    frame();
    expect(engine.getTime().deltaTime).toBe(0.125);
    expect(fixedSteps).toEqual([0.02, 0.02]);
    expect(engine.getTime().accumulator).toBeCloseTo(0.005);
    await engine.stop();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Engine } from "@/core/Engine";
import { EventBus } from "@/core/EventBus";
import { SceneManager } from "@/core/SceneManager";
import { Schedule, Scheduler } from "@/core/Scheduler";
import { LiveEngineController } from "@/editor/LiveEngineController";

function setup() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const scheduler = new Scheduler();
  const engine = new Engine({ scheduler, sceneManager: new SceneManager(), events: new EventBus() });
  return { engine, scheduler, controller: new LiveEngineController(engine), frame: () => callback?.(performance.now()) };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LiveEngineController hot reload", () => {
  it("replaces the user's update by name, so the old closure stops running", async () => {
    const { controller, frame } = setup();
    const printed: string[] = [];
    await controller.start({ update: () => { printed.push("test"); } });
    frame();
    expect(controller.hotReload({ update: () => { printed.push("hello"); } })).toEqual({ success: true });
    frame();
    frame();
    expect(printed).toEqual(["test", "hello", "hello"]);
  });

  it("adds a stage the new script defines and removes one it drops", async () => {
    const { controller, scheduler, frame } = setup();
    const ran: string[] = [];
    await controller.start({ update: () => { ran.push("update"); } });
    controller.hotReload({ tick: () => { ran.push("tick"); } });
    expect(scheduler.getSchedule(Schedule.Update)).toEqual([]);
    expect(scheduler.getSchedule(Schedule.Tick).map((s) => s.name)).toEqual(["fenrir.editor.tick"]);
    frame();
    expect(ran).not.toContain("update");
  });

  it("registers the user's systems once across restarts", async () => {
    const { controller, scheduler } = setup();
    const script = { init: vi.fn(), update: vi.fn() };
    await controller.start(script);
    expect(await controller.restart(script)).toEqual({ success: true });
    expect(script.init).toHaveBeenCalledTimes(2);
    expect(scheduler.getSchedule(Schedule.Init).map((s) => s.name)).toEqual(["fenrir.editor.init"]);
    expect(scheduler.getSchedule(Schedule.Update).map((s) => s.name)).toEqual(["fenrir.editor.update"]);
  });
});

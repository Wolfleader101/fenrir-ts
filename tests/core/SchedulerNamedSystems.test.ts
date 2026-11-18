import { describe, expect, it, vi } from "vitest";
import { Schedule, Scheduler } from "@/core/Scheduler";
import type { SyncSystemFn, SystemCtx } from "@/core/SystemCtx";
import { createMockSystemCtx } from "../utils/testHelpers";

/** Systems that record their name when they run. */
function recorder() {
  const ran: string[] = [];
  const make = (name: string): SyncSystemFn => {
    const fn: SyncSystemFn = () => { ran.push(name); };
    Object.defineProperty(fn, "name", { value: name });
    return fn;
  };
  return { ran, make };
}

describe("system names", () => {
  it("defaults a system's name to its function name", () => {
    const scheduler = new Scheduler();
    function movePlayer() {}
    scheduler.addSystem(Schedule.Update, movePlayer);
    expect(scheduler.getSchedule(Schedule.Update).map((s) => s.name)).toEqual(["movePlayer"]);
  });

  it("uses the name option over the function name", () => {
    const scheduler = new Scheduler();
    function movePlayer() {}
    scheduler.addSystem(Schedule.Update, movePlayer, { name: "myGame.move" });
    expect(scheduler.getSchedule(Schedule.Update).map((s) => s.name)).toEqual(["myGame.move"]);
  });

  it("rejects an anonymous system with a message that says to pass name", () => {
    const scheduler = new Scheduler();
    expect(() => scheduler.addSystem(Schedule.Update, (() => () => {})())).toThrow(/anonymous system.*pass \{ name: /);
    expect(scheduler.getSystems(Schedule.Update)).toEqual([]);
  });

  it("rejects two systems with one name in a stage, but allows the name in another stage", () => {
    const scheduler = new Scheduler();
    function reset() {}
    function otherReset() {}
    scheduler.addSystem(Schedule.Update, reset);
    expect(() => scheduler.addSystem(Schedule.Update, otherReset, { name: "reset" })).toThrow(
      'Stage "update" already has a system named "reset". Pass a different { name } for one of them.',
    );
    expect(() => scheduler.addSystem(Schedule.Init, reset)).not.toThrow();
  });

  it("prints the schedule with system names", () => {
    const scheduler = new Scheduler();
    function spawn() {}
    function movePlayer() {}
    function applyDamage() {}
    scheduler.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, applyDamage, { after: "movePlayer" }).addSystem(Schedule.Update, movePlayer);
    expect(scheduler.describe()).toBe(
      ["preInit: ", "init: spawn", "postInit: ", "preUpdate: ", "tick: ", "update: movePlayer, applyDamage", "postUpdate: ", "exit: "].join("\n"),
    );
  });
});

describe("ordering", () => {
  it("keeps registration order without constraints", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler.addSystems(Schedule.Update, [make("a"), make("b"), make("c")]);
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["a", "b", "c"]);
  });

  it("moves a system after the one it names, keeping everything else in registration order", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler
      .addSystem(Schedule.Update, make("applyDamage"), { after: "movePlayer" })
      .addSystem(Schedule.Update, make("spawn"))
      .addSystem(Schedule.Update, make("movePlayer"))
      .addSystem(Schedule.Update, make("render"));
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["spawn", "movePlayer", "applyDamage", "render"]);
  });

  it("moves a system before the ones it names, accepting a list", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler
      .addSystem(Schedule.Update, make("a"))
      .addSystem(Schedule.Update, make("b"))
      .addSystem(Schedule.Update, make("readInput"), { before: ["a", "b"] });
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["readInput", "a", "b"]);
  });

  it("moves the constrained system, not its target, for before", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler
      .addSystem(Schedule.Update, make("fenrir.pixi.update"))
      .addSystem(Schedule.Update, make("game"))
      .addSystem(Schedule.Update, make("movePlayer"), { before: "fenrir.pixi.update" });
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["movePlayer", "fenrir.pixi.update", "game"]);
  });

  it("follows chains of before constraints", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler
      .addSystem(Schedule.Update, make("w"))
      .addSystem(Schedule.Update, make("z"))
      .addSystem(Schedule.Update, make("x"), { before: "y" })
      .addSystem(Schedule.Update, make("y"), { before: "z" });
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["w", "x", "y", "z"]);
  });

  it("resolves when a run begins, so a constraint may name a system registered later", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler.addSystem(Schedule.Update, make("b"), { after: "a" });
    scheduler.addSystem(Schedule.Update, make("a"));
    expect(() => scheduler.beginRun()).not.toThrow();
    expect(scheduler.getSchedule(Schedule.Update).map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("throws on an unknown name, naming both systems", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler.addSystem(Schedule.Update, make("applyDamage"), { after: "movePlayr" });
    expect(() => scheduler.beginRun()).toThrow(
      /System "applyDamage" in stage "update" runs after "movePlayr", but no system named "movePlayr" is registered/,
    );
  });

  it("only matches names in the same stage", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler.addSystem(Schedule.PreUpdate, make("movePlayer"));
    scheduler.addSystem(Schedule.Update, make("applyDamage"), { after: "movePlayer" });
    expect(() => scheduler.beginRun()).toThrow(/no system named "movePlayer" is registered in "update"/);
  });

  it("throws on a cycle, naming the systems in it", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler
      .addSystem(Schedule.Update, make("a"), { after: "b" })
      .addSystem(Schedule.Update, make("b"), { after: "a" })
      .addSystem(Schedule.Update, make("c"));
    expect(() => scheduler.beginRun()).toThrow(/Systems "[ab]" and "[ab]" in stage "update".*cycle: "[ab]" -> "[ab]" -> "[ab]"/);
  });

  it("throws on a cycle made of before and after together", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler
      .addSystem(Schedule.Tick, make("a"), { before: "b" })
      .addSystem(Schedule.Tick, make("b"), { before: "c" })
      .addSystem(Schedule.Tick, make("c"), { before: "a" });
    expect(() => scheduler.beginRun()).toThrow(/stage "tick" have before\/after constraints that form a cycle/);
  });

  it("does not re-resolve each frame", () => {
    const scheduler = new Scheduler();
    const { make } = recorder();
    scheduler.addSystem(Schedule.Update, make("a")).addSystem(Schedule.Update, make("b"), { after: "a" });
    scheduler.beginRun();
    const first = scheduler.current(Schedule.Update);
    scheduler.flush();
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(scheduler.current(Schedule.Update)).toBe(first);
  });
});

describe("runIf", () => {
  it("is evaluated each time the system would run, in sync stages", () => {
    const scheduler = new Scheduler();
    let enabled = false;
    const runIf = vi.fn((_ctx: SystemCtx) => enabled);
    const system = vi.fn();
    scheduler.addSystem(Schedule.Update, system, { name: "gated", runIf });
    const ctx = createMockSystemCtx();

    scheduler.runSyncStage(Schedule.Update, ctx);
    enabled = true;
    scheduler.runSyncStage(Schedule.Update, ctx);
    scheduler.runSyncStage(Schedule.Update, ctx);

    expect(runIf).toHaveBeenCalledTimes(3);
    expect(runIf).toHaveBeenCalledWith(ctx);
    expect(system).toHaveBeenCalledTimes(2);
  });

  it("applies to async stages", async () => {
    const scheduler = new Scheduler();
    const skipped = vi.fn();
    const kept = vi.fn();
    scheduler.addSystem(Schedule.Init, skipped, { name: "skipped", runIf: () => false });
    scheduler.addSystem(Schedule.Init, kept, { name: "kept", runIf: () => true });
    await scheduler.runAsyncStage(Schedule.Init, createMockSystemCtx());
    expect(skipped).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });
});

describe("replaceSystem and removeSystem", () => {
  it("replaces a system's function, keeping its position and options", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    const runIf = vi.fn(() => true);
    scheduler
      .addSystem(Schedule.Update, make("applyDamage"), { after: "movePlayer", runIf })
      .addSystem(Schedule.Update, make("movePlayer"))
      .addSystem(Schedule.Update, make("render"));
    scheduler.replaceSystem("applyDamage", make("applyDamageV2"));

    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["movePlayer", "applyDamageV2", "render"]);
    expect(runIf).toHaveBeenCalledOnce();
    expect(scheduler.getSchedule(Schedule.Update).map((s) => s.name)).toEqual(["movePlayer", "applyDamage", "render"]);
  });

  it("removes a system", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler.addSystems(Schedule.Update, [make("a"), make("b")]);
    scheduler.removeSystem("a");
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["b"]);
  });

  it("acts on the name in every stage that has it", () => {
    const scheduler = new Scheduler();
    function reset() {}
    scheduler.addSystem(Schedule.Init, reset).addSystem(Schedule.Exit, reset);
    const next = vi.fn();
    scheduler.replaceSystem("reset", next);
    expect(scheduler.getSystems(Schedule.Init)).toEqual([next]);
    expect(scheduler.getSystems(Schedule.Exit)).toEqual([next]);
    scheduler.removeSystem("reset");
    expect(scheduler.describe()).not.toContain("reset");
  });

  it("throws on an unknown name, listing the registered ones", () => {
    const scheduler = new Scheduler();
    function movePlayer() {}
    scheduler.addSystem(Schedule.Update, movePlayer);
    expect(() => scheduler.removeSystem("movePlayr")).toThrow('removeSystem: no system named "movePlayr" is registered. Registered systems: "movePlayer".');
    expect(() => scheduler.replaceSystem("movePlayr", movePlayer)).toThrow(/replaceSystem: no system named "movePlayr"/);
  });

  it("while running, applies changes at the next flush, not mid-frame", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    const ctx = createMockSystemCtx();
    scheduler.addSystems(Schedule.Update, [make("a"), make("b")]);
    scheduler.beginRun();

    // A system earlier in the frame removes "b" and replaces "a": this frame is unchanged.
    scheduler.removeSystem("b").replaceSystem("a", make("a2")).addSystem(Schedule.Update, make("c"));
    scheduler.runSyncStage(Schedule.Update, ctx);
    expect(ran).toEqual(["a", "b"]);

    scheduler.flush();
    scheduler.runSyncStage(Schedule.Update, ctx);
    expect(ran).toEqual(["a", "b", "a2", "c"]);
  });

  it("while running, a change that breaks ordering throws at the call and changes nothing", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler.addSystem(Schedule.Update, make("movePlayer")).addSystem(Schedule.Update, make("applyDamage"), { after: "movePlayer" });
    scheduler.beginRun();

    expect(() => scheduler.removeSystem("movePlayer")).toThrow(/"applyDamage" in stage "update" runs after "movePlayer"/);
    expect(() => scheduler.addSystem(Schedule.Update, make("x"), { before: "nothing" })).toThrow(/no system named "nothing"/);
    scheduler.flush();
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["movePlayer", "applyDamage"]);
  });

  it("after a run ends, changes apply at once and are checked when the next run begins", () => {
    const scheduler = new Scheduler();
    const { ran, make } = recorder();
    scheduler.addSystem(Schedule.Update, make("a"));
    scheduler.beginRun();
    scheduler.endRun();
    scheduler.addSystem(Schedule.Update, make("b"), { after: "later" });
    expect(() => scheduler.beginRun()).toThrow(/no system named "later"/);
    scheduler.addSystem(Schedule.Update, make("later"));
    scheduler.beginRun();
    scheduler.runSyncStage(Schedule.Update, createMockSystemCtx());
    expect(ran).toEqual(["a", "later", "b"]);
  });
});

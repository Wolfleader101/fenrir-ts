import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import type { Game } from "@/core/Game";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { defineState, inState } from "@/core/State";
import type { StateType } from "@/core/State";
import type { SystemCtx } from "@/core/SystemCtx";

const Phase = defineState("test.Phase", { values: ["idle", "casting", "waiting"], initial: "idle" });
const Light = defineState("test.Light", { values: ["red", "green"], initial: "red" });

/** Stubs the frame loop and the clock. `frame()` runs the scheduled frame; `now` is in ms. */
function stubLoop() {
  let callback: FrameRequestCallback | undefined;
  const clock = { now: 0 };
  vi.spyOn(performance, "now").mockImplementation(() => clock.now);
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn(() => { callback = undefined; }));
  return {
    clock,
    frame: () => {
      const next = callback;
      callback = undefined;
      if (!next) throw new Error("no frame scheduled");
      next(clock.now);
    },
  };
}

const newGame = () => createGame({ canvas: document.createElement("canvas"), logger: new NullLogger() });

/** A named system that logs `label` and what Phase is when it runs. */
const logs = (log: string[], label: string, body?: (ctx: SystemCtx) => void) => {
  const fn = (ctx: SystemCtx) => {
    log.push(`${label}:${ctx.states.get(Phase)}`);
    body?.(ctx);
  };
  Object.defineProperty(fn, "name", { value: label });
  return fn;
};

/** Registers enter and exit hooks for every Phase value that log into `log`. */
function hookAll(game: Game, log: string[]) {
  for (const value of Phase.values) {
    game.onEnter(Phase, value, () => log.push(`enter ${value}`));
    game.onExit(Phase, value, () => log.push(`exit ${value}`));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("defineState", () => {
  it("infers the union of its values without `as const`", () => {
    expectTypeOf(Phase).toEqualTypeOf<StateType<"idle" | "casting" | "waiting">>();
    expect(Phase).toEqual({ name: "test.Phase", values: ["idle", "casting", "waiting"], initial: "idle" });
    expect(Object.isFrozen(Phase)).toBe(true);
  });

  it("rejects an initial value that is not one of its values", () => {
    // @ts-expect-error "done" is not a value
    expect(() => defineState("test.Bad", { values: ["a", "b"], initial: "done" })).toThrow(
      'defineState("test.Bad") has initial "done", which is not one of its values: "a", "b".',
    );
  });

  it("rejects no values and repeated values", () => {
    expect(() => defineState("test.Empty", { values: [], initial: "x" as never })).toThrow("needs at least one value");
    expect(() => defineState("test.Twice", { values: ["a", "a"], initial: "a" })).toThrow('lists the value "a" twice');
  });
});

describe("states", () => {
  it("types get as the literal union and rejects unknown values in set, onEnter, onExit and inState", async () => {
    const game = await newGame();
    expectTypeOf(game.states.get(Phase)).toEqualTypeOf<"idle" | "casting" | "waiting">();
    expectTypeOf(game.states.timeIn(Phase)).toEqualTypeOf<number>();

    // @ts-expect-error "done" is not a Phase value
    expect(() => game.states.set(Phase, "done")).toThrow('states.set: state "test.Phase" has no value "done". Use one of "idle", "casting", "waiting".');
    // @ts-expect-error "done" is not a Phase value
    expect(() => game.onEnter(Phase, "done", () => {})).toThrow('onEnter: state "test.Phase" has no value "done"');
    // @ts-expect-error "done" is not a Phase value
    expect(() => game.onExit(Phase, "done", () => {})).toThrow('onExit: state "test.Phase" has no value "done"');
    // @ts-expect-error "done" is not a Phase value
    expect(() => inState(Phase, "casting", "done")).toThrow('inState: state "test.Phase" has no value "done"');
    // @ts-expect-error inState needs at least one value
    expect(() => inState(Phase)).toThrow("needs at least one value");
  });

  it("starts at the initial value and runs its enter hooks before the first PreInit system", async () => {
    stubLoop();
    const game = await newGame();
    const log: string[] = [];
    expect(game.states.get(Phase)).toBe("idle");
    hookAll(game, log);
    game.addSystem(Schedule.PreInit, logs(log, "preInit"));
    await game.run();
    expect(log).toEqual(["enter idle", "preInit:idle"]);
    await game.stop();
  });

  it("applies a set after the system returns: exit hooks, enter hooks, then the next system's runIf sees it", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game
      .addSystem(Schedule.Update, logs(log, "early"), { runIf: inState(Phase, "casting") })
      .addSystem(Schedule.Update, logs(log, "cast", ({ states }) => {
        if (states.get(Phase) !== "idle") return;
        states.set(Phase, "casting");
        // Queued: still idle until this system returns.
        log.push(`after set:${states.get(Phase)}`);
      }))
      .addSystem(Schedule.Update, logs(log, "late"), { runIf: inState(Phase, "casting") })
      .addSystem(Schedule.PostUpdate, logs(log, "post"), { runIf: inState(Phase, "casting", "waiting") });
    await game.run();
    log.length = 0;

    frame();
    expect(log).toEqual(["cast:idle", "after set:idle", "exit idle", "enter casting", "late:casting", "post:casting"]);
    log.length = 0;
    frame();
    expect(log).toEqual(["early:casting", "cast:casting", "late:casting", "post:casting"]);
    await game.stop();
  });

  it("applies a set made in an async startup system after it returns, before the next system", async () => {
    stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game
      .addSystem(Schedule.Init, async function load({ states }) {
        states.set(Phase, "waiting");
        await Promise.resolve();
        log.push(`load:${states.get(Phase)}`);
      })
      .addSystem(Schedule.Init, logs(log, "init"), { runIf: inState(Phase, "waiting") })
      .addSystem(Schedule.PostInit, logs(log, "postInit", ({ states }) => states.set(Phase, "casting")));
    await game.run();
    expect(log).toEqual([
      "enter idle", "load:idle", "exit idle", "enter waiting", "init:waiting",
      "postInit:waiting", "exit waiting", "enter casting",
    ]);
    await game.stop();
  });

  it("applies a set made in an Exit system after it returns", async () => {
    stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game
      .addSystem(Schedule.Exit, logs(log, "save", ({ states }) => states.set(Phase, "waiting")))
      .addSystem(Schedule.Exit, logs(log, "exit2"));
    await game.run();
    log.length = 0;
    await game.stop();
    expect(log).toEqual(["save:idle", "exit idle", "enter waiting", "exit2:waiting"]);
  });

  it("applies a set made in a hook when the transition that ran the hook finishes", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game.onEnter(Phase, "casting", function autoWait({ states }) {
      states.set(Phase, "waiting");
      log.push(`set in hook:${states.get(Phase)}`);
    });
    game.onEnter(Phase, "casting", () => log.push("second casting hook"));
    game
      .addSystem(Schedule.Update, logs(log, "cast", ({ states }) => states.set(Phase, "casting")), { runIf: inState(Phase, "idle") })
      .addSystem(Schedule.Update, logs(log, "next"));
    await game.run();
    log.length = 0;
    frame();
    expect(log).toEqual([
      "cast:idle", "exit idle", "enter casting", "set in hook:casting", "second casting hook",
      "exit casting", "enter waiting", "next:waiting",
    ]);
    await game.stop();
  });

  it("does nothing when set to the current value", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game.addSystem(Schedule.Update, function same({ states }) { states.set(Phase, "idle"); });
    await game.run();
    log.length = 0;
    frame();
    expect(log).toEqual([]);
    await game.stop();
  });

  it("applies only the last of several sets of one state in one system", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    let sets: Array<"idle" | "casting" | "waiting"> = ["casting", "waiting"];
    game.addSystem(Schedule.Update, function many({ states }) {
      for (const value of sets) states.set(Phase, value);
      sets = [];
    });
    await game.run();
    log.length = 0;
    frame();
    expect(log).toEqual(["exit idle", "enter waiting"]);

    // Away and back again in one system is no change at all.
    log.length = 0;
    sets = ["casting", "waiting"];
    frame();
    expect(log).toEqual([]);
    await game.stop();
  });

  it("applies sets of several states in the order each was first set", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    game.onEnter(Phase, "casting", () => log.push("Phase casting"));
    game.onEnter(Light, "green", () => log.push("Light green"));
    game.addSystem(Schedule.Update, function both({ states }) {
      states.set(Phase, "waiting");
      states.set(Light, "green");
      states.set(Phase, "casting");
    }, { runIf: inState(Light, "red") });
    await game.run();
    frame();
    expect(log).toEqual(["Phase casting", "Light green"]);
    await game.stop();
  });

  it("applies a set made outside a system at the start of the next frame, before the first system", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game.addSystem(Schedule.PreUpdate, logs(log, "first"));
    await game.run();
    log.length = 0;

    game.states.set(Phase, "casting");
    expect(game.states.get(Phase)).toBe("idle");
    frame();
    expect(log).toEqual(["exit idle", "enter casting", "first:casting"]);
    await game.stop();
  });

  it("applies a set made before run after the initial enter hooks", async () => {
    stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game.addSystem(Schedule.PreInit, logs(log, "preInit"));
    game.states.set(Phase, "waiting");
    expect(game.states.get(Phase)).toBe("idle");
    await game.run();
    expect(log).toEqual(["enter idle", "exit idle", "enter waiting", "preInit:waiting"]);
    await game.stop();
  });

  it("drops changes still queued when the game stops, runs no exit hooks, and restarts at the initial value", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const log: string[] = [];
    hookAll(game, log);
    game.addSystem(Schedule.Update, function cast({ states }) { states.set(Phase, "casting"); }, { runIf: inState(Phase, "idle") });
    await game.run();
    frame();
    expect(game.states.get(Phase)).toBe("casting");
    game.states.set(Phase, "waiting");
    log.length = 0;
    await game.stop();
    expect(log).toEqual([]);
    expect(game.states.get(Phase)).toBe("casting");

    await game.run();
    expect(log).toEqual(["enter idle"]);
    expect(game.states.get(Phase)).toBe("idle");
    await game.stop();
  });

  it("gives hooks the same ctx as systems", async () => {
    stubLoop();
    const game = await newGame();
    const seen: SystemCtx[] = [];
    game.onEnter(Phase, "idle", (ctx) => seen.push(ctx));
    game.addSystem(Schedule.Init, function capture(ctx) { seen.push(ctx); });
    await game.run();
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[0]!.states).toBe(game.states);
    await game.stop();
  });

  it("keeps each game's states apart", async () => {
    const { frame } = stubLoop();
    const one = await newGame();
    const two = await newGame();
    const entered = vi.fn();
    two.onEnter(Phase, "casting", entered);
    one.addSystem(Schedule.Update, function cast({ states }) { states.set(Phase, "casting"); });
    await one.run();
    frame();
    expect(one.states.get(Phase)).toBe("casting");
    expect(two.states.get(Phase)).toBe("idle");
    expect(one.states).not.toBe(two.states);
    expect(entered).not.toHaveBeenCalled();
    await one.stop();
  });

  it("throws when two different definitions share a name", async () => {
    const game = await newGame();
    const Other = defineState("test.Phase", { values: ["on", "off"], initial: "on" });
    game.states.get(Phase);
    expect(() => game.states.get(Other)).toThrow('Two states are named "test.Phase"');
    // An identical definition is the same state.
    const Same = defineState("test.Phase", { values: ["idle", "casting", "waiting"], initial: "idle" });
    expect(game.states.get(Same)).toBe("idle");
  });
});

describe("the loop guard", () => {
  /** Hooks that bounce Phase between casting and waiting `count` times after the first set. */
  function bounce(game: Game, count: { left: number }) {
    game.onEnter(Phase, "casting", ({ states }) => { if (count.left-- > 0) states.set(Phase, "waiting"); });
    game.onEnter(Phase, "waiting", ({ states }) => { if (count.left-- > 0) states.set(Phase, "casting"); });
  }

  it("allows 16 transitions of a state in a frame, and counts again in the next frame", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const count = { left: 0 };
    bounce(game, count);
    game.addSystem(Schedule.Update, function kick({ states }) {
      count.left = 15;
      states.set(Phase, states.get(Phase) === "casting" ? "waiting" : "casting");
    });
    await game.run();
    // Each frame: 1 transition from kick and 15 from the hooks.
    frame();
    expect(game.states.get(Phase)).toBe("waiting");
    expect(frame).not.toThrow();
    expect(game.states.get(Phase)).toBe("waiting");
    await game.stop();
  });

  it("throws on the 17th transition in one frame, naming the state and the last transitions", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    bounce(game, { left: Infinity });
    const exit = vi.fn();
    game.addSystem(Schedule.Update, function start({ states }) { states.set(Phase, "casting"); }, { runIf: inState(Phase, "idle") });
    game.addSystem(Schedule.Exit, exit);
    await game.run();
    expect(frame).toThrow(
      'State "test.Phase" changed more than 16 times in one frame, so something sets it in a loop. ' +
        'Last transitions: "casting" -> "waiting", "waiting" -> "casting", "casting" -> "waiting", "waiting" -> "casting". ' +
        'Check the onEnter and onExit hooks and the systems that set "test.Phase".',
    );
    // As with a system that throws, the game stops.
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
  });

  it("rejects run and rolls back when startup loops", async () => {
    stubLoop();
    const game = await newGame();
    bounce(game, { left: Infinity });
    const exit = vi.fn();
    const cleanup = vi.fn();
    game.addSystem(Schedule.Init, function start({ states, onCleanup }) {
      onCleanup(cleanup);
      states.set(Phase, "casting");
    });
    game.addSystem(Schedule.Exit, exit);
    await expect(game.run()).rejects.toThrow('State "test.Phase" changed more than 16 times');
    expect(exit).toHaveBeenCalledTimes(1);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("hooks that throw", () => {
  it("make startup roll back, as a startup system that throws does", async () => {
    stubLoop();
    const game = await newGame();
    const error = new Error("enter failed");
    const exit = vi.fn();
    const later = vi.fn();
    game.onEnter(Phase, "waiting", () => { throw error; });
    game.addSystem(Schedule.Init, function wait({ states }) { states.set(Phase, "waiting"); });
    game.addSystem(Schedule.Init, later);
    game.addSystem(Schedule.Exit, exit);
    await expect(game.run()).rejects.toBe(error);
    expect(later).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("make run reject when an initial enter hook throws", async () => {
    stubLoop();
    const game = await newGame();
    const error = new Error("first enter failed");
    const preInit = vi.fn();
    game.onEnter(Phase, "idle", () => { throw error; });
    game.addSystem(Schedule.PreInit, preInit);
    await expect(game.run()).rejects.toBe(error);
    expect(preInit).not.toHaveBeenCalled();
  });

  it("stop the game when thrown during a frame, as a system that throws does", async () => {
    const { frame } = stubLoop();
    const game = await newGame();
    const error = new Error("exit failed");
    const exit = vi.fn();
    const later = vi.fn();
    game.onExit(Phase, "idle", () => { throw error; });
    game.addSystem(Schedule.Update, function cast({ states }) { states.set(Phase, "casting"); });
    game.addSystem(Schedule.Update, later);
    game.addSystem(Schedule.Exit, exit);
    await game.run();
    expect(frame).toThrow(error);
    expect(later).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());
    expect(game.states.get(Phase)).toBe("idle");
  });
});

describe("timeIn", () => {
  it("counts game time since the current value was entered, resets on each transition and skips pauses", async () => {
    const { clock, frame } = stubLoop();
    const game = await newGame();
    expect(game.states.timeIn(Phase)).toBe(0);
    const seen: number[] = [];
    game.onExit(Phase, "idle", ({ states }) => seen.push(states.timeIn(Phase)));
    game.onEnter(Phase, "casting", ({ states }) => seen.push(states.timeIn(Phase)));
    game.addSystem(Schedule.Init, async function load() {
      clock.now += 5000; // startup takes no game time
    });
    let cast = false;
    game.addSystem(Schedule.Update, function maybeCast({ states }) {
      if (cast) states.set(Phase, "casting");
      cast = false;
    });
    await game.run();
    expect(game.states.timeIn(Phase)).toBe(0);

    clock.now += 1000;
    frame();
    expect(game.states.timeIn(Phase)).toBe(1);

    game.pause();
    clock.now += 10_000;
    expect(game.states.timeIn(Phase)).toBe(1);
    game.resume();
    clock.now += 500;
    expect(game.states.timeIn(Phase)).toBe(1.5);

    cast = true;
    frame();
    expect(seen).toEqual([1.5, 0]);
    clock.now += 250;
    expect(game.states.timeIn(Phase)).toBe(0.25);
    expect(game.states.timeIn(Light)).toBe(1.75);
    await game.stop();
  });
});

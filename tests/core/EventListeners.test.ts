import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import type { Game } from "@/core/Game";
import { Engine } from "@/core/Engine";
import { EventBus } from "@/core/EventBus";
import { defineEvent } from "@/core/EventQueue";
import type { ILogger } from "@/core/ILogger";
import { SceneManager } from "@/core/SceneManager";
import { Schedule, Scheduler } from "@/core/Scheduler";
import { NullLogger } from "@/core/NullLogger";
import type { SystemCtx } from "@/core/SystemCtx";

const Scored = defineEvent<{ points: number }>("test.listeners.scored");
const Fanfare = defineEvent<{ loud: boolean }>("test.listeners.fanfare");

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

function recordingLogger() {
  const errors: Array<{ message: string; error: unknown }> = [];
  const logger: ILogger = {
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error: (message, meta) => errors.push({ message, error: meta?.["error"] }),
  };
  return { logger, errors };
}

async function newGame(logger: ILogger = new NullLogger()): Promise<Game> {
  return createGame({ canvas: document.createElement("canvas"), logger });
}

/** Captures the run's ctx from an Init system. */
function captureCtx(game: Game): () => SystemCtx {
  let ctx: SystemCtx | undefined;
  game.addSystem(Schedule.Init, (c) => void (ctx = c), { name: "test.captureCtx" });
  return () => ctx!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("immediate listeners", () => {
  it("calls game.on listeners synchronously at send, in registration order, with the run's ctx", async () => {
    stubFrames();
    const game = await newGame();
    const ctxOf = captureCtx(game);
    const calls: string[] = [];
    const seen: SystemCtx[] = [];
    game.on(Scored, ({ points }, ctx) => (calls.push(`a${points}`), seen.push(ctx)));
    game.on(Scored, ({ points }) => void calls.push(`b${points}`));
    await game.run();

    game.events.send(Scored, { points: 1 });
    calls.push("after send");
    game.events.send(Scored, { points: 2 });

    expect(calls).toEqual(["a1", "b1", "after send", "a2", "b2"]);
    expect(seen).toEqual([ctxOf(), ctxOf()]);
    await game.stop();
  });

  it("delivers sends from systems and from outside them, such as DOM handlers between frames", async () => {
    const frame = stubFrames();
    const game = await newGame();
    const ctxOf = captureCtx(game);
    const seen: Array<[number, SystemCtx]> = [];
    game.on(Scored, ({ points }, ctx) => void seen.push([points, ctx]));
    game.addSystem(Schedule.Update, function scoreInUpdate({ events }) {
      events.send(Scored, { points: 1 });
    });
    await game.run();

    frame();
    const button = document.createElement("button");
    button.addEventListener("click", () => game.events.send(Scored, { points: 2 }));
    button.click();

    expect(seen).toEqual([[1, ctxOf()], [2, ctxOf()]]);
    await game.stop();
  });

  it("delivers events sent during startup and Exit", async () => {
    stubFrames();
    const game = await newGame();
    const points: number[] = [];
    game.on(Scored, (p) => void points.push(p.points));
    game
      .addSystem(Schedule.PreInit, ({ events }) => events.send(Scored, { points: 1 }), { name: "test.preInit" })
      .addSystem(Schedule.Exit, ({ events }) => events.send(Scored, { points: 2 }), { name: "test.exit" });
    await game.run();
    await game.stop();
    expect(points).toEqual([1, 2]);
  });

  it("only buffers an event sent before the first run or after a stop: listeners are not called", async () => {
    const frame = stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    game.on(Scored, handler);
    const reader = game.events.createReader(Scored);

    game.events.send(Scored, { points: 1 });
    expect(handler).not.toHaveBeenCalled();
    expect(reader.read()).toEqual([{ points: 1 }]);

    await game.run();
    frame();
    await game.stop();
    game.events.send(Scored, { points: 2 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not change buffered readers: they still see every event, listeners or not", async () => {
    const frame = stubFrames();
    const game = await newGame();
    game.on(Scored, () => {});
    const reader = game.events.createReader(Scored);
    const read: number[][] = [];
    game
      .addSystem(Schedule.Update, function send({ events }) {
        events.send(Scored, { points: read.length });
      })
      .addSystem(Schedule.PostUpdate, function readScores() {
        read.push(reader.read().map((e) => e.points));
      });
    await game.run();
    frame();
    frame();
    expect(read).toEqual([[0], [1]]);
    expect(game.events.read(Scored)).toEqual([{ points: 1 }]);
    await game.stop();
  });

  it("sees the event in the buffer when the listener runs", async () => {
    stubFrames();
    const game = await newGame();
    let buffered: readonly { points: number }[] = [];
    game.on(Scored, (_p, { events }) => void (buffered = [...events.read(Scored)]));
    await game.run();
    game.events.send(Scored, { points: 5 });
    expect(buffered).toEqual([{ points: 5 }]);
    await game.stop();
  });

  it("the returned function removes the listener, and calling it twice is harmless", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    const off = game.on(Scored, handler);
    await game.run();
    off();
    off();
    game.events.send(Scored, { points: 1 });
    expect(handler).not.toHaveBeenCalled();
    await game.stop();
  });

  it("keeps two games apart", async () => {
    stubFrames();
    const first = await newGame();
    const second = await newGame();
    const a = vi.fn();
    const b = vi.fn();
    first.on(Scored, a);
    second.on(Scored, b);
    await first.run();
    await second.run();
    first.events.send(Scored, { points: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    await first.stop();
    await second.stop();
  });
});

describe("listener lifetime", () => {
  it("game.on listeners stay across stop and run, like systems", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    game.on(Scored, handler);

    await game.run();
    game.events.send(Scored, { points: 1 });
    await game.stop();
    await game.run();
    game.events.send(Scored, { points: 2 });
    await game.stop();

    expect(handler.mock.calls.map(([p]) => p)).toEqual([{ points: 1 }, { points: 2 }]);
  });

  it("a game.on listener added while running also stays across runs", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    await game.run();
    game.on(Scored, handler);
    await game.stop();
    await game.run();
    game.events.send(Scored, { points: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    await game.stop();
  });

  it("ctx.events.on listeners belong to their run: they are gone after it stops", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    let registrations = 0;
    game.addSystem(Schedule.Init, function listen({ events }) {
      if (registrations++ === 0) events.on(Scored, handler);
    });

    await game.run();
    game.events.send(Scored, { points: 1 });
    await game.stop();
    await game.run();
    game.events.send(Scored, { points: 2 });
    await game.stop();

    expect(handler.mock.calls.map(([p]) => p)).toEqual([{ points: 1 }]);
  });

  it("a run listener re-added in Init each run is called once per send, not once per run so far", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    game.addSystem(Schedule.Init, function listen({ events }) {
      events.on(Scored, handler);
    });
    for (let run = 0; run < 3; run++) {
      await game.run();
      game.events.send(Scored, { points: run });
      await game.stop();
    }
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("run listeners hear events sent by Exit systems and cleanups, then are removed", async () => {
    stubFrames();
    const game = await newGame();
    const points: number[] = [];
    game
      .addSystem(Schedule.Init, function listen({ events, onCleanup }) {
        events.on(Scored, (p) => void points.push(p.points));
        onCleanup(() => events.send(Scored, { points: 3 }));
      })
      .addSystem(Schedule.Exit, function exit({ events }) {
        events.send(Scored, { points: 2 });
      });
    await game.run();
    game.events.send(Scored, { points: 1 });
    await game.stop();
    expect(points).toEqual([1, 2, 3]);
  });

  it("startup rollback removes run listeners and keeps game.on listeners", async () => {
    stubFrames();
    const game = await newGame();
    const runListener = vi.fn();
    const gameListener = vi.fn();
    game.on(Scored, gameListener);
    let fail = true;
    game
      .addSystem(Schedule.PreInit, function listen({ events }) {
        if (fail) events.on(Scored, runListener);
      })
      .addSystem(Schedule.Init, function maybeFail() {
        if (fail) throw new Error("startup failed");
      });

    await expect(game.run()).rejects.toThrow("startup failed");
    fail = false;
    await game.run();
    game.events.send(Scored, { points: 1 });

    expect(runListener).not.toHaveBeenCalled();
    expect(gameListener).toHaveBeenCalledTimes(1);
    await game.stop();
  });

  it("events.on outside a run throws and says to use game.on", async () => {
    const game = await newGame();
    expect(() => game.events.on(Scored, () => {})).toThrow(/needs a running game.*game\.on/);
  });

  it("the off function of a run listener still works during the run and is harmless after it", async () => {
    stubFrames();
    const game = await newGame();
    const handler = vi.fn();
    let off = () => {};
    game.addSystem(Schedule.Init, function listen({ events }) {
      off = events.on(Scored, handler);
    });
    await game.run();
    off();
    game.events.send(Scored, { points: 1 });
    await game.stop();
    off();
    expect(handler).not.toHaveBeenCalled();
  });

  it("an Engine built without createGame delivers to run listeners too", async () => {
    stubFrames();
    const events = new EventBus();
    const engine = new Engine({ scheduler: new Scheduler(), sceneManager: new SceneManager(new NullLogger()), events });
    const handler = vi.fn();
    engine.addSystem(Schedule.Init, function listen(ctx) {
      ctx.events.on(Scored, handler);
    });
    await engine.run();
    events.send(Scored, { points: 1 });
    await engine.stop();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("re-entrancy", () => {
  it("a listener that sends another event delivers it immediately, depth first", async () => {
    stubFrames();
    const game = await newGame();
    const calls: string[] = [];
    game.on(Scored, (_p, { events }) => {
      calls.push("scored 1");
      events.send(Fanfare, { loud: true });
    });
    game.on(Scored, () => void calls.push("scored 2"));
    game.on(Fanfare, () => void calls.push("fanfare"));
    await game.run();
    game.events.send(Scored, { points: 1 });
    expect(calls).toEqual(["scored 1", "fanfare", "scored 2"]);
    expect(game.events.read(Fanfare)).toEqual([{ loud: true }]);
    await game.stop();
  });

  it("a listener that sends the event it listens to is cut off and logged once", async () => {
    stubFrames();
    const { logger, errors } = recordingLogger();
    const game = await newGame(logger);
    let calls = 0;
    game.on(Scored, ({ points }, { events }) => {
      calls++;
      events.send(Scored, { points: points + 1 });
    });
    await game.run();
    expect(() => game.events.send(Scored, { points: 0 })).not.toThrow();
    expect(calls).toBe(32);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/"test\.listeners\.scored" not called: events nested 32 deep/);
    await game.stop();
  });

  it("a listener that removes itself during delivery is not called again; the rest still are", async () => {
    stubFrames();
    const game = await newGame();
    const calls: string[] = [];
    const off = game.on(Scored, () => {
      calls.push("once");
      off();
    });
    game.on(Scored, () => void calls.push("always"));
    await game.run();
    game.events.send(Scored, { points: 1 });
    game.events.send(Scored, { points: 2 });
    expect(calls).toEqual(["once", "always", "always"]);
    await game.stop();
  });

  it("a listener removed by an earlier one in the same delivery is not called", async () => {
    stubFrames();
    const game = await newGame();
    const later = vi.fn();
    let offLater = () => {};
    game.on(Scored, () => offLater());
    offLater = game.on(Scored, later);
    await game.run();
    game.events.send(Scored, { points: 1 });
    expect(later).not.toHaveBeenCalled();
    await game.stop();
  });

  it("a listener added during delivery does not receive that event, only later ones", async () => {
    stubFrames();
    const game = await newGame();
    const added = vi.fn();
    let first = true;
    game.on(Scored, () => {
      if (first) game.on(Scored, added);
      first = false;
    });
    await game.run();
    game.events.send(Scored, { points: 1 });
    expect(added).not.toHaveBeenCalled();
    game.events.send(Scored, { points: 2 });
    expect(added.mock.calls.map(([p]) => p)).toEqual([{ points: 2 }]);
    await game.stop();
  });
});

describe("failing listeners", () => {
  it("a throwing listener is logged with the event name and does not stop the others or the sender", async () => {
    stubFrames();
    const { logger, errors } = recordingLogger();
    const game = await newGame(logger);
    const boom = new Error("boom");
    const after = vi.fn();
    game.on(Scored, () => {
      throw boom;
    });
    game.on(Scored, after);
    await game.run();

    expect(() => game.events.send(Scored, { points: 1 })).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([
      { message: 'Listener for event "test.listeners.scored" failed', error: boom },
    ]);
    await game.stop();
  });

  it("a throwing listener inside a system does not fail the frame", async () => {
    const frame = stubFrames();
    const { logger, errors } = recordingLogger();
    const game = await newGame(logger);
    game.on(Scored, () => {
      throw new Error("boom");
    });
    const after = vi.fn();
    game
      .addSystem(Schedule.Update, function send({ events }) {
        events.send(Scored, { points: 1 });
      })
      .addSystem(Schedule.PostUpdate, after);
    await game.run();
    frame();
    expect(after).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
    await game.stop();
  });

  it("async listeners are allowed and not awaited; a rejection is logged, not left unhandled", async () => {
    stubFrames();
    const { logger, errors } = recordingLogger();
    const game = await newGame(logger);
    const unhandled = vi.fn();
    // Vitest runs in Node: an unhandled rejection reaches process, which jsdom's types do not declare.
    type Listen = (event: "unhandledRejection", listener: (reason: unknown) => void) => void;
    const node = (globalThis as unknown as { process: { on: Listen; off: Listen } }).process;
    node.on("unhandledRejection", unhandled);
    const boom = new Error("async boom");
    const after = vi.fn();
    game.on(Scored, async () => {
      await Promise.resolve();
      throw boom;
    });
    game.on(Scored, after);
    await game.run();

    game.events.send(Scored, { points: 1 });
    expect(after).toHaveBeenCalledTimes(1);
    expect(errors).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    node.off("unhandledRejection", unhandled);
    expect(errors).toEqual([
      { message: 'Listener for event "test.listeners.scored" failed', error: boom },
    ]);
    expect(unhandled).not.toHaveBeenCalled();
    await game.stop();
  });
});

describe("listener types", () => {
  it("the handler's payload is exactly the event's type, and ctx is a SystemCtx", async () => {
    const game = await newGame();
    game.on(Scored, (payload, ctx) => {
      expectTypeOf(payload).toEqualTypeOf<{ points: number }>();
      expectTypeOf(ctx).toEqualTypeOf<SystemCtx>();
    });
    expectTypeOf(game.on(Scored, () => {})).toEqualTypeOf<() => void>();
    const typeOnly = (events: EventBus) => {
      events.on(Fanfare, (payload) => expectTypeOf(payload).toEqualTypeOf<{ loud: boolean }>());
      // @ts-expect-error the handler wants a field the event does not have
      events.on(Fanfare, (_payload: { loud: boolean; volume: number }) => {});
    };
    void typeOnly;

    // @ts-expect-error the handler wants a field Scored does not have
    game.on(Scored, (_payload: { points: number; name: string }) => {});
    // @ts-expect-error the payload is { points: number }
    game.on(Scored, (payload) => payload.missing);
    // @ts-expect-error send still rejects a wrong payload
    game.events.send(Scored, { points: "ten" });
    // @ts-expect-error send still rejects a payload of another event
    game.events.send(Scored, { loud: true });
  });
});

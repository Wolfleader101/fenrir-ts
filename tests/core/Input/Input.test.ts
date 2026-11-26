import { describe, expect, it, vi } from "vitest";
import { Schedule, createTestGame, defineAction, type InputEdge, type SystemCtx, type TestGame } from "@/index";
import { Viewport, identityViewport } from "@/core/Renderer2D/Viewport";
import { NullLogger } from "@/core/NullLogger";

const Tap = defineAction("test.tap", ["pointer.primary", "Space", "Enter"]);
const Jump = defineAction("test.jump", ["Space"]);
const Menu = defineAction("test.menu", ["pointer.secondary"]);

type Seen = { pressed: boolean; released: boolean; held: boolean };

async function game(): Promise<TestGame> {
  const g = await createTestGame({ seed: 1, logger: new NullLogger() });
  return g;
}

/** Records what `read` returns in one system per frame. */
function record<T>(g: TestGame, stage: typeof Schedule.PreUpdate | typeof Schedule.Update | typeof Schedule.PostUpdate | typeof Schedule.Tick, read: (ctx: SystemCtx) => T, name = `record.${stage}`): T[] {
  const frames: T[] = [];
  g.addSystem(stage, (ctx) => void frames.push(read(ctx)), { name });
  return frames;
}

const seen = (action = Tap) => ({ input }: SystemCtx): Seen => ({
  pressed: input.pressed(action),
  released: input.released(action),
  held: input.held(action),
});

const PRESSED: Seen = { pressed: true, released: false, held: true };
const HELD: Seen = { pressed: false, released: false, held: true };
const RELEASED: Seen = { pressed: false, released: true, held: false };
const IDLE: Seen = { pressed: false, released: false, held: false };

describe("input actions, frame by frame", () => {
  it("reports a press for exactly one frame, then held, then one release", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, seen());
    await g.start();

    g.step();
    g.input.press(Tap);
    g.step(1 / 60, 3);
    g.input.release(Tap);
    g.step(1 / 60, 2);

    expect(frames).toEqual([IDLE, PRESSED, HELD, HELD, RELEASED, IDLE]);
  });

  it("gives every system in a frame, in every stage, the same answer", async () => {
    const g = await game();
    const pre = record(g, Schedule.PreUpdate, seen());
    const tick = record(g, Schedule.Tick, seen());
    const update = record(g, Schedule.Update, seen());
    const post = record(g, Schedule.PostUpdate, seen());
    // A system that presses during the frame changes nothing until the next frame.
    g.addSystem(Schedule.Update, function pressMidFrame({ input }) {
      (input as TestGame["input"]).press(Jump);
    }, { before: "record.update" });
    await g.start();

    g.input.press(Tap);
    g.step();

    expect([pre, tick, update, post]).toEqual([[PRESSED], [PRESSED], [PRESSED], [PRESSED]]);
    expect(g.input.pressed(Jump)).toBe(false);
  });

  it("does not lose a quick tap: down and up between two frames is pressed, then released", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, seen());
    const pointer = record(g, Schedule.Update, ({ input }) => input.pointer.down, "record.pointer");
    await g.start();

    g.input.pointerDown(10, 20);
    g.input.pointerUp();
    g.step(1 / 60, 3);

    expect(frames).toEqual([PRESSED, RELEASED, IDLE]);
    expect(pointer).toEqual([true, false, false]);
  });

  it("holds an action bound to several inputs while any of them is down, with no second press", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, seen());
    await g.start();

    g.input.press(Jump); // Space, a binding of Tap
    g.step();
    g.input.pointerDown(0, 0);
    g.step();
    g.input.release(Jump);
    g.step();
    g.input.pointerUp();
    g.step();

    expect(frames).toEqual([PRESSED, HELD, HELD, RELEASED]);
  });

  it("presses an action's first binding and releases all of them", async () => {
    const g = await game();
    await g.start();

    g.input.press(Tap);
    g.step();
    expect(g.input.pointer.down).toBe(true); // Tap's first binding is pointer.primary
    expect(g.input.held(Jump)).toBe(false);

    g.input.press(Jump);
    g.step();
    g.input.release(Tap);
    g.step();
    expect([g.input.held(Tap), g.input.held(Jump)]).toEqual([false, false]);
  });

  it("reads the secondary pointer as its own binding", async () => {
    const g = await game();
    await g.start();
    g.input.press(Menu);
    g.step();
    expect([g.input.pressed(Menu), g.input.held(Tap), g.input.pointer.down]).toEqual([true, false, false]);
  });

  it("reports nothing during startup and keeps no input across stop and start", async () => {
    const g = await game();
    const startup: Seen[] = [];
    g.addSystem(Schedule.Init, function readAtInit(ctx) {
      startup.push(seen()(ctx));
    });
    g.input.press(Tap); // before start: taken by the first frame
    await g.start();
    g.step();
    expect(startup).toEqual([IDLE]);
    expect(g.input.pressed(Tap)).toBe(true);

    await g.stop();
    expect([g.input.held(Tap), g.input.pointer]).toEqual([false, { x: 0, y: 0, down: false, inside: false, cancelled: false }]);
    await g.start();
    g.step();
    expect(g.input.held(Tap)).toBe(false);
  });
});

describe("input actions in the Tick stage", () => {
  it("sees a press in exactly one tick when a frame runs several", async () => {
    const g = await game();
    const ticks = record(g, Schedule.Tick, seen());
    await g.start();

    g.input.press(Tap);
    g.step(3 / 60); // three ticks in one frame
    g.step(2 / 60);
    g.input.release(Tap);
    g.step(2 / 60);

    expect(ticks).toEqual([PRESSED, HELD, HELD, HELD, HELD, RELEASED, IDLE]);
  });

  it("keeps a press for the next tick when a frame runs none", async () => {
    const g = await game();
    const ticks = record(g, Schedule.Tick, seen());
    const update = record(g, Schedule.Update, seen());
    await g.start();

    g.input.press(Tap);
    g.step(0.5 / 60); // no tick
    g.step(0.5 / 60); // one tick
    g.step(1 / 60);

    expect(update).toEqual([PRESSED, HELD, HELD]);
    expect(ticks).toEqual([PRESSED, HELD]);
  });

  it("sees a quick tap carried past a frame with no tick as pressed and released in one tick", async () => {
    const g = await game();
    const ticks = record(g, Schedule.Tick, seen());
    await g.start();

    g.input.pointerDown(5, 5);
    g.input.pointerUp();
    g.step(0.5 / 60); // pressed this frame, no tick
    g.step(0.5 / 60); // released this frame, one tick
    g.step(1 / 60);

    expect(ticks).toEqual([{ pressed: true, released: true, held: false }, IDLE]);
  });

  it("gives no second press in Tick when another binding goes down while one is held", async () => {
    const g = await game();
    const ticks = record(g, Schedule.Tick, seen());
    await g.start();

    g.input.press(Jump);
    g.step();
    g.input.pointerDown(0, 0);
    g.step();
    expect(ticks).toEqual([PRESSED, HELD]);
  });
});

describe("consumePointer", () => {
  function ui(g: TestGame, options: { before?: string; after?: string } = {}): void {
    g.addSystem(Schedule.Update, function myUi({ input }) {
      if (input.pressed(Tap) && input.pointer.y < 50) input.consumePointer();
    }, { name: "test.ui", ...options });
  }

  it("hides the press, the hold and the release from systems that run after it", async () => {
    const g = await game();
    ui(g);
    const play = record(g, Schedule.Update, seen(), "test.play");
    const down = record(g, Schedule.Update, ({ input }) => input.pointer.down, "test.down");
    await g.start();

    g.input.pointerDown(10, 10); // on the button
    g.step(1 / 60, 2);
    g.input.pointerUp();
    g.step(1 / 60, 2);

    expect(play).toEqual([IDLE, IDLE, IDLE, IDLE]);
    expect(down).toEqual([true, true, false, false]); // pointer.down still reports the pointer
  });

  it("is too late for systems that ran before it: run the UI with before", async () => {
    const late = await game();
    const play = record(late, Schedule.Update, seen(), "test.play");
    ui(late, { after: "test.play" });
    await late.start();
    late.input.pointerDown(10, 10);
    late.step();
    expect(play).toEqual([PRESSED]);

    const early = await game();
    const played = record(early, Schedule.Update, seen(), "test.play");
    ui(early, { before: "test.play" });
    await early.start();
    early.input.pointerDown(10, 10);
    early.step();
    expect(played).toEqual([IDLE]);
  });

  it("hides the press from Tick in later frames, when the UI runs in Update", async () => {
    const g = await game();
    ui(g);
    const ticks = record(g, Schedule.Tick, seen());
    await g.start();

    g.input.pointerDown(10, 10);
    g.step(0.5 / 60); // no tick, UI consumes in Update
    g.step(1 / 60);
    g.input.pointerUp();
    g.step(1 / 60);
    expect(ticks).toEqual([IDLE, IDLE]);
  });

  it("leaves keys bound to the same action working, and a press elsewhere untouched", async () => {
    const g = await game();
    ui(g);
    const play = record(g, Schedule.Update, seen(), "test.play");
    await g.start();

    g.input.pointerDown(10, 10);
    g.input.press(Jump);
    g.step();
    g.input.release(Jump);
    g.input.pointerUp();
    g.step(1 / 60, 2);
    g.input.pointerDown(10, 200); // below the button
    g.step();

    expect(play).toEqual([PRESSED, RELEASED, IDLE, PRESSED]);
  });

  it("does nothing in a frame with no new pointer press", async () => {
    const g = await game();
    const play = record(g, Schedule.Update, seen(), "test.play");
    g.addSystem(Schedule.PreUpdate, function consumeEveryFrame({ input, time }) {
      if (time.elapsed > 0.02) input.consumePointer();
    });
    await g.start();

    g.input.pointerDown(10, 10);
    g.step(1 / 60, 3);
    expect(play).toEqual([PRESSED, HELD, HELD]);
  });
});

describe("the pointer in a test game", () => {
  it("is placed in logical units, unchanged by the viewport", async () => {
    const g = await game();
    g.resources.set(Viewport, { ...identityViewport({ width: 400, height: 800 }, 1), scale: 2, offset: { x: 30, y: 10 } });
    const pointer = record(g, Schedule.Update, ({ input }) => input.pointer);
    await g.start();

    g.step();
    g.input.pointerMove(100.1, 200.3);
    g.step();
    g.input.pointerDown(50, 60);
    g.step();

    expect(pointer).toEqual([
      { x: 0, y: 0, down: false, inside: false, cancelled: false },
      { x: 100.1, y: 200.3, down: false, inside: true, cancelled: false },
      { x: 50, y: 60, down: true, inside: true, cancelled: false },
    ]);
  });

  it("keeps the same pointer object between frames where nothing changed", async () => {
    const g = await game();
    await g.start();
    g.input.pointerMove(1, 2);
    g.step();
    const first = g.input.pointer;
    g.step();
    expect(g.input.pointer).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("rejects a position that is not a finite number", async () => {
    const g = await game();
    expect(() => g.input.pointerMove(Number.NaN, 0)).toThrow("must be finite numbers. Got (NaN, 0)");
  });

  it("is the same object as ctx.input", async () => {
    const g = await game();
    const inputs = record(g, Schedule.Update, ({ input }) => input);
    await g.start();
    g.step();
    expect(inputs[0]).toBe(g.input);
  });
});

const Next = defineAction("test.gaps.next", ["ArrowRight"]);
const Activate = defineAction("test.gaps.activate", ["Enter"]);
const Back = defineAction("test.gaps.back", ["Escape", "Backspace"]);

function logger() {
  return { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const named = (edges: readonly InputEdge[]) => edges.map(({ action, kind }) => `${action.name}:${kind}`);

describe("input.edges: this frame's presses in order", () => {
  it("keeps the order of presses of different actions between two frames (#58)", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => named(input.edges([Next, Activate])));
    await g.start();

    g.input.press(Next);
    g.input.press(Activate);
    g.step();
    g.input.release(Activate);
    g.input.release(Next);
    g.step();

    expect(frames).toEqual([
      ["test.gaps.next:pressed", "test.gaps.activate:pressed"],
      ["test.gaps.activate:released", "test.gaps.next:released"],
    ]);
  });

  it("keeps two presses of one key between two frames, where pressed() counts one (#58)", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => ({ pressed: input.pressed(Next), edges: input.edges([Next]).map((edge) => edge.kind) }));
    await g.start();

    for (let i = 0; i < 2; i++) {
      g.input.press(Next);
      g.input.release(Next);
    }
    g.step(1 / 60, 2);

    expect(frames).toEqual([
      { pressed: true, edges: ["pressed", "released", "pressed", "released"] },
      { pressed: false, edges: [] },
    ]);
  });

  it("presses an action on its first binding and releases it on its last, as pressed() does", async () => {
    const g = await game();
    const escape = defineAction("test.gaps.escape", ["Escape"]);
    const backspace = defineAction("test.gaps.backspace", ["Backspace"]);
    const frames = record(g, Schedule.Update, ({ input }) => input.edges([Back]).map((edge) => edge.kind));
    await g.start();

    g.input.press(escape);
    g.input.press(backspace); // a second binding of Back: no second press
    g.input.release(escape);
    g.input.release(backspace);
    g.step();
    expect(frames).toEqual([["pressed", "released"]]);
  });

  it("lists only the actions asked for, and an empty frozen list in a quiet frame", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => input.edges([Activate]));
    await g.start();
    g.input.press(Next);
    g.step(1 / 60, 2);
    expect(frames).toEqual([[], []]);
    expect(Object.isFrozen(frames[1])).toBe(true);
  });

  it("leaves out bindings a UI system consumed, until they lift", async () => {
    const g = await game();
    g.addSystem(Schedule.Update, function ui({ input }) {
      if (input.pressed(Activate)) input.consume(Activate);
    });
    const frames = record(g, Schedule.Update, ({ input }) => named(input.edges([Activate, Next])), "play");
    await g.start();

    g.input.press(Activate);
    g.input.press(Next);
    g.step();
    g.input.release(Activate);
    g.step();
    g.input.release(Next);
    g.step();

    expect(frames).toEqual([["test.gaps.next:pressed"], [], ["test.gaps.next:released"]]);
  });
});

describe("input.consume", () => {
  it("hides a key press from later systems, whichever binding pressed it (#61)", async () => {
    const g = await game();
    const before = record(g, Schedule.Update, seen(), "early");
    g.addSystem(Schedule.Update, function ui({ input }) {
      if (input.pressed(Tap)) input.consume(Tap);
    });
    const after = record(g, Schedule.Update, seen(), "play");
    await g.start();

    g.input.press(Activate); // Enter, which Tap is bound to as well
    g.step(1 / 60, 2);
    g.input.release(Activate);
    g.step();

    // Systems before the UI saw the press; from the next frame the consumed key is hidden from all, until it lifts.
    expect(before).toEqual([PRESSED, IDLE, IDLE]);
    expect(after).toEqual([IDLE, IDLE, IDLE]);
  });

  it("hides the key from every action bound to it", async () => {
    const g = await game();
    g.addSystem(Schedule.Update, function ui({ input }) {
      if (input.pressed(Tap)) input.consume(Tap);
    });
    const after = record(g, Schedule.Update, seen(Activate), "play");
    await g.start();

    g.input.press(Activate);
    g.step();
    g.input.release(Activate);
    g.step();
    expect(after).toEqual([IDLE, IDLE]);
  });

  it("does nothing for an action held from an earlier frame", async () => {
    const g = await game();
    let consumeNow = false;
    g.addSystem(Schedule.Update, function ui({ input }) {
      if (consumeNow) input.consume(Tap);
    });
    const after = record(g, Schedule.Update, seen(), "play");
    await g.start();

    g.input.press(Tap);
    g.step();
    consumeNow = true;
    g.step();
    expect(after).toEqual([PRESSED, HELD]);
  });

  it("hides the press from Tick when called in PreUpdate", async () => {
    const g = await game();
    g.addSystem(Schedule.PreUpdate, function ui({ input }) {
      if (input.pressed(Jump)) input.consume(Jump);
    });
    const ticks = record(g, Schedule.Tick, ({ input }) => input.pressed(Jump));
    await g.start();
    g.input.press(Jump);
    g.step();
    expect(ticks).toEqual([false]);
  });
});

describe("input.focused", () => {
  it("is latched when the frame starts, and blur releases everything held (#60)", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => [input.focused, input.held(Jump), input.released(Jump)]);
    await g.start();

    g.step();
    g.input.focus();
    expect(g.input.focused).toBe(false); // not until the next frame
    g.input.press(Jump);
    g.step();
    g.input.blur();
    g.step();

    expect(frames).toEqual([[false, false, false], [true, true, false], [false, false, true]]);
  });

  it("goes true on a pointer press, as a press on the canvas focuses it", async () => {
    const g = await game();
    await g.start();
    g.input.pointerDown(1, 1);
    g.step();
    expect(g.input.focused).toBe(true);
  });

  it("is false again after stop", async () => {
    const g = await game();
    await g.start();
    g.input.focus();
    g.step();
    await g.stop();
    expect(g.input.focused).toBe(false);
  });
});

describe("pointer.cancelled", () => {
  it("is true only in the frame a cancel releases the pointer (#62)", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => [input.released(Tap), input.pointer.cancelled]);
    await g.start();

    g.input.pointerDown(10, 10);
    g.step();
    g.input.pointerCancel();
    g.step(1 / 60, 2);

    expect(frames).toEqual([[false, false], [true, true], [false, false]]);
    expect(g.input.pointer.inside).toBe(false);
  });

  it("is false for a lift", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => [input.released(Tap), input.pointer.cancelled]);
    await g.start();
    g.input.pointerDown(10, 10);
    g.step();
    g.input.pointerUp();
    g.step();
    expect(frames).toEqual([[false, false], [true, false]]);
  });

  it("is reported in the release frame for a press cancelled before any frame saw it", async () => {
    const g = await game();
    const frames = record(g, Schedule.Update, ({ input }) => [input.pressed(Tap), input.released(Tap), input.pointer.cancelled]);
    await g.start();
    g.input.pointerDown(10, 10);
    g.input.pointerCancel();
    g.step(1 / 60, 2);
    expect(frames).toEqual([[true, false, false], [false, true, true]]);
  });

  it("is false when a new press follows the cancel before the next frame", async () => {
    const g = await game();
    await g.start();
    g.input.pointerDown(10, 10);
    g.step();
    g.input.pointerCancel();
    g.input.pointerDown(10, 10);
    g.step();
    expect([g.input.held(Tap), g.input.pointer.cancelled]).toEqual([true, false]);
  });

  it("is true when blur releases a held pointer", async () => {
    const g = await game();
    await g.start();
    g.input.pointerDown(10, 10);
    g.step();
    g.input.blur();
    g.step();
    expect([g.input.released(Tap), g.input.pointer.cancelled]).toEqual([true, true]);
  });
});

describe("input.onDown and input.onGesture in a test game", () => {
  it("calls onDown at the press, with the run's ctx, and reports the claim", async () => {
    const g = await game();
    const calls: Array<[KeyboardEvent | PointerEvent | undefined, boolean]> = [];
    let claim = true;
    g.input.onDown(Next, (event, ctx) => {
      calls.push([event, ctx.input === g.input]);
      return claim;
    });
    await g.start();

    const event = new KeyboardEvent("keydown", { code: "ArrowRight", shiftKey: true });
    expect(g.input.press(Next, event)).toBe(true);
    claim = false;
    expect(g.input.press(Next)).toBe(false);
    expect(g.input.press(Activate)).toBe(false);
    expect(calls).toEqual([[event, true], [undefined, true]]);
  });

  it("calls handlers only while the game runs, and keeps them across stop and start", async () => {
    const g = await game();
    const handler = vi.fn(() => true);
    g.input.onDown(Tap, handler);
    expect(g.input.press(Tap)).toBe(false);
    await g.start();
    await g.stop();
    expect(g.input.press(Tap)).toBe(false);
    await g.start();
    expect(g.input.pointerDown(1, 1)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes a handler with the function it returns", async () => {
    const g = await game();
    const handler = vi.fn(() => true);
    const off = g.input.onDown(Tap, handler);
    const offGesture = g.input.onGesture(handler);
    await g.start();
    off();
    offGesture();
    off();
    expect(g.input.press(Tap)).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call a handler removed by an earlier one in the same press", async () => {
    const g = await game();
    const second = vi.fn();
    let offSecond = (): void => {};
    g.input.onDown(Tap, () => offSecond());
    offSecond = g.input.onDown(Tap, second);
    await g.start();
    g.input.press(Tap);
    expect(second).not.toHaveBeenCalled();
  });

  it("logs a throwing handler, which does not claim, and calls the rest", async () => {
    const log = logger();
    const g = await createTestGame({ seed: 1, logger: log });
    const later = vi.fn(() => false);
    g.input.onDown(Tap, () => {
      throw new Error("ui broke");
    });
    g.input.onDown(Tap, later);
    g.input.onGesture(() => {
      throw new Error("audio broke");
    });
    await g.start();

    expect(g.input.press(Tap)).toBe(false);
    expect(later).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith('onDown handler of action "test.tap" failed', { error: new Error("ui broke") });
    expect(log.error).toHaveBeenCalledWith("onGesture handler failed", { error: new Error("audio broke") });
  });

  it("calls onGesture on press, pointerDown and pointerUp, not on release or move", async () => {
    const g = await game();
    const gestures = vi.fn();
    g.input.onGesture(gestures);
    await g.start();

    g.input.press(Jump);
    g.input.release(Jump);
    g.input.pointerMove(1, 1);
    g.input.pointerDown(1, 1);
    g.input.pointerUp();
    expect(gestures).toHaveBeenCalledTimes(3);
  });
});

describe("consumption ends with the press it hid", () => {
  /** A UI system that consumes every press of `action`, and a later gameplay system recording what it sees. */
  async function consuming(action = Activate, onlyFirst = true) {
    const g = await game();
    let consumed = 0;
    g.addSystem(Schedule.PreUpdate, function ui({ input }) {
      if (input.pressed(action) && (!onlyFirst || consumed === 0)) consumed++, input.consume(action);
    });
    const after = record(g, Schedule.Update, seen(action), "play");
    const edges = record(g, Schedule.Update, ({ input }) => named(input.edges([action])), "edges");
    await g.start();
    return { g, after, edges, consumed: () => consumed };
  }

  it("sees a second press that lifts and goes down again between two frames", async () => {
    const { g, after, edges } = await consuming();
    g.input.press(Activate);
    g.step(); // consumed
    g.input.release(Activate);
    g.input.press(Activate); // still down when the next frame latches
    g.step();
    g.step();
    expect(after).toEqual([IDLE, PRESSED, HELD]);
    expect(edges).toEqual([[], ["test.gaps.activate:pressed"], []]);
  });

  it("sees a press in the very next frame after a consumed tap", async () => {
    const { g, after, edges } = await consuming();
    g.input.press(Activate);
    g.input.release(Activate);
    g.step(); // the tap holds for this frame and is consumed
    g.input.press(Activate);
    g.step();
    g.input.release(Activate);
    g.step();
    expect(after).toEqual([IDLE, PRESSED, RELEASED]);
    expect(edges).toEqual([[], ["test.gaps.activate:pressed"], ["test.gaps.activate:released"]]);
  });

  it("still hides a consumed key held across frames until it lifts", async () => {
    const { g, after, edges } = await consuming();
    g.input.press(Activate);
    g.step(1 / 60, 3);
    g.input.release(Activate);
    g.step();
    expect(after).toEqual([IDLE, IDLE, IDLE, IDLE]);
    expect(edges).toEqual([[], [], [], []]);
  });

  it("lets the UI consume the second press too", async () => {
    const { g, after, consumed } = await consuming(Activate, false);
    g.input.press(Activate);
    g.step();
    g.input.release(Activate);
    g.input.press(Activate);
    g.step();
    expect(consumed()).toBe(2);
    expect(after).toEqual([IDLE, IDLE]);
  });

  it("does the same for the pointer and consumePointer", async () => {
    const g = await game();
    let consumed = 0;
    g.addSystem(Schedule.PreUpdate, function ui({ input }) {
      if (input.pressed(Tap) && consumed === 0) consumed++, input.consumePointer();
    });
    const after = record(g, Schedule.Update, seen(), "play");
    const edges = record(g, Schedule.Update, ({ input }) => named(input.edges([Tap])), "edges");
    await g.start();
    g.input.pointerDown(5, 5);
    g.step();
    g.input.pointerUp();
    g.input.pointerDown(6, 6);
    g.step();
    g.input.pointerUp();
    g.step();
    g.input.pointerDown(5, 5);
    g.input.pointerUp();
    consumed = 0;
    g.step(); // a consumed tap, then a press in the very next frame
    g.input.pointerDown(5, 5);
    g.step();
    expect(after).toEqual([IDLE, PRESSED, RELEASED, IDLE, PRESSED]);
    expect(edges.map((e) => e.length)).toEqual([0, 1, 1, 0, 1]);
  });

  it("is seen in Tick as well", async () => {
    const g = await game();
    let consumed = 0;
    g.addSystem(Schedule.PreUpdate, function ui({ input }) {
      if (input.pressed(Jump) && consumed++ === 0) input.consume(Jump);
    });
    const ticks = record(g, Schedule.Tick, ({ input }) => input.pressed(Jump));
    await g.start();
    g.input.press(Jump);
    g.step();
    g.input.release(Jump);
    g.input.press(Jump);
    g.step();
    expect(ticks).toEqual([false, true]);
  });

  it("hides a press that two quick taps merged into a held binding", async () => {
    // Failure path of the merge: a tap the game saw, then a second press before the next frame,
    // which pressed() folds into the hold. Consuming that press now hides the hold as well.
    const g = await game();
    let consumeNow = false;
    g.addSystem(Schedule.PreUpdate, function ui({ input }) {
      if (consumeNow) input.consume(Activate);
    });
    const after = record(g, Schedule.Update, seen(Activate), "play");
    await g.start();
    g.input.press(Activate);
    g.input.release(Activate);
    g.step();
    g.input.press(Activate);
    consumeNow = true;
    g.step();
    expect(after).toEqual([PRESSED, { pressed: false, released: true, held: false }]);
  });
});

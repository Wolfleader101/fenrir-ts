import { describe, expect, it } from "vitest";
import { Schedule, createTestGame, defineAction, type SystemCtx, type TestGame } from "@/index";
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
    expect([g.input.held(Tap), g.input.pointer]).toEqual([false, { x: 0, y: 0, down: false, inside: false }]);
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
      { x: 0, y: 0, down: false, inside: false },
      { x: 100.1, y: 200.3, down: false, inside: true },
      { x: 50, y: 60, down: true, inside: true },
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

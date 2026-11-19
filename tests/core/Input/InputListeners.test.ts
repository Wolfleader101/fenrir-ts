import { afterEach, describe, expect, it, vi } from "vitest";
import { Schedule, createGame, defineAction, type Game } from "@/index";
import { Viewport, identityViewport } from "@/core/Renderer2D/Viewport";
import { NullLogger } from "@/core/NullLogger";

const Tap = defineAction("test.listen.tap", ["pointer.primary", "Space"]);
const Left = defineAction("test.listen.left", ["ArrowLeft", "KeyA"]);
const Menu = defineAction("test.listen.menu", ["pointer.secondary"]);

const games: Game[] = [];

afterEach(async () => {
  for (const game of games.splice(0)) await game.stop();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function canvasAt(left = 10, top = 20, width = 300, height = 600): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) });
  document.body.append(canvas);
  return canvas;
}

/** A game that has run and is paused, so `step` drives frames and the canvas listeners are live. */
async function running(canvas = canvasAt(), configure?: (game: Game) => void): Promise<Game> {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const game = await createGame({ canvas, logger: new NullLogger() });
  games.push(game);
  configure?.(game);
  await game.run();
  game.pause();
  return game;
}

function key(target: EventTarget, type: "keydown" | "keyup", code: string, repeat = false): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

type PointerInit = { x: number; y: number; buttons?: number; id?: number; primary?: boolean };

// jsdom has no PointerEvent: a MouseEvent with the pointer fields stands in for one.
function pointer(target: EventTarget, type: string, { x, y, buttons = 0, id = 1, primary = true }: PointerInit): MouseEvent {
  const event = new MouseEvent(type, { clientX: x, clientY: y, buttons, bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: id }, isPrimary: { value: primary } });
  target.dispatchEvent(event);
  return event;
}

describe("input listeners on the canvas", () => {
  it("reads keys that reach the focused canvas, and ignores keys elsewhere on the page", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);

    key(document.body, "keydown", "ArrowLeft");
    key(window, "keydown", "ArrowLeft");
    game.step();
    expect(game.input.held(Left)).toBe(false);

    key(canvas, "keydown", "KeyA");
    game.step();
    expect(game.input.pressed(Left)).toBe(true);
    key(canvas, "keydown", "KeyA", true); // auto-repeat
    game.step();
    expect([game.input.pressed(Left), game.input.held(Left)]).toEqual([false, true]);
    key(canvas, "keyup", "KeyA");
    game.step();
    expect(game.input.released(Left)).toBe(true);
  });

  it("prevents scrolling on Space and the arrows on the canvas only, and nothing else", async () => {
    const canvas = canvasAt();
    await running(canvas);

    expect(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((code) => key(canvas, "keydown", code).defaultPrevented))
      .toEqual([true, true, true, true, true]);
    expect(["KeyA", "Enter", "Tab", "F5"].map((code) => key(canvas, "keydown", code).defaultPrevented))
      .toEqual([false, false, false, false]);
    expect(key(document.body, "keydown", "Space").defaultPrevented).toBe(false);
    expect(key(canvas, "keyup", "Space").defaultPrevented).toBe(false);
  });

  it("prevents the context menu and touch gestures on the canvas, and gives it a tabindex if it has none", async () => {
    const canvas = canvasAt();
    canvas.style.touchAction = "pan-y";
    const game = await running(canvas);

    expect([canvas.getAttribute("tabindex"), canvas.style.touchAction]).toEqual(["0", "none"]);
    expect(pointer(canvas, "contextmenu", { x: 0, y: 0 }).defaultPrevented).toBe(true);
    expect(pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 }).defaultPrevented).toBe(false);

    await game.stop();
    expect([canvas.hasAttribute("tabindex"), canvas.style.touchAction]).toEqual([false, "pan-y"]);
  });

  it("keeps a tabindex the page set", async () => {
    const canvas = canvasAt();
    canvas.setAttribute("tabindex", "-1");
    const game = await running(canvas);
    await game.stop();
    expect(canvas.getAttribute("tabindex")).toBe("-1");
  });

  it("reports the pointer in CSS pixels from the canvas corner without a viewport", async () => {
    const canvas = canvasAt(10, 20);
    const game = await running(canvas);

    pointer(canvas, "pointermove", { x: 110, y: 220 });
    game.step();
    expect(game.input.pointer).toEqual({ x: 100, y: 200, down: false, inside: true, cancelled: false });
    expect(game.inspect().resources).not.toHaveProperty(["fenrir.viewport.Viewport"]);
  });

  it("reports the pointer in logical units under a scaled and offset viewport", async () => {
    const canvas = canvasAt(10, 20);
    const game = await running(canvas);
    // 2 CSS pixels per unit, the frame 30 px from the canvas's left edge and 40 px from its top.
    game.resources.set(Viewport, { ...identityViewport({ width: 300, height: 600 }, 1), width: 120, height: 280, scale: 2, offset: { x: 30, y: 40 } });

    pointer(canvas, "pointerdown", { x: 10 + 30 + 2 * 50, y: 20 + 40 + 2 * 75, buttons: 1 });
    game.step();
    expect(game.input.pointer).toEqual({ x: 50, y: 75, down: true, inside: true, cancelled: false });
    expect(game.input.pressed(Tap)).toBe(true);

    // A viewport with no area keeps the last position.
    game.resources.set(Viewport, { ...game.resources.get(Viewport), scale: 0 });
    pointer(canvas, "pointermove", { x: 200, y: 200, buttons: 1 });
    game.step();
    expect([game.input.pointer.x, game.input.pointer.y]).toEqual([50, 75]);
  });

  it("drives the primary pointer from touch and mouse, and ignores a second finger", async () => {
    const canvas = canvasAt(0, 0);
    const game = await running(canvas);

    pointer(canvas, "pointerdown", { x: 10, y: 10, buttons: 1, id: 7 }); // first finger
    pointer(canvas, "pointerdown", { x: 90, y: 90, buttons: 1, id: 8, primary: false }); // second finger
    pointer(canvas, "pointermove", { x: 95, y: 95, buttons: 1, id: 8, primary: false });
    pointer(canvas, "pointerup", { x: 95, y: 95, buttons: 0, id: 8, primary: false });
    pointer(canvas, "pointermove", { x: 70, y: 70, buttons: 0, id: 1 }); // the mouse, primary of its own type
    game.step();
    expect([game.input.pointer.x, game.input.held(Tap)]).toEqual([10, true]);

    pointer(canvas, "pointerup", { x: 12, y: 12, buttons: 0, id: 7 });
    game.step();
    expect([game.input.pointer.x, game.input.released(Tap)]).toEqual([12, true]);

    pointer(canvas, "pointerdown", { x: 40, y: 40, buttons: 1, id: 1 }); // the mouse, after the finger lifted
    game.step();
    expect([game.input.pointer.x, game.input.pressed(Tap)]).toEqual([40, true]);
  });

  it("reads the secondary button from the button mask, even when it arrives as a pointermove", async () => {
    const canvas = canvasAt(0, 0);
    const game = await running(canvas);

    pointer(canvas, "pointerdown", { x: 5, y: 5, buttons: 1 });
    pointer(canvas, "pointermove", { x: 5, y: 5, buttons: 3 }); // right button chorded onto the left
    game.step();
    expect([game.input.held(Tap), game.input.pressed(Menu)]).toEqual([true, true]);

    pointer(canvas, "pointermove", { x: 5, y: 5, buttons: 2 });
    game.step();
    expect([game.input.released(Tap), game.input.held(Menu), game.input.pointer.down]).toEqual([true, true, false]);
  });

  it("captures the pointer and focuses the canvas on a press", async () => {
    const canvas = canvasAt(0, 0);
    const capture = vi.fn();
    canvas.setPointerCapture = capture;
    await running(canvas);

    pointer(canvas, "pointerdown", { x: 5, y: 5, buttons: 1, id: 3 });
    expect(capture).toHaveBeenCalledWith(3);
    expect(document.activeElement).toBe(canvas);
  });

  it("still takes the press and focuses the canvas when the browser refuses pointer capture", async () => {
    const canvas = canvasAt(0, 0);
    canvas.setPointerCapture = () => {
      throw new DOMException("No active pointer with the given id is found.", "NotFoundError");
    };
    const game = await running(canvas);

    expect(() => pointer(canvas, "pointerdown", { x: 5, y: 5, buttons: 1 })).not.toThrow();
    game.step();
    expect([game.input.pressed(Tap), document.activeElement]).toEqual([true, canvas]);
  });

  it("reports inside false when the captured pointer is dragged off the canvas or the mouse leaves", async () => {
    const canvas = canvasAt(0, 0, 100, 100);
    const game = await running(canvas);

    pointer(canvas, "pointerdown", { x: 50, y: 50, buttons: 1 });
    pointer(canvas, "pointermove", { x: 150, y: 50, buttons: 1 });
    game.step();
    expect(game.input.pointer).toEqual({ x: 150, y: 50, down: true, inside: false, cancelled: false });

    pointer(canvas, "pointerup", { x: 60, y: 50 });
    pointer(canvas, "pointerleave", { x: 60, y: -1 });
    game.step();
    expect(game.input.pointer).toEqual({ x: 60, y: 50, down: false, inside: false, cancelled: false });
  });
});

describe("stuck input", () => {
  it("releases keys and the pointer when the canvas loses focus", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    key(canvas, "keydown", "KeyA");
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    game.step();

    canvas.dispatchEvent(new FocusEvent("blur"));
    game.step();
    expect([game.input.released(Left), game.input.released(Tap)]).toEqual([true, true]);
    // The keyup that arrives somewhere else later changes nothing.
    key(document.body, "keyup", "KeyA");
    game.step();
    expect(game.input.held(Left)).toBe(false);
  });

  it.each(["pointercancel", "lostpointercapture"])("releases the pointer on %s", async (type) => {
    const canvas = canvasAt();
    const game = await running(canvas);
    key(canvas, "keydown", "Space");
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    key(canvas, "keyup", "Space");
    game.step();

    pointer(canvas, type, { x: 20, y: 30, buttons: 1 });
    game.step();
    expect([game.input.released(Tap), game.input.pointer.down, game.input.pointer.inside]).toEqual([true, false, false]);
  });

  it("ignores a cancel from a pointer that is not the one pressing", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1, id: 1 });
    pointer(canvas, "pointercancel", { x: 20, y: 30, id: 2, primary: false });
    game.step();
    expect(game.input.held(Tap)).toBe(true);
  });

  it("releases everything when the page is hidden", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    key(canvas, "keydown", "KeyA");
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    game.step();

    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    game.step();
    expect([game.input.released(Left), game.input.released(Tap)]).toEqual([true, true]);
  });

  it("leaves no listener behind after stop, and does not double them on the next run", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    key(canvas, "keydown", "KeyA");
    game.step();
    await game.stop();

    expect(key(canvas, "keydown", "Space").defaultPrevented).toBe(false);
    expect(pointer(canvas, "contextmenu", { x: 0, y: 0 }).defaultPrevented).toBe(false);
    expect(game.input.held(Left)).toBe(false);

    await game.run();
    game.pause();
    const add = vi.spyOn(canvas, "addEventListener");
    key(canvas, "keydown", "KeyA");
    game.step();
    expect([game.input.pressed(Left), add.mock.calls.length]).toEqual([true, 0]);
  });

  it("leaves no listener behind after a startup that throws", async () => {
    const canvas = canvasAt();
    const touchAction = canvas.style.touchAction;
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const game = await createGame({ canvas, logger: new NullLogger() });
    game.addSystem(Schedule.Init, function failToStart() {
      throw new Error("no assets");
    });

    await expect(game.run()).rejects.toThrow("no assets");
    expect(key(canvas, "keydown", "Space").defaultPrevented).toBe(false);
    expect([canvas.hasAttribute("tabindex"), canvas.style.touchAction]).toEqual([false, touchAction]);
  });
});

const FocusNext = defineAction("test.listen.focusNext", ["Tab"]);
const Next = defineAction("test.listen.next", ["ArrowRight"]);

describe("onDown inside the DOM event", () => {
  it("leaves Tab's default alone with no handler (#57)", async () => {
    const canvas = canvasAt();
    await running(canvas);
    expect(key(canvas, "keydown", "Tab").defaultPrevented).toBe(false);
  });

  it("prevents Tab's default when a handler claims it, decided at the key press (#57)", async () => {
    const canvas = canvasAt();
    let controlsLeft = 2;
    const seen: Array<{ shift: boolean; heldInside: boolean }> = [];
    const game = await running(canvas, (g) => {
      g.input.onDown(FocusNext, (event, ctx) => {
        seen.push({ shift: (event as KeyboardEvent).shiftKey, heldInside: ctx.input.held(FocusNext) });
        return controlsLeft-- > 0;
      });
    });

    const claimed = [key(canvas, "keydown", "Tab"), key(canvas, "keydown", "Tab", true), key(canvas, "keydown", "Tab", true)];
    expect(claimed.map((event) => event.defaultPrevented)).toEqual([true, true, false]);
    // Called before the press is latched: the frame's answers do not include it yet.
    expect(seen.map((call) => call.heldInside)).toEqual([false, false, false]);
    game.step();
    expect(game.input.pressed(FocusNext)).toBe(true);
  });

  it("passes the event, so a handler can read modifiers", async () => {
    const canvas = canvasAt();
    const shifts: boolean[] = [];
    await running(canvas, (g) => g.input.onDown(FocusNext, (event) => void shifts.push((event as KeyboardEvent).shiftKey)));
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
    expect(shifts).toEqual([true]);
  });

  it("claims a pointer press once, on the event that presses the button", async () => {
    const canvas = canvasAt();
    const handler = vi.fn(() => true);
    const game = await running(canvas, (g) => g.input.onDown(Tap, handler));

    expect(pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 }).defaultPrevented).toBe(true);
    expect(pointer(canvas, "pointermove", { x: 25, y: 30, buttons: 1 }).defaultPrevented).toBe(false);
    pointer(canvas, "pointerup", { x: 25, y: 30 });
    expect(handler).toHaveBeenCalledTimes(1);
    game.step();
    expect(game.input.pressed(Tap)).toBe(true);
  });

  it("is not called for keys bound to no action with a handler, nor after stop", async () => {
    const canvas = canvasAt();
    const handler = vi.fn(() => true);
    const game = await running(canvas, (g) => g.input.onDown(FocusNext, handler));
    expect(key(canvas, "keydown", "KeyA").defaultPrevented).toBe(false);
    await game.stop();
    expect(key(canvas, "keydown", "Tab").defaultPrevented).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onGesture inside the DOM event", () => {
  it("runs inside keydown, pointerdown and pointerup, not key repeats or moves (#59)", async () => {
    const canvas = canvasAt();
    const types: string[] = [];
    await running(canvas, (g) => g.input.onGesture((event) => void types.push(event!.type)));

    key(canvas, "keydown", "Space");
    key(canvas, "keydown", "Space", true);
    key(canvas, "keyup", "Space");
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    pointer(canvas, "pointermove", { x: 21, y: 30, buttons: 1 });
    pointer(canvas, "pointerup", { x: 21, y: 30 });
    // A second finger's lift is a gesture too, though it drives no input.
    pointer(canvas, "pointerup", { x: 0, y: 0, id: 2, primary: false });

    expect(types).toEqual(["keydown", "pointerdown", "pointerup", "pointerup"]);
  });

  it("runs synchronously, so a call that needs the gesture happens inside it", async () => {
    const canvas = canvasAt();
    let insideEvent = false;
    let dispatching = false;
    await running(canvas, (g) => g.input.onGesture(() => void (insideEvent = dispatching)));
    dispatching = true;
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    dispatching = false;
    expect(insideEvent).toBe(true);
  });
});

describe("canvas focus", () => {
  it("reports focus and its loss, latched each frame (#60)", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    game.step();
    expect(game.input.focused).toBe(false);

    canvas.focus();
    game.step();
    expect(game.input.focused).toBe(true);

    canvas.blur();
    game.step();
    expect(game.input.focused).toBe(false);
  });

  it("starts focused when the canvas already has focus", async () => {
    const canvas = canvasAt();
    canvas.tabIndex = 0;
    canvas.focus();
    const game = await running(canvas);
    game.step();
    expect(game.input.focused).toBe(true);
  });

  it("tells a focus loss from a key release", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    canvas.focus();
    key(canvas, "keydown", "KeyA");
    game.step();
    key(canvas, "keyup", "KeyA");
    game.step();
    expect([game.input.released(Left), game.input.focused]).toEqual([true, true]);
  });
});

describe("cancelled pointer", () => {
  it.each(["pointercancel", "lostpointercapture"])("reports %s as cancelled, and a lift as not (#62)", async (type) => {
    const canvas = canvasAt();
    const game = await running(canvas);
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    game.step();
    pointer(canvas, type, { x: 20, y: 30 });
    game.step();
    expect([game.input.released(Tap), game.input.pointer.cancelled]).toEqual([true, true]);

    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    game.step();
    pointer(canvas, "pointerup", { x: 20, y: 30 });
    // The capture is lost after every lift; it is not a cancel.
    pointer(canvas, "lostpointercapture", { x: 20, y: 30 });
    game.step();
    expect([game.input.released(Tap), game.input.pointer.cancelled]).toEqual([true, false]);
  });
});

describe("edges from DOM events", () => {
  it("keeps two key presses that land in one frame (#58)", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    for (let i = 0; i < 2; i++) {
      key(canvas, "keydown", "ArrowRight");
      key(canvas, "keydown", "ArrowRight", true); // auto-repeat adds nothing
      key(canvas, "keyup", "ArrowRight");
    }
    game.step();
    expect(game.input.edges([Next]).filter((edge) => edge.kind === "pressed")).toHaveLength(2);
  });
});

describe("synthetic pointer events (#63)", () => {
  it("sees no press from a pointerdown without buttons", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 0 });
    game.step();
    expect(game.input.pressed(Tap)).toBe(false);
  });

  it("sees a press and release from buttons: 1 then a pointerup with buttons: 0", async () => {
    const canvas = canvasAt();
    const game = await running(canvas);
    pointer(canvas, "pointerdown", { x: 20, y: 30, buttons: 1 });
    pointer(canvas, "pointerup", { x: 20, y: 30, buttons: 0 });
    game.step();
    expect(game.input.pressed(Tap)).toBe(true);
    game.step();
    expect(game.input.released(Tap)).toBe(true);
  });
});

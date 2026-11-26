import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Application, Container, Graphics } from "pixi.js";
import { Schedule, createGame, type Game } from "@/index";
import { Viewport, logicalToScreen, pixi2d } from "@/2d";
import { NullLogger } from "@/core/NullLogger";
import { ControlActivated, UiFocus, control, listControls, modalScope, syncUi, ui, type UiOptions } from "@/ui";

// createGame + pixi2d({ design }) on a stubbed window, with the engine's real canvas listeners:
// what a browser game does, without a GPU. jsdom has no layout, PointerEvent or safe-area insets.

/** A Pixi application that looks initialized on `canvas`, without a GPU. */
function adoptedApplication(canvas: HTMLCanvasElement) {
  const app = new Application();
  const screen = { width: 400, height: 300 };
  Object.assign(app, {
    renderer: { canvas, screen, resolution: 1, render: vi.fn(), resize: vi.fn((width: number, height: number) => Object.assign(screen, { width, height })) },
  });
  return app;
}

// jsdom has no PointerEvent: a MouseEvent with the pointer fields stands in for one.
function pointer(target: EventTarget, type: string, x: number, y: number, buttons: number): void {
  const event = new MouseEvent(type, { clientX: x, clientY: y, buttons, bubbles: true, cancelable: true });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  target.dispatchEvent(event);
}

function key(target: EventTarget, code: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { code, shiftKey, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  target.dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
  return event;
}

const games: Game[] = [];

beforeEach(() => {
  // A wide window: the 390 x 520 design is scaled up to fill the height and letterboxed left and right.
  vi.stubGlobal("innerWidth", 1000);
  vi.stubGlobal("innerHeight", 600);
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("matchMedia", (media: string) => Object.assign(new EventTarget(), { media, matches: true }));
  vi.stubGlobal("visualViewport", new EventTarget());
});

afterEach(async () => {
  for (const game of games.splice(0)) if (game.isRunning()) await game.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function start(options: Omit<UiOptions, "pixi" | "root"> = {}, configure?: (game: Game, pixi: ReturnType<typeof pixi2d>) => void) {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 600);
  canvas.setAttribute("aria-label", "A game");
  document.body.append(canvas);
  const pixi = pixi2d({ application: adoptedApplication(canvas), design: { width: 390, minHeight: 520 }, safeArea: false, layers: ["world", "overlay"] });
  const game = await createGame({ canvas, logger: new NullLogger(), plugins: [pixi, ui({ pixi, ...options })] });
  games.push(game);
  const activated: unknown[] = [];
  game.on(ControlActivated, (payload) => void activated.push(payload));
  const removeListener = vi.spyOn(canvas, "removeEventListener");
  /** The canvas's aria-label and aria-description each time Pixi renders a frame. */
  const rendered: string[] = [];
  vi.mocked(pixi.renderer.app.renderer.render).mockImplementation(() => {
    rendered.push(`${canvas.getAttribute("aria-label")} | ${canvas.getAttribute("aria-description")}`);
  });
  configure?.(game, pixi);
  await game.run();
  game.pause();
  const overlay = pixi.renderer.layer("overlay");
  /** Clicks the logical point (x, y) where the player sees it on the screen. */
  const click = (x: number, y: number): void => {
    const at = logicalToScreen(game.resources.get(Viewport), { x, y });
    pointer(canvas, "pointerdown", at.x, at.y, 1);
    game.step();
    pointer(canvas, "pointerup", at.x, at.y, 0);
    game.step();
  };
  return { canvas, pixi, game, overlay, activated, click, removeListener, rendered };
}

describe("ui with pixi2d", () => {
  it("hit-tests in design units under a scaled and letterboxed viewport", async () => {
    const { game, overlay, activated, click, canvas } = await start();
    const viewport = game.resources.get(Viewport);
    expect(viewport.scale).toBeCloseTo(600 / 520);
    expect(viewport.offset.x).toBeGreaterThan(200); // letterboxed

    control(overlay.addChild(new Graphics().rect(0, 0, 100, 40).fill(0)), { id: "play", label: "Play" }).position.set(20, 30);
    click(10, 10); // outside, in the frame
    click(-50, 40); // in the letterbox bar, left of the frame
    expect(activated).toEqual([]);
    click(110, 60);
    expect(activated).toEqual([{ id: "play", via: "pointer" }]);

    const box = listControls(game)[0]!.bounds;
    expect(box).toEqual({ x: 20, y: 30, width: 100, height: 40 });
    // A canvas element the page scaled with CSS still lines up: the engine reads pointers from its client rect.
    expect(canvas.style.width).toBe("1000px");
  });

  it("sets the canvas's aria-label and aria-description, adds no DOM elements, and restores both at stop", async () => {
    const { game, overlay, canvas } = await start({ summary: "Town, 3 coins" });
    const before = document.body.querySelectorAll("*").length;
    control(overlay.addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "buy", label: "Buy potion", disabled: true });
    game.step();
    expect(canvas.getAttribute("aria-label")).toBe("Town, 3 coins");
    expect(canvas.getAttribute("aria-description")).toBe("Press Tab to move between the controls.");

    key(canvas, "Tab");
    game.step();
    expect(game.resources.get(UiFocus).id).toBe("buy");
    expect(canvas.getAttribute("aria-description")).toBe("Focused: Buy potion, unavailable");

    const sheet = modalScope(overlay.addChild(new Container()), { label: "Shop" });
    control(sheet.addChild(new Graphics().rect(0, 100, 50, 50).fill(0)), { id: "close", label: "Close" });
    game.step();
    expect(canvas.getAttribute("aria-label")).toBe("Shop");
    expect(canvas.getAttribute("aria-description")).toBe("Press Tab to move between the controls.");
    expect(document.body.querySelectorAll("*").length).toBe(before);

    await game.stop();
    expect(canvas.getAttribute("aria-label")).toBe("A game");
    expect(canvas.hasAttribute("aria-description")).toBe(false);
  });

  it("claims Tab inside the DOM event only while a control is next, so Tab leaves the canvas past either end", async () => {
    const { game, overlay, canvas } = await start();
    control(overlay.addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "a", label: "A" });
    game.step();
    // Two frames per key: a key tapped between two frames is held for one, then released.
    expect(key(canvas, "Tab").defaultPrevented).toBe(true);
    game.step(1 / 60, 2);
    expect(game.resources.get(UiFocus).id).toBe("a");
    expect(key(canvas, "Tab").defaultPrevented).toBe(false);
    game.step(1 / 60, 2);
    expect(game.resources.get(UiFocus).id).toBeNull();
    // Shift+Tab with Shift held before the canvas had focus: the event decides the direction.
    expect(key(canvas, "Tab", true).defaultPrevented).toBe(true);
    game.step(1 / 60, 2);
    expect(game.resources.get(UiFocus).id).toBe("a");
  });

  it("shows a pointer cursor over an enabled control only, and restores the cursor at stop", async () => {
    const { game, overlay, canvas } = await start();
    await game.stop();
    canvas.style.cursor = "crosshair"; // the page's own cursor, saved when the run starts
    await game.run();
    game.pause();
    control(overlay.addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "on", label: "On" });
    control(overlay.addChild(new Graphics().rect(100, 0, 50, 50).fill(0)), { id: "off", label: "Off", disabled: true });
    const move = (x: number, y: number): string => {
      const at = logicalToScreen(game.resources.get(Viewport), { x, y });
      pointer(canvas, "pointermove", at.x, at.y, 0);
      game.step();
      return canvas.style.cursor;
    };
    expect(move(10, 10)).toBe("pointer");
    expect(move(110, 10)).toBe("crosshair");
    expect(move(300, 300)).toBe("crosshair");
    expect(move(10, 10)).toBe("pointer");
    await game.stop();
    expect(canvas.style.cursor).toBe("crosshair");
  });

  it("removes its ring and state at stop and leaves no canvas listener behind", async () => {
    const { game, overlay, pixi, canvas } = await start();
    control(overlay.addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "a", label: "A" });
    canvas.focus();
    key(canvas, "Tab");
    game.step();
    const ring = pixi.renderer.root.children.at(-1)!;
    expect(ring.label).toBe("fenrir.ui.focusRing");
    expect(ring.visible).toBe(true);
    await game.stop();
    expect(ring.destroyed).toBe(true);
    // The kit adds no listener of its own: Tab goes through the engine's onDown, which is gone with the run.
    expect(key(canvas, "Tab").defaultPrevented).toBe(false);
  });

  it("fails to install without pixi2d before it, saying how to fix it", async () => {
    const canvas = document.createElement("canvas");
    const pixi = pixi2d({ application: adoptedApplication(canvas) });
    await expect(createGame({ canvas, logger: new NullLogger(), plugins: [ui({ pixi }), pixi] })).rejects.toThrow(/list pixi2d\(\) before ui\(\)/);
  });

  it("draws the first frame, rendered in PostInit, with the controls drawn at Init described", async () => {
    const { rendered } = await start({ summary: "Title" }, (game, pixi) => {
      game.addSystem(Schedule.Init, function draw() {
        control(pixi.renderer.layer("overlay").addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "play", label: "Play" });
      });
      game.addSystem(Schedule.PostInit, function firstFrame() {
        pixi.renderer.render();
      });
    });
    expect(rendered[0]).toBe("Title | Press Tab to move between the controls.");
  });

  it("describes a control drawn in PostInit when the game calls syncUi before rendering", async () => {
    const { rendered } = await start({}, (game, pixi) => {
      game.addSystem(Schedule.PostInit, function drawAndRender(ctx) {
        control(pixi.renderer.layer("overlay").addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "play", label: "Play" });
        Object.assign(ctx.resources.get(UiFocus), { id: "play", visible: true });
        syncUi(ctx);
        pixi.renderer.render();
      });
    });
    expect(rendered[0]).toBe("A game | Focused: Play");
  });

  it("renders a scope opened and focus moved in Update in that same frame", async () => {
    let open = false;
    const { game, rendered } = await start({}, (game, pixi) => {
      game.addSystem(Schedule.Update, function openSheet(ctx) {
        const overlay = pixi.renderer.layer("overlay");
        if (!open || overlay.children.length) return;
        const sheet = modalScope(overlay.addChild(new Container()), { label: "Shop" });
        control(sheet.addChild(new Graphics().rect(0, 0, 50, 50).fill(0)), { id: "close", label: "Close" });
        ctx.resources.get(UiFocus).id = "close";
      });
    });
    game.step();
    open = true;
    game.step();
    expect(rendered.at(-1)).toBe("Shop | Focused: Close");
  });

  it("falls back to the canvas's own label when summary returns nothing", async () => {
    let text: string | undefined = "Round 1";
    const { game, canvas } = await start({ summary: () => text });
    game.step();
    expect(canvas.getAttribute("aria-label")).toBe("Round 1");
    text = undefined;
    game.step();
    expect(canvas.getAttribute("aria-label")).toBe("A game");
  });
});

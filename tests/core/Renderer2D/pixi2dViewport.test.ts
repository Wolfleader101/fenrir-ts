import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Application } from "pixi.js";
import { createGame } from "@/core/Game";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { pixi2d } from "@/core/Renderer2D";
import type { Pixi2DOptions } from "@/core/Renderer2D";
import { Viewport, ViewportResized, type ViewportInsets } from "@/core/Renderer2D/Viewport";

// jsdom has no layout engine: window size, pixel ratio, visualViewport, matchMedia and the
// computed safe-area insets are all stubbed, and frames run only when a test calls frame().

const logger = new NullLogger();
const design = { width: 390, minHeight: 520 };

/** A Pixi application that looks initialized on `canvas`, without a GPU. Resizing updates its screen. */
function adoptedApplication(canvas: HTMLCanvasElement) {
  const app = new Application();
  const screen = { width: 400, height: 300 };
  const render = vi.fn();
  const resize = vi.fn((width: number, height: number) => Object.assign(screen, { width, height }));
  Object.assign(app, { renderer: { canvas, screen, resize, render, resolution: 1 } });
  return { app, render, resize, screen };
}

/** requestAnimationFrame as a queue: frame() runs every callback requested before it, in order. */
function stubFrames() {
  let queue = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => (queue.set(++next, callback), next));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
  return {
    frame(): void {
      const callbacks = queue;
      queue = new Map();
      for (const callback of callbacks.values()) callback(0);
    },
    pending: (): number => queue.size,
  };
}

let insets: ViewportInsets;
let mediaQueries: Array<EventTarget & { media: string }>;
let visualViewport: EventTarget;
let frames: ReturnType<typeof stubFrames>;

function setScreen(width: number, height: number, devicePixelRatio = 3): void {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
  vi.stubGlobal("devicePixelRatio", devicePixelRatio);
}

const probe = (): Element | null => document.body.querySelector("div[aria-hidden]");

beforeEach(() => {
  frames = stubFrames();
  setScreen(390, 844);
  insets = { top: 47, right: 0, bottom: 34, left: 0 };
  mediaQueries = [];
  vi.stubGlobal("matchMedia", (media: string) => {
    const query = Object.assign(new EventTarget(), { media, matches: true });
    mediaQueries.push(query);
    return query;
  });
  visualViewport = new EventTarget();
  vi.stubGlobal("visualViewport", visualViewport);
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    if (element !== probe()) return computed(element);
    return {
      paddingTop: `${insets.top}px`,
      paddingRight: `${insets.right}px`,
      paddingBottom: `${insets.bottom}px`,
      paddingLeft: `${insets.left}px`,
    } as CSSStyleDeclaration;
  });
});

/** Games started by a test, stopped after it even when an assertion failed, so none leaks listeners. */
const started: Array<{ stop(): Promise<void> }> = [];

afterEach(async () => {
  for (const game of started.splice(0)) await game.stop();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

async function startGame(options: Pixi2DOptions = { design }) {
  const canvas = document.createElement("canvas");
  const adopted = adoptedApplication(canvas);
  const pixi = pixi2d({ application: adopted.app, ...options });
  const game = await createGame({ canvas, logger, plugins: [pixi] });
  started.push(game);
  const resized = vi.fn();
  game.on(ViewportResized, resized);
  await game.run();
  return { ...adopted, canvas, pixi, game, resized };
}

describe("pixi2d with design", () => {
  it("lays out at startup inside the safe area, capped at maxResolution, and sends one ViewportResized", async () => {
    const { game, pixi, resize, canvas, resized } = await startGame();
    const viewport = game.resources.get(Viewport);

    expect(viewport).toEqual({
      width: 390,
      height: 844 - 81,
      scale: 1,
      offset: { x: 0, y: 47 },
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
      screen: { width: 390, height: 844 },
      resolution: 2,
    });
    expect(resized).toHaveBeenCalledExactlyOnceWith(viewport, expect.anything());
    expect(resize).toHaveBeenCalledExactlyOnceWith(390, 844, 2);
    expect(canvas.style.width).toBe("390px");
    expect(canvas.style.height).toBe("844px");
    expect(pixi.renderer.root.position).toMatchObject({ x: 0, y: 47 });
    expect(pixi.renderer.root.scale).toMatchObject({ x: 1, y: 1 });
    await game.stop();
  });

  it("applies a window resize in the next frame's PreUpdate, before it renders", async () => {
    const { game, pixi, resized, render } = await startGame();
    resized.mockClear();
    setScreen(1440, 900);
    window.dispatchEvent(new Event("resize"));
    expect(resized).not.toHaveBeenCalled();

    const order: string[] = [];
    resized.mockImplementation(() => order.push("resized"));
    render.mockImplementation(() => order.push("render"));
    frames.frame();

    expect(order).toEqual(["resized", "render"]);
    const viewport = resized.mock.calls[0]![0];
    expect(viewport).toMatchObject({ width: 390, height: 520, screen: { width: 1440, height: 900 } });
    expect(game.resources.get(Viewport)).toBe(viewport);
    expect(pixi.renderer.root.x).toBeCloseTo(viewport.offset.x, 9);
    expect(pixi.renderer.root.scale.x).toBeCloseTo(viewport.scale, 9);

    // A second resize to the same size changes nothing, so nothing is sent.
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resized).toHaveBeenCalledOnce();
    await game.stop();
  });

  it("sends one event for a visualViewport resize and none when the size did not change", async () => {
    const { game, resized } = await startGame();
    resized.mockClear();
    visualViewport.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resized).not.toHaveBeenCalled();

    setScreen(390, 700);
    visualViewport.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resized).toHaveBeenCalledOnce();
    expect(resized.mock.calls[0]![0]).toMatchObject({ height: 700 - 81 });
    await game.stop();
  });

  it("follows device-pixel-ratio changes through matchMedia, watching each new ratio", async () => {
    const { game, resized, resize } = await startGame({ design, maxResolution: 4 });
    resized.mockClear();
    expect(mediaQueries.at(-1)!.media).toBe("(resolution: 3dppx)");

    setScreen(390, 844, 1.5);
    mediaQueries.at(-1)!.dispatchEvent(new Event("change"));
    frames.frame();
    expect(resized).toHaveBeenCalledOnce();
    expect(resized.mock.calls[0]![0]).toMatchObject({ resolution: 1.5 });
    expect(resize).toHaveBeenLastCalledWith(390, 844, 1.5);
    expect(mediaQueries.at(-1)!.media).toBe("(resolution: 1.5dppx)");

    setScreen(390, 844, 2);
    mediaQueries.at(-1)!.dispatchEvent(new Event("change"));
    frames.frame();
    expect(resized).toHaveBeenCalledTimes(2);
    expect(resized.mock.calls[1]![0]).toMatchObject({ resolution: 2 });
    await game.stop();
  });

  it("picks up new safe-area insets on resize", async () => {
    const { game, resized } = await startGame();
    resized.mockClear();
    insets = { top: 0, right: 47, bottom: 21, left: 47 };
    setScreen(844, 390);
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resized.mock.calls[0]![0]).toMatchObject({ insets, height: 520, scale: 369 / 520 });
    await game.stop();
  });

  it("applies a resize while paused on the following animation frame and renders once", async () => {
    const { game, resized, render } = await startGame();
    resized.mockClear();
    game.pause();
    setScreen(1024, 768);
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    expect(frames.pending()).toBe(1);
    frames.frame();
    expect(resized).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
    expect(frames.pending()).toBe(0);
    await game.stop();
  });

  it("does not render outside the frame loop while running", async () => {
    const { game, render } = await startGame();
    setScreen(1024, 768);
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    // One render: the engine frame's PostUpdate. The paused-game fallback saw nothing left to do.
    expect(render).toHaveBeenCalledOnce();
    await game.stop();
  });

  it("removes every listener and the inset probe when the game stops", async () => {
    const { game, resized, resize } = await startGame();
    expect(probe()).not.toBeNull();
    setScreen(800, 600);
    window.dispatchEvent(new Event("resize"));
    await game.stop();

    expect(probe()).toBeNull();
    expect(frames.pending()).toBe(0);
    resized.mockClear();
    resize.mockClear();
    window.dispatchEvent(new Event("resize"));
    visualViewport.dispatchEvent(new Event("resize"));
    for (const query of mediaQueries) query.dispatchEvent(new Event("change"));
    frames.frame();
    expect(frames.pending()).toBe(0);
    expect(resize).not.toHaveBeenCalled();
    expect(resized).not.toHaveBeenCalled();

    // A new run lays out again and announces it.
    await game.run();
    expect(resized).toHaveBeenCalledOnce();
    await game.stop();
  });

  it("removes listeners when a later startup system fails", async () => {
    const canvas = document.createElement("canvas");
    const { app, resize } = adoptedApplication(canvas);
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: app, design })] });
    game.addSystem(Schedule.PostInit, () => { throw new Error("boom"); }, { name: "fails" });
    await expect(game.run()).rejects.toThrow("boom");

    expect(probe()).toBeNull();
    resize.mockClear();
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resize).not.toHaveBeenCalled();
    expect(frames.pending()).toBe(0);
  });

  it("ignores insets with safeArea: false", async () => {
    const { game } = await startGame({ design, safeArea: false });
    expect(probe()).toBeNull();
    expect(game.resources.get(Viewport)).toMatchObject({
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      height: 844,
      offset: { x: 0, y: 0 },
    });
    await game.stop();
  });

  it("sizes an adopted application and leaves it alive at stop", async () => {
    const { game, app, resize } = await startGame();
    const destroy = vi.spyOn(app, "destroy");
    expect(resize).toHaveBeenCalledWith(390, 844, 2);
    await game.stop();
    expect(destroy).not.toHaveBeenCalled();
    expect(app.stage.children).toEqual([]);
  });

  it("converts client coordinates to design units and back", async () => {
    setScreen(1440, 900, 1);
    const { game, pixi, canvas } = await startGame({ design, safeArea: false });
    canvas.getBoundingClientRect = () => new DOMRect(0, 0, 1440, 900);
    const viewport = game.resources.get(Viewport);

    expect(pixi.renderer.clientToLogical(viewport.offset.x, 0)).toEqual({ x: 0, y: 0 });
    const centre = pixi.renderer.clientToLogical(720, 450)!;
    expect(centre.x).toBeCloseTo(195, 9);
    expect(centre.y).toBeCloseTo(260, 9);
    const back = pixi.renderer.logicalToClient(centre.x, centre.y)!;
    expect(back.x).toBeCloseTo(720, 9);
    expect(back.y).toBeCloseTo(450, 9);
    await game.stop();
  });

  it("rejects a design without a positive size, and width or height beside design", () => {
    expect(() => pixi2d({ design: { width: 0, minHeight: 520 } })).toThrow("positive finite width and minHeight");
    expect(() => pixi2d({ design, width: 800 })).toThrow("Remove width and height");
    expect(() => pixi2d({ maxResolution: 0 })).toThrow("maxResolution must be a positive number");
  });
});

describe("pixi2d without design", () => {
  it("reports the renderer's screen in CSS pixels and attaches no listeners", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const { game, pixi, resize, resized } = await startGame({});
    expect(add.mock.calls.filter(([type]) => type === "resize")).toEqual([]);
    expect(probe()).toBeNull();
    expect(resize).not.toHaveBeenCalled();
    const viewport = game.resources.get(Viewport);
    expect(viewport).toEqual({
      width: 400,
      height: 300,
      scale: 1,
      offset: { x: 0, y: 0 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      screen: { width: 400, height: 300 },
      resolution: 1,
    });
    expect(resized).toHaveBeenCalledExactlyOnceWith(viewport, expect.anything());

    // A window resize does nothing; a resize the game makes itself is reported next frame.
    window.dispatchEvent(new Event("resize"));
    frames.frame();
    expect(resized).toHaveBeenCalledOnce();
    pixi.renderer.resize(640, 480);
    frames.frame();
    expect(resized).toHaveBeenCalledTimes(2);
    expect(resized.mock.calls[1]![0]).toMatchObject({ width: 640, height: 480, scale: 1 });
    await game.stop();
  });
});

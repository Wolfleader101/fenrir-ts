import { afterEach, describe, expect, it, vi } from "vitest";
import { Application, Container } from "pixi.js";
import { createGame } from "@/core/Game";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { pixi2d } from "@/core/Renderer2D";
import { inspector } from "@/core/Inspect";

/** A Pixi application that looks initialized on `canvas`, without a GPU. */
function adoptedApplication(canvas: HTMLCanvasElement) {
  const app = new Application();
  const render = vi.fn();
  Object.assign(app, { renderer: { canvas, screen: { width: 400, height: 300 }, resize: vi.fn(), render } });
  return { app, render };
}

function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return { frame: () => callback?.(performance.now()) };
}

const logger = new NullLogger();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pixi2d", () => {
  it("registers the renderer's systems under fenrir.pixi names", async () => {
    const canvas = document.createElement("canvas");
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: adoptedApplication(canvas).app }), inspector()] });
    // The names are stable, so game systems can order against them.
    function movePlayer() {}
    game.addSystem(Schedule.PostUpdate, movePlayer, { before: "fenrir.pixi.postUpdate" });
    expect(game.inspect().schedule.update).toEqual([]);
    expect(() => game.removeSystem("fenrir.pixi.postUpdate")).not.toThrow();
    for (const name of ["fenrir.pixi.init", "fenrir.pixi.exit"]) {
      expect(() => game.replaceSystem(name, () => {})).not.toThrow();
    }
  });

  it("adopts an application the app owns, renders it each frame and leaves it alive at stop", async () => {
    const { frame } = stubFrames();
    const canvas = document.createElement("canvas");
    const { app, render } = adoptedApplication(canvas);
    const destroy = vi.spyOn(app, "destroy");
    const existing = app.stage.addChild(new Container());
    const pixi = pixi2d({ application: app });
    const game = await createGame({ canvas, logger, plugins: [pixi, inspector()] });

    await game.run();
    expect(pixi.renderer.app).toBe(app);
    frame();
    expect(render).toHaveBeenCalled();
    await game.stop();
    expect(destroy).not.toHaveBeenCalled();
    expect(app.stage.children).toEqual([existing]);
  });

  it("rolls startup back when an adopted application's ticker is still running", async () => {
    stubFrames();
    const canvas = document.createElement("canvas");
    const { app } = adoptedApplication(canvas);
    Object.assign(app, { ticker: { started: true } });
    const exit = vi.fn();
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: app }), inspector()] });
    game.addSystem(Schedule.Exit, exit, { name: "exit" });
    await expect(game.run()).rejects.toThrow("Stop the supplied Pixi application's ticker");
    expect(exit).toHaveBeenCalledOnce();
  });

  it("rejects an adopted application on a different canvas at startup", async () => {
    stubFrames();
    const { app } = adoptedApplication(document.createElement("canvas"));
    const game = await createGame({ canvas: document.createElement("canvas"), logger, plugins: [pixi2d({ application: app }), inspector()] });
    await expect(game.run()).rejects.toThrow("must be initialized for the engine canvas");
  });

  it("makes the renderer reachable only after install, and installs into one game only", async () => {
    const canvas = document.createElement("canvas");
    const pixi = pixi2d({ application: adoptedApplication(canvas).app });
    expect(() => pixi.renderer).toThrow("pixi2d: the renderer exists once createGame has installed this plugin");
    await createGame({ canvas, logger, plugins: [pixi, inspector()] });
    expect(pixi.renderer).toBeDefined();
    await expect(createGame({ canvas, logger, plugins: [pixi, inspector()] })).rejects.toThrow("already installed in a game");
  });
});

describe("pixi2d background with an adopted application (#66)", () => {
  function withBackground(canvas: HTMLCanvasElement) {
    const adopted = adoptedApplication(canvas);
    const background = { color: 0x000000 as unknown };
    Object.assign(adopted.app.renderer, { background });
    return { ...adopted, background };
  }

  it("sets the adopted application's clear colour when Init runs", async () => {
    stubFrames();
    const canvas = document.createElement("canvas");
    const { app, background } = withBackground(canvas);
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: app, background: 0x092c36 }), inspector()] });
    expect(background.color).toBe(0x000000); // nothing changes at install
    await game.run();
    expect(background.color).toBe(0x092c36);
    await game.stop();
  });

  it("leaves the adopted application's clear colour alone without background", async () => {
    stubFrames();
    const canvas = document.createElement("canvas");
    const { app, background } = withBackground(canvas);
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: app }), inspector()] });
    await game.run();
    expect(background.color).toBe(0x000000);
    await game.stop();
  });
});

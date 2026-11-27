// Benchmarks for the UI kit's display-tree walk. Run with `pnpm bench`.
// Not part of `pnpm test:run` or CI: numbers depend on the machine, so nothing here asserts on
// them. Compare runs on the same machine before and after a change.
import { bench, describe, vi } from "vitest";
import { Application, Container, Graphics } from "pixi.js";
import { createGame, createTestGame, defineAction } from "@/index";
import { pixi2d } from "@/2d";
import { NullLogger } from "@/core/NullLogger";
import { control, ui } from "@/ui";

const Tab = defineAction("bench.tab", ["Tab"]);

/** A HUD of 3000 nodes: 60 rows of 49 decorations and one control each. */
async function hud() {
  const root = new Container();
  for (let row = 0; row < 60; row++) {
    const line = root.addChild(new Container());
    for (let i = 0; i < 49; i++) line.addChild(new Container());
    control(line.addChild(new Graphics().rect(0, 0, 10, 10).fill(0)), { id: `bench.${row}`, label: `Row ${row}` });
  }
  const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [ui({ root })] });
  await game.start();
  return game;
}

const idle = await hud();
const typing = await hud();

describe("ui kit, 3000 nodes", () => {
  bench("a frame with no input", () => {
    idle.step();
  });

  bench("a frame with a key press", () => {
    typing.input.press(Tab);
    typing.input.release(Tab);
    typing.step();
  });
});

// A pixi2d game without a GPU, as tests/core/UI/uiPixi.test.ts builds one.
vi.stubGlobal("requestAnimationFrame", () => 1);
vi.stubGlobal("cancelAnimationFrame", () => {});
vi.stubGlobal("matchMedia", (media: string) => Object.assign(new EventTarget(), { media, matches: true }));
vi.stubGlobal("visualViewport", new EventTarget());

/** 3000 world sprites in the "world" layer and the 60 controls in "hud", walked with or without `layers`. */
async function world(layers?: readonly string[]) {
  const canvas = document.createElement("canvas");
  const app = new Application();
  const screen = { width: 400, height: 300 };
  Object.assign(app, { renderer: { canvas, screen, resolution: 1, render: () => {}, resize: (width: number, height: number) => Object.assign(screen, { width, height }) } });
  const pixi = pixi2d({ application: app, safeArea: false, layers: ["world", "hud"] });
  const game = await createGame({ canvas, logger: new NullLogger(), plugins: [pixi, ui({ pixi, layers })] });
  await game.run();
  game.pause();
  const sprites = pixi.renderer.layer("world");
  for (let i = 0; i < 3000; i++) sprites.addChild(new Container());
  const hud = pixi.renderer.layer("hud");
  for (let row = 0; row < 60; row++) {
    control(hud.addChild(new Graphics().rect(0, row * 12, 10, 10).fill(0)), { id: `bench.${row}`, label: `Row ${row}` });
  }
  /** Taps Tab on the canvas, as the browser would, then runs a frame. */
  const tab = (): void => {
    canvas.dispatchEvent(new KeyboardEvent("keydown", { code: "Tab", bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new KeyboardEvent("keyup", { code: "Tab", bubbles: true }));
    game.step();
  };
  return Object.assign(game, { tab });
}

const everything = await world();
const hudOnly = await world(["hud"]);
const everythingTyping = await world();
const hudOnlyTyping = await world(["hud"]);

describe("ui kit, 3000 world sprites and 60 controls in a hud layer", () => {
  bench("no layers, a frame with no input", () => {
    everything.step();
  });

  bench("layers: [\"hud\"], a frame with no input", () => {
    hudOnly.step();
  });

  bench("no layers, a frame with a key press", () => {
    everythingTyping.tab();
  });

  bench("layers: [\"hud\"], a frame with a key press", () => {
    hudOnlyTyping.tab();
  });
});

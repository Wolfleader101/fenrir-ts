import { afterEach, beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Application } from "pixi.js";

// A 2D game imports fenrir-ts and fenrir-ts/2d only. Each of these throws if either reaches another peer.
vi.mock("three", () => {
  throw new Error("a 2D game imported three");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("a 2D game imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("a 2D game imported monaco-editor");
});

let core: typeof import("@/index");
let twoD: typeof import("@/2d");

beforeAll(async () => {
  core = await import("@/index");
  twoD = await import("@/2d");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return () => callback?.(performance.now());
}

/** An initialized-looking Pixi application, since jsdom has no GPU. */
function ownedApplication(canvas: HTMLCanvasElement): Application {
  const app = new Application();
  Object.assign(app, { renderer: { canvas, screen: { width: 390, height: 520 }, resize: vi.fn(), render: vi.fn(), background: { color: 0 } } });
  return app;
}

describe("createGame with pixi2d, through the public entry points", () => {
  it("boots a 2D game, runs named and ordered systems, and draws with Pixi directly", async () => {
    const { createGame, defineComponent, NullLogger, Schedule } = core;
    const { pixi2d, Renderable2D } = twoD;
    const frame = stubFrames();
    const canvas = document.createElement("canvas");

    type Velocity = { x: number };
    const Velocity = defineComponent<Velocity>("publicApi.Velocity");
    const MOVING = [Velocity] as const;
    const order: string[] = [];

    const pixi = pixi2d({ application: ownedApplication(canvas), background: 0x101820 });
    const game = await createGame({ canvas, plugins: [pixi], logger: new NullLogger() });
    expectTypeOf(game).toEqualTypeOf<import("@/index").Game>();

    game
      .addSystem(Schedule.Init, function spawn({ entities }) {
        const ball = entities.createEntity();
        entities.set(ball, Velocity, { x: 1 });
        core.EntityBuilder.create().renderCircle(5, { fillColor: 0xff0000 }).spawn(entities);
      })
      .addSystem(Schedule.Update, function applyDamage() { order.push("applyDamage"); }, { after: "movePlayer" })
      .addSystem(Schedule.Update, function movePlayer({ entities }) {
        order.push("movePlayer");
        entities.each(MOVING, (_e, velocity) => { velocity.x += 1; });
      });

    await game.run();
    frame();
    expect(order).toEqual(["movePlayer", "applyDamage"]);
    expect(pixi.renderer.app.stage.children.length).toBeGreaterThan(0);
    // The background passed with an adopted application is applied to it (#66).
    expect(pixi.renderer.app.renderer.background.color).toBe(0x101820);
    expect(Renderable2D).toBeDefined();

    game.replaceSystem("applyDamage", () => { order.push("applyDamage v2"); });
    frame();
    expect(order.slice(2)).toEqual(["movePlayer", "applyDamage v2"]);
    await game.stop();
  });

  it("types plugins and system options", () => {
    const plugin: import("@/index").Plugin = { name: "myGame.audio", install: () => {} };
    expectTypeOf(plugin.install).parameter(0).toEqualTypeOf<import("@/index").Game>();
    const options: import("@/index").SystemOptions = { name: "x", before: ["a"], after: "b", runIf: (ctx) => ctx.time.delta > 0 };
    expect(options.name).toBe("x");
  });
});

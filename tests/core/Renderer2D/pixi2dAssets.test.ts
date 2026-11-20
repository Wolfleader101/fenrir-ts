import { afterEach, describe, expect, it, vi } from "vitest";
import { Application, Assets, Container, Sprite, Texture } from "pixi.js";
import { EntityBuilder, Schedule, createGame, defineAssets, getAsset, loadAssets, unloadAssets } from "@/index";
import { pixi2d } from "@/2d";
import { NullLogger } from "@/core/NullLogger";
import type { Entity } from "@/core/ECS";

/** A Pixi application that looks initialized on `canvas`, without a GPU. */
function adoptedApplication(canvas: HTMLCanvasElement) {
  const app = new Application();
  Object.assign(app, { renderer: { canvas, screen: { width: 400, height: 300 }, resize: vi.fn(), render: vi.fn() } });
  return app;
}

function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return { frame: () => callback?.(performance.now()) };
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function sprites(root: Container): Sprite[] {
  const found: Sprite[] = [];
  const visit = (node: Container) => {
    if (node instanceof Sprite) found.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}

const GameAssets = defineAssets("test.pixiAssets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    hero: { kind: "texture2d", src: "img/hero.webp" },
  },
  bundles: { boot: ["logo", "hero"] },
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("an asset manifest in a createGame + pixi2d game", () => {
  it("loads through the default Pixi loader, draws with renderSprite and PixiNode, and unloads through Pixi's cache", async () => {
    const { frame } = stubFrames();
    const logo = new Texture();
    const hero = new Texture();
    const load = vi.spyOn(Assets, "load").mockImplementation((async (url: string) => (url === "img/logo.png" ? logo : hero)) as typeof Assets.load);
    const unload = vi.spyOn(Assets, "unload").mockResolvedValue(undefined);

    const canvas = document.createElement("canvas");
    const pixi = pixi2d({ application: adoptedApplication(canvas) });
    const game = await createGame({ canvas, logger: new NullLogger(), plugins: [pixi] });
    const spawned: Entity[] = [];
    game
      .addSystem(Schedule.PreInit, async function loadBoot(ctx) {
        await loadAssets(ctx, GameAssets, "boot");
      })
      .addSystem(Schedule.Init, function spawn(ctx) {
        // By name through the store, as before, and typed through the manifest.
        spawned.push(EntityBuilder.create().renderSprite("logo").spawn(ctx.entities));
        spawned.push(EntityBuilder.create().transform2D(10, 20).pixiNode(new Sprite(getAsset(ctx, GameAssets, "hero"))).spawn(ctx.entities));
      });

    await game.run();
    expect(load.mock.calls.map(([url]) => url)).toEqual(["img/logo.png", "img/hero.webp"]);
    frame();
    await settle();
    expect(sprites(pixi.renderer.root).map((sprite) => sprite.texture)).toEqual(expect.arrayContaining([logo, hero]));
    expect(game.inspect().resources["test.pixiAssets"]).toMatchObject({ loaded: 2, total: 2, fraction: 1 });

    await game.stop();
    unloadAssets(game, GameAssets, "boot");
    await settle();
    expect(unload.mock.calls.map(([url]) => url).sort()).toEqual(["img/hero.webp", "img/logo.png"]);
  });
});

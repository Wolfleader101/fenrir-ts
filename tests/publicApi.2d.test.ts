import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Texture } from "pixi.js";

// The 2D entry needs pixi.js only. Each of these throws if it reaches another peer.
vi.mock("three", () => {
  throw new Error("fenrir-ts/2d imported three");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/2d imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("fenrir-ts/2d imported monaco-editor");
});

/** `fenrir-ts` plus `fenrir-ts/2d`, imported the way a 2D game does. */
let core: typeof import("@/index");
let twoD: typeof import("@/2d");

beforeAll(async () => {
  core = await import("@/index");
  twoD = await import("@/2d");
});

describe("fenrir-ts/2d public API", () => {
  it("exports layoutViewport, the rule pixi2d lays the design frame out with (#64)", () => {
    const { layoutViewport, logicalToScreen, screenToLogical } = twoD;
    const layout = layoutViewport({ width: 390, minHeight: 520 }, { width: 390, height: 844 }, { top: 47, right: 0, bottom: 34, left: 0 }, 3);
    expect(layout).toEqual({
      width: 390,
      height: 763,
      scale: 1,
      offset: { x: 0, y: 47 },
      insets: { top: 47, right: 0, bottom: 34, left: 0 },
      screen: { width: 390, height: 844 },
      resolution: 3,
    });
    // A design-unit position becomes a click position, and back.
    const point = logicalToScreen(layout, { x: 195, y: 100 });
    expect(point).toEqual({ x: 195, y: 147 });
    expect(screenToLogical(layout, point)).toEqual({ x: 195, y: 100 });
    expectTypeOf(layoutViewport).returns.toEqualTypeOf<import("@/2d").Viewport>();
  });

  it("exports the Pixi renderer and its system", () => {
    expect(twoD.createPixiRendererSystem).toBeTypeOf("function");
    expect(twoD.PixiRenderer).toBeTypeOf("function");
    expect(twoD.createPixiTextureLoader).toBeTypeOf("function");
  });

  it("adds the 2D entity builder methods", () => {
    const { EntityBuilder, EntityList } = core;
    const entities = new EntityList();
    const entity = EntityBuilder.create().renderCircle(5, { fillColor: 0xff0000 }).spawn(entities);

    expect(entities.get(entity, twoD.Renderable2D).graphics).toMatchObject({ shape: "circle", data: { radius: 5 } });
  });

  it("mounts a PixiNode in a named layer and writes Transform2D to it", async () => {
    const { Application, Container } = await import("pixi.js");
    // An adopted application that looks initialized, so no GPU is needed.
    const application = new Application();
    Object.assign(application, { renderer: { screen: { width: 1, height: 1 }, render: vi.fn() } });
    const { EntityBuilder, EntityList } = core;
    const { PixiNode, Transform2D, createPixiRendererSystem } = twoD;
    expect(Transform2D).toBe(core.Transform2D);
    const system = createPixiRendererSystem({ logger: new core.NullLogger(), assets: new core.AssetStore(), application, layers: ["world", "ui"] });
    const entities = new EntityList();
    const ctx = { entities, logger: new core.NullLogger() } as unknown as import("@/index").SystemCtx;
    await system.init(ctx);

    const card = new Container();
    const entity = EntityBuilder.create().transform2D(30, 40).pixiNode(card, { layer: "ui" }).spawn(entities);
    expectTypeOf(entities.get(entity, PixiNode)).toEqualTypeOf<import("@/2d").PixiNode>();
    system.postUpdate(ctx);
    expect(card.parent).toBe(system.renderer.layer("ui"));
    expect([card.x, card.y]).toEqual([30, 40]);
    expect(() => system.renderer.layer("hud")).toThrow('Declared layers: "world", "ui".');
    system.exit(ctx);
    expect(card.destroyed).toBe(true);
  });

  it("adds 2D texture requests to the core asset store", async () => {
    const { AssetStore, assetKey } = core;
    const assets = new AssetStore();
    expect(assets.getSupportedTexture2DExtensions()).toContain("png");

    assets.registerTexture2DLoader("test", { loader: async () => Texture.EMPTY, extensions: ["test"] });
    const handle = assets.requestTexture2D(assetKey("hero"), "hero.test");
    expectTypeOf(handle).toEqualTypeOf<import("@/2d").Texture2DHandle>();
    expect(handle.state).toEqual({ status: "loading" });
    await expect(handle.ready).resolves.toBe(Texture.EMPTY);
    expect(handle.state).toEqual({ status: "ready", texture: Texture.EMPTY });

    // The 2D entry adds the "texture2d" kind; tests/types/ checks the types per entry.
    await expect(assets.get(assetKey("hero"), "texture2d")).resolves.toBe(Texture.EMPTY);
    expect(assets.kindOf(assetKey("hero"))).toBe("texture2d");
  });

  it("keeps default transforms plain, without Three", () => {
    const { EntityList, Transform } = core;
    const entities = new EntityList();
    expect(entities.get(entities.createEntity(), Transform).position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("lays a design frame out and exposes it as the Viewport resource and ViewportResized event", async () => {
    const { Schedule, createGame, NullLogger } = core;
    const { pixi2d, Viewport, ViewportResized, screenToLogical, logicalToScreen } = twoD;
    vi.stubGlobal("innerWidth", 1440);
    vi.stubGlobal("innerHeight", 900);
    vi.stubGlobal("devicePixelRatio", 3);
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => {});
    try {
      const canvas = document.createElement("canvas");
      const { Application } = await import("pixi.js");
      const application = new Application();
      const screen = { width: 0, height: 0 };
      Object.assign(application, { renderer: { canvas, screen, resolution: 1, render() {}, resize: (w: number, h: number) => Object.assign(screen, { width: w, height: h }) } });

      const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, safeArea: false, application });
      const game = await createGame({ canvas, logger: new NullLogger(), plugins: [pixi] });
      const sizes: number[] = [];
      game.on(ViewportResized, (viewport) => sizes.push(viewport.height));
      let seen: import("@/2d").Viewport | undefined;
      game.addSystem(Schedule.PostInit, function readViewport({ resources }) {
        seen = resources.get(Viewport);
      });
      await game.run();

      expectTypeOf(seen!.scale).toEqualTypeOf<number>();
      expect(seen).toMatchObject({ width: 390, height: 520, scale: 900 / 520, resolution: 2, screen: { width: 1440, height: 900 } });
      expect(sizes).toEqual([520]);
      expect(pixi.renderer.root.scale.x).toBeCloseTo(900 / 520, 9);
      expect(application.stage.children).toEqual([pixi.renderer.backdrop, pixi.renderer.root]);
      // The pointer reads in design units: the frame is 676 px wide, centred, 900 / 520 px per unit.
      game.pause();
      const press = new MouseEvent("pointerdown", { clientX: 720, clientY: 450, buttons: 1 });
      Object.defineProperties(press, { pointerId: { value: 1 }, isPrimary: { value: true } });
      canvas.dispatchEvent(press);
      game.step();
      expect(game.input.pointer.x).toBeCloseTo(195, 9);
      expect(game.input.pointer.y).toBeCloseTo(260, 9);
      expect(game.input.pointer.down).toBe(true);

      const logical = screenToLogical(seen!, { x: 720, y: 450 })!;
      expect(logical.x).toBeCloseTo(195, 9);
      expect(logicalToScreen(seen!, logical).x).toBeCloseTo(720, 9);
      await game.stop();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

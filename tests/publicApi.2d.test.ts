import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Texture } from "pixi.js";

// The 2D entry needs pixi.js only. Each of these throws if it reaches another peer.
vi.mock("three", () => {
  throw new Error("fenrir-ts/2d imported three");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/2d imported jolt-physics");
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

  it("adds nothing to EntityBuilder", () => {
    const prototype = core.EntityBuilder.prototype as unknown as Record<string, unknown>;
    for (const method of ["pixiNode", "renderSprite", "renderCircle", "renderRect", "renderText"]) {
      expect(prototype[method]).toBeUndefined();
    }
  });

  it("builds Renderable2D values with sprite2D, circle2D, rect2D and text2D, each with its own id", () => {
    const { EntityBuilder, EntityList } = core;
    const { Renderable2D, circle2D, rect2D, sprite2D, text2D } = twoD;
    const entities = new EntityList();
    const flags = { alpha: 0.5, zIndex: 2 };
    const sprite = EntityBuilder.create().with(Renderable2D, sprite2D("hero.png", { anchor: [0.5, 1], tint: 0xff00ff, flags })).spawn(entities);
    const circle = EntityBuilder.create().with(Renderable2D, circle2D(5, { fillColor: 0xff0000, strokeColor: 0x00ff00, strokeWidth: 2 })).spawn(entities);
    const rect = EntityBuilder.create().with(Renderable2D, rect2D(40, 10, { fillColor: 0x0000ff, flags })).spawn(entities);
    const text = EntityBuilder.create().with(Renderable2D, text2D("Score: 0", { style: { fontSize: 24, fill: 0xffffff } })).spawn(entities);

    expect(entities.get(sprite, Renderable2D)).toMatchObject({ sprite: { kind: "sprite", texture: "hero.png", anchor: [0.5, 1], tint: 0xff00ff }, flags });
    expect(entities.get(circle, Renderable2D)).toMatchObject({
      graphics: { kind: "graphics", shape: "circle", fillColor: 0xff0000, strokeColor: 0x00ff00, strokeWidth: 2, data: { x: 0, y: 0, radius: 5 } },
    });
    // A rectangle is centred on the entity's position.
    expect(entities.get(rect, Renderable2D)).toMatchObject({ graphics: { kind: "graphics", shape: "rect", fillColor: 0x0000ff, data: { x: -20, y: -5, width: 40, height: 10 } }, flags });
    expect(entities.get(text, Renderable2D)).toMatchObject({ text: { kind: "text", content: "Score: 0", style: { fontSize: 24, fill: 0xffffff } } });
    const ids = [sprite, circle, rect, text].map((entity) => entities.get(entity, Renderable2D).id);
    expect(new Set(ids).size).toBe(4);
    expectTypeOf(circle2D(1)).toEqualTypeOf<import("@/2d").Renderable2D>();
  });

  it("mounts a PixiNode in a named layer or the backdrop and writes Transform2D and Display2D to it", async () => {
    const { Application, Container } = await import("pixi.js");
    // An adopted application that looks initialized, so no GPU is needed.
    const application = new Application();
    Object.assign(application, { renderer: { screen: { width: 1, height: 1 }, render: vi.fn() } });
    const { EntityBuilder, EntityList } = core;
    const { Display2D, PixiNode, Transform2D, createPixiRendererSystem } = twoD;
    expect(Transform2D).toBe(core.Transform2D);
    expect(Display2D).toBe(core.Display2D);
    const system = createPixiRendererSystem({ logger: new core.NullLogger(), assets: new core.AssetStore(), application, layers: ["world", "ui"] });
    const entities = new EntityList();
    const ctx = { entities, logger: new core.NullLogger() } as unknown as import("@/index").SystemCtx;
    await system.init(ctx);

    const card = new Container();
    const entity = EntityBuilder.create().transform2D(30, 40).display2D({ alpha: 0.5 }).with(PixiNode, { node: card, layer: "ui" }).spawn(entities);
    const sky = new Container();
    EntityBuilder.create().with(PixiNode, { node: sky, layer: "fenrir.backdrop" }).spawn(entities);
    expectTypeOf(entities.get(entity, PixiNode)).toEqualTypeOf<import("@/2d").PixiNode>();
    system.postUpdate(ctx);
    expect(card.parent).toBe(system.renderer.layer("ui"));
    expect([card.x, card.y, card.alpha]).toEqual([30, 40, 0.5]);
    expect(sky.parent).toBe(system.renderer.backdrop);
    expect(() => system.renderer.layer("hud")).toThrow('Declared layers: "world", "ui".');
    system.exit(ctx);
    expect(card.destroyed).toBe(true);
  });

  it("adds 2D textures to the core asset store as functions, patching nothing", async () => {
    const { AssetStore, assetKey, createTestGame } = core;
    const { getSupportedTexture2DExtensions, getTexture2D, loadTexture2D, registerTexture2DLoader, requestTexture2D } = twoD;
    for (const method of ["requestTexture2D", "loadTexture2D", "getTexture2D", "registerTexture2DLoader", "getSupportedTexture2DExtensions"]) {
      expect(method in AssetStore.prototype, method).toBe(false);
    }

    // The functions take a ctx, the game or anything with its assets.
    const game = await createTestGame({ seed: 1 });
    expect(getSupportedTexture2DExtensions(game)).toEqual(["bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]);
    registerTexture2DLoader(game, "test", { loader: async () => Texture.EMPTY, extensions: ["test"] });
    expect(getSupportedTexture2DExtensions(game)).toContain("test");

    const handle = requestTexture2D(game, assetKey("hero"), "hero.test");
    expectTypeOf(handle).toEqualTypeOf<import("@/2d").Texture2DHandle>();
    expect(handle.state).toEqual({ status: "loading" });
    expect(requestTexture2D(game, assetKey("hero"), "hero.test")).toBe(handle);
    await expect(handle.ready).resolves.toBe(Texture.EMPTY);
    expect(handle.state).toEqual({ status: "ready", texture: Texture.EMPTY });

    await expect(loadTexture2D(game, assetKey("tile"), "tile.test")).resolves.toBeUndefined();
    await expect(getTexture2D(game, assetKey("tile"))).resolves.toBe(Texture.EMPTY);
    expectTypeOf(getTexture2D(game, assetKey("tile"))).toEqualTypeOf<Promise<Texture>>();
    await expect(getTexture2D(game, assetKey("none"))).rejects.toThrow("Asset not loaded: none");

    // The 2D entry adds the "texture2d" kind; tests/types/ checks the types per entry.
    await expect(game.assets.get(assetKey("hero"), "texture2d")).resolves.toBe(Texture.EMPTY);
    expect(game.assets.kindOf(assetKey("hero"))).toBe("texture2d");

    // A bare store works too.
    const assets = new AssetStore();
    expect(getSupportedTexture2DExtensions({ assets })).toContain("png");
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

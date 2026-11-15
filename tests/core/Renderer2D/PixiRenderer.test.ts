import { describe, expect, it, vi } from "vitest";
import { Application, Container, Graphics, Sprite, Texture } from "pixi.js";
import { AssetStore } from "../../../src/core/Assets/AssetStore";
import { NullLogger } from "../../../src/core/NullLogger";
import { PixiRenderer, Renderable2D, createPixiRendererSystem } from "../../../src/core/Renderer2D";
import { createMockSystemCtx } from "../../utils/testHelpers";

function setup() {
  const canvas = document.createElement("canvas");
  canvas.getBoundingClientRect = () => new DOMRect(20, 40, 200, 150);
  const app = new Application();
  Object.assign(app, { renderer: { canvas, screen: { width: 400, height: 300 }, resize: vi.fn(), render: vi.fn() } });
  const assets = new AssetStore();
  const opts = { application: app, canvas, assets, logger: new NullLogger() };
  return { app, canvas, assets, opts };
}

describe("Pixi ownership and renderable lifecycle", () => {
  it("uses the caller's application and preserves its canvas and stage contents at exit", async () => {
    const { app, canvas, opts } = setup();
    const destroy = vi.spyOn(app, "destroy");
    const stageContent = app.stage.addChild(new Container());
    const renderer = new PixiRenderer(opts);
    await renderer.init();
    expect(renderer.app).toBe(app);
    expect(renderer.app.canvas).toBe(canvas);
    expect(renderer.clientToLogical(120, 115)).toEqual({ x: 200, y: 150 });
    renderer.resize(400, 300, 2);
    expect(app.renderer.resize).toHaveBeenCalledExactlyOnceWith(400, 300, 2);
    renderer.dispose();
    expect(destroy).not.toHaveBeenCalled();
    expect(app.stage.children).toEqual([stageContent]);
  });

  it("mounts children created before their parent and reparents when ownership changes", async () => {
    const { app, opts } = setup();
    const { entities } = createMockSystemCtx();
    const renderer = new PixiRenderer(opts);
    await renderer.init();

    const first = entities.createEntity();
    const second = entities.createEntity();
    const child = entities.createEntity();
    await renderer.upsertRenderable(entities, child, { id: 1, graphics: { kind: "graphics", shape: "rect", data: { x: 0, y: 0, width: 10, height: 10 } } });
    await renderer.upsertRenderable(entities, first, { id: 1, container: { kind: "container", children: [child] } });
    await renderer.upsertRenderable(entities, second, { id: 1, container: { kind: "container" } });
    renderer.syncTransforms(entities);
    const view = renderer.getRenderedObject(child, 1)!;
    expect(view).toBeInstanceOf(Graphics);
    expect(view.parent).toBe(renderer.getRenderedObject(first, 1));

    entities.addChild(second, child);
    renderer.syncTransforms(entities);
    expect(view.parent).toBe(renderer.getRenderedObject(second, 1));
    renderer.removeRenderable(second, 1);
    expect(view.destroyed).toBe(false);
    expect(view.parent).toBe(app.stage);
    renderer.dispose();
  });

  it("drops stale sprite requests and detaches component listeners on exit", async () => {
    const { app, assets, opts } = setup();
    let load!: (texture: Texture) => void;
    vi.spyOn(assets, "getTexture2D").mockImplementationOnce(() => new Promise((resolve) => { load = resolve; }))
      .mockResolvedValueOnce(Texture.EMPTY);
    const system = createPixiRendererSystem(opts);
    const ctx = createMockSystemCtx();
    await system.init(ctx);

    const entity = ctx.entities.createEntity();
    const def = { id: 1, sprite: { kind: "sprite" as const, texture: "fish" } };
    ctx.entities.set(entity, Renderable2D, def);
    ctx.entities.set(entity, Renderable2D, { ...def, sprite: { ...def.sprite, texture: "new-fish" } });
    await Promise.resolve();
    const newer = system.renderer.getRenderedObject(entity, 1);
    expect(newer).toBeInstanceOf(Sprite);
    const oldTexture = Texture.WHITE;
    load(oldTexture);
    await Promise.resolve();
    expect((newer as Sprite).texture).toBe(Texture.EMPTY);

    let loadRemoved!: (texture: Texture) => void;
    vi.spyOn(assets, "getTexture2D").mockImplementationOnce(() => new Promise((resolve) => { loadRemoved = resolve; }));
    const removed = ctx.entities.createEntity();
    ctx.entities.set(removed, Renderable2D, def);
    ctx.entities.destroyEntity(removed);
    loadRemoved(oldTexture);
    await Promise.resolve();
    expect(system.renderer.getRenderedObject(removed, 1)).toBeUndefined();
    expect(app.stage.children).toEqual([newer]);

    system.exit(ctx);
    const upsert = vi.spyOn(system.renderer, "upsertRenderable");
    ctx.entities.set(entity, Renderable2D, def);
    expect(upsert).not.toHaveBeenCalled();
    expect(app.stage.children).toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { Application, Container, Graphics } from "pixi.js";
import { AssetStore } from "@/core/Assets/AssetStore";
import { Transform } from "@/core/ECS/DefaultComponents";
import { Transform2D } from "@/core/ECS/Transform2D";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import "@/core/EntityBuilder/extensions/coreExtensions";
import "@/core/EntityBuilder/extensions/render2DExtensions";
import { createGame } from "@/core/Game";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { PixiNode, Renderable2D, createPixiRendererSystem, pixi2d } from "@/core/Renderer2D";
import type { SystemCtx } from "@/core/SystemCtx";
import { createMockSystemCtx } from "../../utils/testHelpers";

const logger = new NullLogger();

/** A Pixi application that looks initialized, without a GPU. */
function fakeApplication(canvas = document.createElement("canvas")) {
  const app = new Application();
  const render = vi.fn();
  Object.assign(app, { renderer: { canvas, screen: { width: 400, height: 300 }, resize: vi.fn(), render } });
  return { app, canvas, render };
}

function setup(layers?: readonly string[]) {
  const { app } = fakeApplication();
  const system = createPixiRendererSystem({ application: app, assets: new AssetStore(), logger, layers });
  const ctx = createMockSystemCtx();
  return { system, ctx, renderer: system.renderer, entities: ctx.entities };
}

const at = (x: number, y: number, rotation = 0, scaleX = 1, scaleY = 1): Transform2D => ({ x, y, rotation, scaleX, scaleY });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PixiNode and Transform2D", () => {
  it("writes Transform2D to the node each frame and parents a child entity under its parent's node", async () => {
    const { system, ctx, renderer, entities } = setup(["world"]);
    await system.init(ctx);
    const ship = new Container();
    const flag = new Graphics();
    const parent = entities.createEntity();
    entities.set(parent, Transform2D, at(10, 20, 0.5, 2, 3));
    entities.set(parent, PixiNode, { node: ship, layer: "world" });
    const child = entities.createEntity();
    entities.addChild(parent, child);
    entities.set(child, Transform2D, at(1, 2));
    entities.set(child, PixiNode, { node: flag, layer: "world" });

    system.postUpdate(ctx);
    expect(ship.parent).toBe(renderer.layer("world"));
    expect([ship.x, ship.y, ship.rotation, ship.scale.x, ship.scale.y]).toEqual([10, 20, 0.5, 2, 3]);
    expect(flag.parent).toBe(ship);
    expect([flag.x, flag.y]).toEqual([1, 2]);

    entities.get(parent, Transform2D).x = 50;
    system.postUpdate(ctx);
    expect(ship.x).toBe(50);

    entities.removeChild(parent, child);
    system.postUpdate(ctx);
    expect(flag.parent).toBe(renderer.layer("world"));
  });

  it("leaves a node's own transform alone when the entity has no Transform2D, even with the default Transform", async () => {
    const { system, ctx, entities } = setup();
    await system.init(ctx);
    const node = new Container({ x: 7, y: 9 });
    const entity = entities.createEntity();
    expect(entities.has(entity, Transform)).toBe(true);
    entities.set(entity, PixiNode, { node });
    system.postUpdate(ctx);
    expect([node.x, node.y]).toEqual([7, 9]);
  });

  it("mounts a Renderable2D child under a node, and prefers Transform2D over Transform on a renderable", async () => {
    const { system, ctx, renderer, entities } = setup();
    await system.init(ctx);
    const node = new Container();
    const parent = EntityBuilder.create().pixiNode(node).spawn(entities);
    const dot = EntityBuilder.create().transform({ x: 99, y: 99, z: 0 }).transform2D(3, 4).renderCircle(2).spawnInto(entities, parent);
    system.postUpdate(ctx);
    const view = renderer.getRenderedObject(dot, entities.get(dot, Renderable2D).id)!;
    expect(view.parent).toBe(node);
    expect([view.x, view.y]).toEqual([3, 4]);

    // Removing the parent's node spares the child's view.
    entities.remove(parent, PixiNode);
    expect(node.destroyed).toBe(true);
    expect(view.destroyed).toBe(false);
    system.postUpdate(ctx);
    expect(view.parent).toBe(renderer.root);
  });

  it("orders layers back to front under root and names the declared layers for an unknown one", async () => {
    const { system, ctx, renderer, entities } = setup(["back", "world", "ui"]);
    expect(renderer.root.children.map((c) => c.label)).toEqual(["fenrir.layer.back", "fenrir.layer.world", "fenrir.layer.ui"]);
    expect(renderer.layer("ui").sortableChildren).toBe(true);
    await system.init(ctx);

    const entity = entities.createEntity();
    expect(() => entities.set(entity, PixiNode, { node: new Container(), layer: "fx" })).toThrow(
      'pixi2d: unknown layer "fx". Declared layers: "back", "world", "ui".',
    );
    expect(() => setup().renderer.layer("ui")).toThrow('pixi2d: unknown layer "ui". No layers are declared; pass pixi2d({ layers: [...] }).');
    expect(() => setup(["a", "a"])).toThrow("layers must be unique, non-empty names");
    expect(() => setup([""])).toThrow("layers must be unique, non-empty names");
  });

  it("rejects the run when an entity spawned before it names an unknown layer", async () => {
    const { app, canvas } = fakeApplication();
    const game = await createGame({ canvas, logger, plugins: [pixi2d({ application: app, layers: ["world"] })] });
    game.addSystem(Schedule.PreInit, ({ entities }: SystemCtx) => {
      entities.set(entities.createEntity(), PixiNode, { node: new Container(), layer: "hud" });
    }, { name: "test.spawn" });
    await expect(game.run()).rejects.toThrow('unknown layer "hud". Declared layers: "world".');
  });

  it("destroys the node when the component or the entity goes, children included", async () => {
    const { system, ctx, renderer, entities } = setup();
    await system.init(ctx);
    const removed = new Container();
    const art = removed.addChild(new Graphics());
    const a = EntityBuilder.create().pixiNode(removed).spawn(entities);
    entities.remove(a, PixiNode);
    expect(removed.destroyed).toBe(true);
    expect(art.destroyed).toBe(true);

    const parentNode = new Container();
    const childNode = new Container();
    const parent = EntityBuilder.create().pixiNode(parentNode).child((c) => c.pixiNode(childNode)).spawn(entities);
    system.postUpdate(ctx);
    expect(childNode.parent).toBe(parentNode);
    entities.destroyEntity(parent);
    expect([parentNode.destroyed, childNode.destroyed]).toEqual([true, true]);
    expect(renderer.root.children).toEqual([]);

    // Replacing the node destroys the old one; setting the same node again does not.
    const first = new Container();
    const second = new Container();
    const b = entities.createEntity();
    entities.set(b, PixiNode, { node: first });
    entities.set(b, PixiNode, { node: first, keep: false });
    expect(first.destroyed).toBe(false);
    entities.set(b, PixiNode, { node: second });
    expect(first.destroyed).toBe(true);
    expect(second.parent).toBe(renderer.root);
  });

  it("keeps a node with keep: true alive and only unmounts it", async () => {
    const { system, ctx, entities } = setup();
    await system.init(ctx);
    const node = new Container();
    const entity = EntityBuilder.create().pixiNode(node, { keep: true }).spawn(entities);
    system.postUpdate(ctx);
    entities.destroyEntity(entity);
    expect(node.destroyed).toBe(false);
    expect(node.parent).toBeNull();
  });

  it("refuses one node on two entities", async () => {
    const { system, ctx, entities } = setup();
    await system.init(ctx);
    const node = new Container();
    const first = entities.createEntity();
    entities.set(first, PixiNode, { node });
    expect(() => entities.set(entities.createEntity(), PixiNode, { node })).toThrow(`this node already belongs to entity ${first}`);
  });

  it("destroys nodes at stop and remounts only kept ones on the next run, once", async () => {
    const { system, ctx, renderer, entities } = setup(["world"]);
    await system.init(ctx);
    const owned = new Container();
    const kept = new Container();
    const a = EntityBuilder.create().pixiNode(owned, { layer: "world" }).spawn(entities);
    const b = EntityBuilder.create().transform2D(5, 6).pixiNode(kept, { layer: "world", keep: true }).spawn(entities);
    system.postUpdate(ctx);

    system.exit(ctx);
    expect(owned.destroyed).toBe(true);
    expect(entities.has(a, PixiNode)).toBe(false);
    expect(kept.destroyed).toBe(false);
    expect(kept.parent).toBeNull();
    expect(entities.get(b, PixiNode).node).toBe(kept);
    // Listeners are gone after stop: removing a component no longer reaches the renderer.
    entities.remove(b, PixiNode);
    expect(kept.destroyed).toBe(false);
    entities.set(b, PixiNode, { node: kept, layer: "world", keep: true });

    for (let run = 0; run < 2; run++) {
      await system.init(ctx);
      system.postUpdate(ctx);
      expect(renderer.layer("world").children).toEqual([kept]);
      expect([kept.x, kept.y]).toEqual([5, 6]);
      system.exit(ctx);
    }
    expect(renderer.layer("world").children).toEqual([]);
  });

  it("unmounts a scene's nodes without destroying them when another scene becomes active", async () => {
    const { system, ctx, renderer, entities } = setup();
    await system.init(ctx);
    const node = new Container();
    EntityBuilder.create().pixiNode(node).spawn(entities);
    const other = createMockSystemCtx();
    system.postUpdate(other);
    expect(node.destroyed).toBe(false);
    expect(node.parent).toBeNull();
    system.postUpdate(ctx);
    expect(node.parent).toBe(renderer.root);
  });

  it("applies a Transform2D written by an Update system in the same frame, before it renders", async () => {
    let callback: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { app, canvas, render } = fakeApplication();
    const pixi = pixi2d({ application: app, layers: ["world"] });
    const game = await createGame({ canvas, logger, plugins: [pixi] });
    const node = new Container();
    let drawnAt: number | undefined;
    render.mockImplementation(() => { drawnAt = node.x; });

    game
      .addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
        EntityBuilder.create().name("ship").transform2D(0, 0).pixiNode(node, { layer: "world" }).spawn(entities);
      })
      .addSystem(Schedule.Update, function move({ entities }: SystemCtx) {
        entities.each(MOVING, (_e, t) => { t.x += 4; });
      });
    await game.run();
    callback?.(performance.now());
    expect(drawnAt).toBe(4);
    expect(node.parent).toBe(pixi.renderer.layer("world"));

    const ship = game.inspect().entities.find((e) => e.name === "ship")!;
    expect(ship.components["fenrir.Transform2D"]).toEqual({ x: 4, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    expect(ship.components["fenrir.PixiNode"]).toEqual({ node: { $type: "Container" }, layer: "world" });
    expect(JSON.parse(JSON.stringify(game.inspect()))).toEqual(game.inspect());

    await game.stop();
    expect(node.destroyed).toBe(true);
    expect(game.inspect().entities.find((e) => e.name === "ship")!.components["fenrir.PixiNode"]).toBeUndefined();
  });
});

const MOVING = [Transform2D] as const;

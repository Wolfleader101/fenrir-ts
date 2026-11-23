import * as PIXI from "pixi.js";
import type { Entity, EntityList } from "../ECS";
import { Relationship, Transform } from "../ECS/DefaultComponents";
import { Transform2D } from "../ECS/Transform2D";
import { Display2D } from "../ECS/Display2D";
import { PixiNode } from "./PixiNode";
import type {
  Renderable2D,
  SpriteDesc,
  GraphicsDesc,
  Render2DFlags,
} from "./render2DComponents";
import type { ILogger } from "../ILogger";
import type { IAssetStore } from "../Assets/AssetStore";
// Adds getTexture2D and the Pixi texture loader to the asset store.
import "../Assets/Assets2D";
import { identityViewport, logicalToScreen, screenToLogical } from "./Viewport";
import type { Viewport, ViewportPoint } from "./Viewport";

type ObjKey = string;
/** The layer name that mounts a `PixiNode` in `renderer.backdrop`. Declared layer names cannot start with `fenrir.`. */
const BACKDROP = "fenrir.backdrop";
const keyFor = (e: Entity, id: number): string => `${e}:${id}`;

export interface PixiRendererOptions {
  readonly canvas?: HTMLCanvasElement;
  readonly logger: ILogger;
  readonly width?: number;
  readonly height?: number;
  /** Clear colour as 0xRRGGBB. An engine-owned application defaults to 0x101010; an adopted one is set to it at init when given. */
  readonly clearColor?: number;
  readonly assets: IAssetStore;
  /** An initialized application owned by the caller, with its automatic ticker stopped. */
  readonly application?: PIXI.Application;
  /** Initialization options for an engine-owned application. */
  readonly applicationOptions?: Partial<Omit<PIXI.ApplicationOptions, "canvas" | "autoStart" | "sharedTicker">>;
  /** Named layers under `root`, back to front. Names starting with `fenrir.` are reserved. */
  readonly layers?: readonly string[];
}

type NodeEntry = {
  readonly node: PIXI.Container;
  readonly keep: boolean;
  readonly layer: PIXI.Container | undefined;
};

type RenderedObject = {
  entity: Entity;
  renderable: Renderable2D;
  view: PIXI.Container;
};

export class PixiRenderer {
  private readonly options: PixiRendererOptions;
  private application: PIXI.Application;
  private readonly objects = new Map<ObjKey, RenderedObject>();
  private readonly pending = new Map<ObjKey, symbol>();
  private isInitialized = false;
  private viewport: Viewport = identityViewport({ width: 0, height: 0 }, 1);
  private readonly layerMap = new Map<string, PIXI.Container>();
  private readonly nodes = new Map<Entity, NodeEntry>();
  private readonly owners = new Map<PIXI.Container, Entity>();
  private readonly views = new WeakSet<PIXI.Container>();
  /** The entities whose nodes are mounted; `render()` syncs them first. */
  private scene: EntityList | undefined;

  /**
   * Game content, drawn in logical units. `pixi2d` scales and positions it to the design frame;
   * without `design` it is unscaled at the top-left. Entities with `Renderable2D` mount here.
   */
  public readonly root = new PIXI.Container({ label: "fenrir.root" });
  /**
   * Full-bleed content behind `root`, in CSS pixels from the screen's top-left corner, unscaled.
   * Cover `Viewport.screen` to fill the whole screen, outside the frame and the safe area too.
   */
  public readonly backdrop = new PIXI.Container({ label: "fenrir.backdrop" });

  constructor(options: PixiRendererOptions) {
    this.options = options;
    this.application = options.application ?? new PIXI.Application();
    for (const name of options.layers ?? []) {
      if (typeof name !== "string" || name === "" || this.layerMap.has(name) || name.startsWith("fenrir.")) {
        throw new Error(`pixi2d: layers must be unique, non-empty names not starting with "fenrir.", got ${JSON.stringify(options.layers)}.`);
      }
      const layer = new PIXI.Container({ label: `fenrir.layer.${name}`, sortableChildren: true });
      this.layerMap.set(name, layer);
      this.root.addChild(layer);
    }
  }

  /**
   * The container of a layer from `pixi2d({ layers })`: a child of `root`, in logical units,
   * its children sorted by `zIndex`. `"fenrir.backdrop"` returns `backdrop`. Throws for an
   * unknown name, listing the declared ones.
   */
  public layer(name: string): PIXI.Container {
    if (name === BACKDROP) return this.backdrop;
    const layer = this.layerMap.get(name);
    if (layer) return layer;
    const names = [...this.layerMap.keys()].map((n) => `"${n}"`);
    throw new Error(
      `pixi2d: unknown layer "${name}". ` +
        (names.length ? `Declared layers: ${names.join(", ")}.` : "No layers are declared; pass pixi2d({ layers: [...] })."),
    );
  }

  /** Mounts an entity's `PixiNode`, replacing the node it had. Internal: the renderer system calls it. */
  public attachNode(entities: EntityList, entity: Entity, value: PixiNode): void {
    const layer = value.layer === undefined ? undefined : this.layer(value.layer);
    const owner = this.owners.get(value.node);
    if (owner !== undefined && owner !== entity) {
      throw new Error(`PixiNode: this node already belongs to entity ${owner}. Give each entity its own node.`);
    }
    const previous = this.nodes.get(entity);
    if (previous && previous.node !== value.node) this.releaseNode(previous);
    const entry: NodeEntry = { node: value.node, keep: value.keep ?? false, layer };
    this.nodes.set(entity, entry);
    this.owners.set(value.node, entity);
    this.syncNode(entities, entity, entry, new Map());
  }

  /** Unmounts `value.node` after an entity's `PixiNode` was removed. Internal. */
  public detachNode(entity: Entity, value: PixiNode): void {
    const entry = this.nodes.get(entity);
    if (!entry || entry.node !== value.node) return;
    this.nodes.delete(entity);
    this.releaseNode(entry);
  }

  /**
   * Unmounts every node at stop. Destroys the ones not kept and removes their `PixiNode`
   * components, so a later run never mounts a destroyed node. Internal.
   */
  public releaseNodes(entities: EntityList | undefined): void {
    for (const [entity, entry] of this.nodes) {
      this.releaseNode(entry);
      if (!entry.keep && entities?.isAlive(entity) && entities.tryGet(entity, PixiNode)?.node === entry.node) {
        entities.remove(entity, PixiNode);
      }
    }
    this.nodes.clear();
  }

  /** Unmounts every node without destroying any, when the active scene changes. Internal. */
  public unmountNodes(): void {
    for (const { node } of this.nodes.values()) {
      this.rescueChildren(node);
      node.removeFromParent();
    }
    this.nodes.clear();
    this.owners.clear();
  }

  private releaseNode(entry: NodeEntry): void {
    this.owners.delete(entry.node);
    this.rescueChildren(entry.node);
    entry.node.removeFromParent();
    if (!entry.keep && !entry.node.destroyed) entry.node.destroy({ children: true });
  }

  /** Moves other entities' nodes and views out of `view` so destroying it spares them. The next sync places them. */
  private rescueChildren(view: PIXI.Container): void {
    for (const child of [...view.children]) {
      if (this.owners.has(child) || this.views.has(child)) this.root.addChild(child);
    }
  }

  /** Writes the entity's `Transform2D` and `Display2D` to its node and mounts it under its parent's view, its layer or `root`. */
  private syncNode(entities: EntityList, entity: Entity, entry: NodeEntry, primaryViews: Map<Entity, PIXI.Container>): void {
    const transform = entities.tryGet(entity, Transform2D);
    if (transform) applyTransform2D(entry.node, transform);
    applyDisplay2D(entry.node, entities.tryGet(entity, Display2D));
    const parent = entities.tryGet(entity, Relationship)?.parent;
    const target = (parent !== undefined && this.viewOf(parent, primaryViews)) || entry.layer || this.root;
    if (entry.node.parent !== target) target.addChild(entry.node);
  }

  private viewOf(entity: Entity, primaryViews: Map<Entity, PIXI.Container>): PIXI.Container | undefined {
    return this.nodes.get(entity)?.node ?? primaryViews.get(entity);
  }

  public get app(): PIXI.Application {
    return this.application;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    const { application, applicationOptions, canvas, logger } = this.options;
    if (application) {
      if (!application.renderer || (canvas && application.canvas !== canvas)) {
        throw new Error("The supplied Pixi application must be initialized for the engine canvas");
      }
      if (application.ticker?.started) {
        throw new Error("Stop the supplied Pixi application's ticker before starting Fenrir");
      }
      if (this.options.clearColor !== undefined) application.renderer.background.color = this.options.clearColor;
    } else {
      await this.app.init({
        width: this.options.width ?? window.innerWidth,
        height: this.options.height ?? window.innerHeight,
        backgroundColor: this.options.clearColor ?? 0x101010,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        ...applicationOptions,
        canvas,
        autoStart: false,
        sharedTicker: false,
      });
    }

    this.app.stage.addChild(this.backdrop, this.root);
    this.isInitialized = true;
    logger.info("PixiRenderer initialized");
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public resize(width: number, height: number, resolution?: number): void {
    this.app.renderer.resize(width, height, resolution);
  }

  /**
   * Places `root` for `viewport`: at its offset, at its scale. Called by `pixi2d` when the layout
   * changes. Internal.
   */
  public applyViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.root.position.set(viewport.offset.x, viewport.offset.y);
    this.root.scale.set(viewport.scale);
  }

  /**
   * Converts CSS client coordinates (a DOM event's `clientX`, `clientY`) into logical units:
   * design units with `pixi2d({ design })`. Returns null while the canvas or frame has no area.
   */
  public clientToLogical(clientX: number, clientY: number): ViewportPoint | null {
    const bounds = this.app.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const { width, height } = this.app.screen;
    return screenToLogical(this.viewport, {
      x: (clientX - bounds.left) * width / bounds.width,
      y: (clientY - bounds.top) * height / bounds.height,
    });
  }

  /** Converts logical units into CSS client coordinates. The inverse of `clientToLogical`. */
  public logicalToClient(x: number, y: number): ViewportPoint | null {
    const bounds = this.app.canvas.getBoundingClientRect();
    const { width, height } = this.app.screen;
    if (bounds.width <= 0 || bounds.height <= 0 || width <= 0 || height <= 0) return null;
    const screen = logicalToScreen(this.viewport, { x, y });
    return {
      x: bounds.left + screen.x * bounds.width / width,
      y: bounds.top + screen.y * bounds.height / height,
    };
  }

  public async upsertRenderable(entities: EntityList, entity: Entity, renderable: Renderable2D): Promise<void> {
    if (!this.isInitialized || !entities.isAlive(entity)) return;

    const key = keyFor(entity, renderable.id);
    const request = Symbol();
    this.pending.set(key, request);
    try {
      const texture = renderable.sprite
        ? await this.options.assets.getTexture2D(renderable.sprite.texture)
        : undefined;
      if (this.pending.get(key) !== request || !entities.isAlive(entity)) return;

      const existing = this.objects.get(key);
      let view = existing?.view;
      if (!view || !this.updateDisplayObject(view, renderable, texture)) {
        const replacement = this.createDisplayObject(renderable, texture);
        if (view) this.destroyDisplayObject(view);
        view = replacement;
        this.views.add(view);
        this.root.addChild(view);
      }

      this.objects.set(key, { entity, renderable, view });
      this.applyFlags(view, renderable.flags);
      this.applyEntityTransform(view, entities, entity);
    } catch (error) {
      if (this.pending.get(key) === request && entities.isAlive(entity)) throw error;
    } finally {
      if (this.pending.get(key) === request) this.pending.delete(key);
    }
  }

  public removeRenderable(entity: Entity, renderId: number): void {
    const key = keyFor(entity, renderId);
    this.pending.delete(key);
    const entry = this.objects.get(key);
    if (!entry) return;

    this.objects.delete(key);
    this.destroyDisplayObject(entry.view);
  }

  private destroyDisplayObject(view: PIXI.Container): void {
    // Children with their own renderables or nodes belong to their own ECS entities.
    this.rescueChildren(view);
    view.removeFromParent();
    view.destroy({ children: true });
  }

  /**
   * Writes transforms to every node and renderable view and mounts each under its parent.
   * Runs once a frame, before rendering. Internal.
   */
  public syncTransforms(entities: EntityList): void {
    const primaryViews = new Map<Entity, PIXI.Container>();
    for (const { entity, renderable, view } of this.objects.values()) {
      if (!entities.isAlive(entity)) {
        this.removeRenderable(entity, renderable.id);
      } else {
        this.applyEntityTransform(view, entities, entity);
        if (!primaryViews.has(entity)) primaryViews.set(entity, view);
      }
    }
    for (const [entity, entry] of this.nodes) {
      if (entities.isAlive(entity)) {
        this.syncNode(entities, entity, entry, primaryViews);
      } else {
        this.nodes.delete(entity);
        this.releaseNode(entry);
      }
    }
    if (this.objects.size > 0) this.syncHierarchy(entities, primaryViews);
  }

  private syncHierarchy(entities: EntityList, primaryViews: Map<Entity, PIXI.Container>): void {
    const stage = this.root;
    const declaredParents = new Map<number, PIXI.Container>();
    for (const { renderable, view } of this.objects.values()) {
      for (const child of renderable.container?.children ?? []) {
        if (!declaredParents.has(child)) declaredParents.set(child, view);
      }
    }

    const parents = new Map<PIXI.Container, PIXI.Container>();
    for (const { entity, view } of this.objects.values()) {
      const relationship = entities.has(entity, Relationship) ? entities.get(entity, Relationship) : undefined;
      const parent = (relationship && this.viewOf(relationship.parent, primaryViews)) ?? declaredParents.get(entity) ?? stage;
      parents.set(view, parent);
    }

    const moves = new Map<PIXI.Container, PIXI.Container>();
    for (const [view, parent] of parents) {
      let target = parent;
      const visited = new Set([view]);
      for (let ancestor: PIXI.Container | undefined = parent; ancestor; ancestor = parents.get(ancestor)) {
        if (visited.has(ancestor)) {
          target = stage;
          break;
        }
        visited.add(ancestor);
      }
      if (view.parent !== target) moves.set(view, target);
    }

    for (const view of moves.keys()) view.removeFromParent();
    for (const [view, parent] of moves) parent.addChild(view);
  }

  /** Sets the entities `render()` syncs. Internal: the renderer system binds the active scene. */
  public bindScene(entities: EntityList | undefined): void {
    this.scene = entities;
  }

  /**
   * Syncs every node and view with its entity's `Transform2D` and `Display2D`, then renders.
   * `fenrir.pixi.postUpdate` calls it each frame; game code may call it to draw outside a frame,
   * for example from a startup system, and sees the same synced scene.
   */
  public render(): void {
    if (this.scene) this.syncTransforms(this.scene);
    this.app.render();
  }

  public clearRenderables(): void {
    this.pending.clear();
    for (const { view } of this.objects.values()) this.rescueChildren(view);
    for (const { view } of this.objects.values()) view.removeFromParent();
    for (const { view } of this.objects.values()) view.destroy({ children: true });
    this.objects.clear();
  }

  public dispose(): void {
    this.scene = undefined;
    this.clearRenderables();
    this.backdrop.removeFromParent();
    this.root.removeFromParent();
    this.isInitialized = false;
    if (!this.options.application && this.app.renderer) {
      this.app.destroy({ removeView: !this.options.canvas });
      this.application = new PIXI.Application();
    }
  }

  public getRenderedObject(entity: Entity, renderableId: number): PIXI.Container | undefined {
    return this.objects.get(keyFor(entity, renderableId))?.view;
  }

  private createDisplayObject(r: Renderable2D, texture?: PIXI.Texture): PIXI.Container {
    if (r.sprite && texture) {
      const sprite = new PIXI.Sprite(texture);
      this.updateSprite(sprite, r.sprite, texture);
      return sprite;
    }
    if (r.graphics) {
      const graphics = new PIXI.Graphics();
      this.drawGraphics(graphics, r.graphics);
      return graphics;
    }
    if (r.text) return new PIXI.Text({ text: r.text.content, style: r.text.style });
    if (r.container) return new PIXI.Container();
    throw new Error("No valid renderable type specified in Renderable2D");
  }

  private updateSprite(sprite: PIXI.Sprite, desc: SpriteDesc, texture: PIXI.Texture): void {
    sprite.texture = texture;
    if (desc.anchor) sprite.anchor.set(desc.anchor[0], desc.anchor[1]);
    if (desc.tint !== undefined) sprite.tint = desc.tint;
  }

  /**
   * Create graphics from descriptor
   */
  private drawGraphics(graphics: PIXI.Graphics, desc: GraphicsDesc): void {

    // PixiJS v8: Define shape first, then apply fill/stroke
    switch (desc.shape) {
      case "rect": {
        const data = desc.data as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        graphics.rect(data.x, data.y, data.width, data.height);
        break;
      }
      case "circle": {
        const data = desc.data as { x: number; y: number; radius: number };
        graphics.circle(data.x, data.y, data.radius);
        break;
      }
      case "polygon": {
        const data = desc.data as { points: number[] };
        graphics.poly(data.points);
        break;
      }
      default: {
        const exhaustiveCheck: never = desc.shape;
        throw new Error(`Unknown graphics shape: ${exhaustiveCheck}`);
      }
    }

    // Apply fill and stroke AFTER defining the shape
    if (desc.fillColor !== undefined) {
      graphics.fill(desc.fillColor);
    }

    if (desc.strokeColor !== undefined && desc.strokeWidth !== undefined) {
      graphics.stroke({ color: desc.strokeColor, width: desc.strokeWidth });
    }

  }

  private updateDisplayObject(obj: PIXI.Container, r: Renderable2D, texture?: PIXI.Texture): boolean {
    if (r.sprite && texture && obj instanceof PIXI.Sprite) {
      this.updateSprite(obj, r.sprite, texture);
      return true;
    }
    if (r.graphics && obj instanceof PIXI.Graphics) {
      obj.clear();
      this.drawGraphics(obj, r.graphics);
      return true;
    }
    if (r.text && obj instanceof PIXI.Text) {
      obj.text = r.text.content;
      if (r.text.style) obj.style = new PIXI.TextStyle(r.text.style);
      return true;
    }
    return Boolean(r.container) && obj.constructor === PIXI.Container;
  }

  /**
   * Apply rendering flags to a display object
   */
  private applyFlags(obj: PIXI.Container, flags?: Render2DFlags): void {
    if (!flags) return;

    if (flags.visible !== undefined) obj.visible = flags.visible;
    if (flags.zIndex !== undefined) obj.zIndex = flags.zIndex;
    if (flags.alpha !== undefined) obj.alpha = flags.alpha;
    if (flags.blendMode !== undefined) obj.blendMode = flags.blendMode as any;
  }

  /** `Display2D` when the entity has it, and `Transform2D` when it has it, otherwise its `Transform`. */
  private applyEntityTransform(view: PIXI.Container, entities: EntityList, entity: Entity): void {
    applyDisplay2D(view, entities.tryGet(entity, Display2D));
    const transform2D = entities.tryGet(entity, Transform2D);
    if (transform2D) return applyTransform2D(view, transform2D);
    const transform = entities.tryGet(entity, Transform);
    if (transform) this.applyTransform(view, transform);
  }

  /**
   * Apply transform component to display object
   * Maps 3D transform to 2D (uses x/y, ignores z)
   */
  private applyTransform(
    obj: PIXI.Container,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
      scale: { x: number; y: number; z: number };
    },
  ): void {
    // Map 3D transform to 2D (use x/y, ignore z)
    obj.position.set(transform.position.x, transform.position.y);
    obj.scale.set(transform.scale.x, transform.scale.y);

    // Convert quaternion to 2D rotation
    // For 2D, we only care about rotation around Z axis
    // This is a simplified conversion - for full quaternion->euler, use a helper
    const q = transform.rotation;
    const angle = Math.atan2(
      2.0 * (q.w * q.z + q.x * q.y),
      1.0 - 2.0 * (q.y * q.y + q.z * q.z),
    );
    obj.rotation = angle;
  }
}

// Pixi's setters skip unchanged values, so rewriting an unchanged transform each frame is a few compares.
function applyTransform2D(view: PIXI.Container, { x, y, rotation, scaleX, scaleY }: Transform2D): void {
  view.position.set(x, y);
  view.scale.set(scaleX, scaleY);
  view.rotation = rotation;
}

function applyDisplay2D(view: PIXI.Container, display: Display2D | undefined): void {
  if (!display) return;
  view.alpha = display.alpha;
  view.visible = display.visible;
}

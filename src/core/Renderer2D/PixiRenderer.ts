import * as PIXI from "pixi.js";
import type { Entity, EntityList } from "../ECS";
import { Relationship, Transform } from "../ECS/DefaultComponents";
import type {
  Renderable2D,
  SpriteDesc,
  GraphicsDesc,
  Render2DFlags,
} from "./render2DComponents";
import type { ILogger } from "../ILogger";
import type { IAssetStore } from "../Assets/AssetStore";

type ObjKey = string;
const keyFor = (e: Entity, id: number): string => `${e}:${id}`;

export interface PixiRendererOptions {
  readonly canvas?: HTMLCanvasElement;
  readonly logger: ILogger;
  readonly width?: number;
  readonly height?: number;
  readonly clearColor?: number;
  readonly assets: IAssetStore;
  /** An initialized application owned by the caller, with its automatic ticker stopped. */
  readonly application?: PIXI.Application;
  /** Initialization options for an engine-owned application. */
  readonly applicationOptions?: Partial<Omit<PIXI.ApplicationOptions, "canvas" | "autoStart" | "sharedTicker">>;
}

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

  constructor(options: PixiRendererOptions) {
    this.options = options;
    this.application = options.application ?? new PIXI.Application();
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

    this.isInitialized = true;
    logger.info("PixiRenderer initialized");
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public resize(width: number, height: number, resolution?: number): void {
    this.app.renderer.resize(width, height, resolution);
  }

  /** Converts CSS client coordinates into logical coordinates in the Pixi screen. */
  public clientToLogical(clientX: number, clientY: number): { x: number; y: number } | null {
    const bounds = this.app.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    const { width, height } = this.app.screen;
    return {
      x: (clientX - bounds.left) * width / bounds.width,
      y: (clientY - bounds.top) * height / bounds.height,
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
        this.app.stage.addChild(view);
      }

      this.objects.set(key, { entity, renderable, view });
      this.applyFlags(view, renderable.flags);
      if (entities.has(entity, Transform)) this.applyTransform(view, entities.get(entity, Transform));
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
    // Children with their own renderables belong to their own ECS entities.
    for (const entry of this.objects.values()) {
      if (entry.view.parent === view) this.app.stage.addChild(entry.view);
    }
    view.removeFromParent();
    view.destroy({ children: true });
  }

  public syncTransforms(entities: EntityList): void {
    for (const { entity, renderable, view } of this.objects.values()) {
      if (!entities.isAlive(entity)) {
        this.removeRenderable(entity, renderable.id);
      } else if (entities.has(entity, Transform)) {
        this.applyTransform(view, entities.get(entity, Transform));
      }
    }
    this.syncHierarchy(entities);
  }

  private syncHierarchy(entities: EntityList): void {
    const stage = this.app.stage;
    const primaryViews = new Map<number, PIXI.Container>();
    const declaredParents = new Map<number, PIXI.Container>();
    for (const { entity, renderable, view } of this.objects.values()) {
      if (!primaryViews.has(entity)) primaryViews.set(entity, view);
      for (const child of renderable.container?.children ?? []) {
        if (!declaredParents.has(child)) declaredParents.set(child, view);
      }
    }

    const parents = new Map<PIXI.Container, PIXI.Container>();
    for (const { entity, view } of this.objects.values()) {
      const relationship = entities.has(entity, Relationship) ? entities.get(entity, Relationship) : undefined;
      const parent = (relationship && primaryViews.get(relationship.parent)) ?? declaredParents.get(entity) ?? stage;
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

  public render(): void {
    this.app.render();
  }

  public clearRenderables(): void {
    this.pending.clear();
    for (const { view } of this.objects.values()) view.removeFromParent();
    for (const { view } of this.objects.values()) view.destroy({ children: true });
    this.objects.clear();
  }

  public dispose(): void {
    this.clearRenderables();
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

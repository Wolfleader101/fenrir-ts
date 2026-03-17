import * as PIXI from "pixi.js";
import type { Entity, EntityList } from "../ECS";
import { Transform } from "../ECS/DefaultComponents";
import {
  Renderable2D,
  type SpriteDesc,
  type GraphicsDesc,
  type TextDesc,
  type ContainerDesc,
  type Render2DFlags,
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
}

/**
 * Core PixiJS renderer implementation for 2D games
 * Manages PIXI.Application and display object lifecycle
 */
export class PixiRenderer {
  public readonly app: PIXI.Application;
  private readonly objects = new Map<ObjKey, PIXI.Container>();
  private readonly assets: IAssetStore;
  private readonly logger: ILogger;
  private readonly canvasElement?: HTMLCanvasElement;
  private readonly clearColorValue: number;
  private readonly widthValue: number;
  private readonly heightValue: number;
  private isInitialized = false;

  constructor(opts: PixiRendererOptions) {
    const {
      canvas,
      width = window.innerWidth,
      height = window.innerHeight,
      clearColor = 0x101010,
    } = opts;

    this.assets = opts.assets;
    this.logger = opts.logger;
    this.canvasElement = canvas;
    this.clearColorValue = clearColor;
    this.widthValue = width;
    this.heightValue = height;

    // Create application (will be initialized later)
    this.app = new PIXI.Application();
  }

  /**
   * Initialize the PixiJS application
   * Must be called before using the renderer
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await this.app.init({
      canvas: this.canvasElement,
      width: this.widthValue,
      height: this.heightValue,
      backgroundColor: this.clearColorValue,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.isInitialized = true;
    this.logger.info("PixiRenderer initialized");
  }

  /**
   * Check if renderer is initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Resize the renderer
   */
  public resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  /**
   * Create or update a renderable
   */
  public async upsertRenderable(
    entities: EntityList,
    e: Entity,
    r: Renderable2D,
  ): Promise<void> {
    const k = keyFor(e, r.id);
    let obj = this.objects.get(k);

    // Create new object if needed
    if (!obj) {
      obj = await this.createDisplayObject(r);
      this.objects.set(k, obj);
      this.app.stage.addChild(obj);
    } else {
      // Update existing object
      await this.updateDisplayObject(obj, r);
    }

    this.applyFlags(obj, r.flags);

    // Apply transform from Transform component
    if (entities.has(e, Transform)) {
      this.applyTransform(obj, entities.get(e, Transform));
    }
  }

  /**
   * Remove a renderable
   */
  public removeRenderable(e: Entity, renderId: number): void {
    const k = keyFor(e, renderId);
    const obj = this.objects.get(k);
    if (!obj) return;

    this.app.stage.removeChild(obj);
    obj.destroy({ children: true });
    this.objects.delete(k);
  }

  /**
   * Sync all transforms from Transform components
   */
  public syncTransforms(entities: EntityList): void {
    const Q = [Transform, Renderable2D] as const;

    entities.each(Q, (e, transform, r) => {
      const obj = this.objects.get(keyFor(e, r.id));
      if (!obj) return;
      this.applyTransform(obj, transform);
    });
  }

  /**
   * Render the scene
   */
  public render(): void {
    this.app.render();
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    for (const obj of this.objects.values()) {
      this.app.stage.removeChild(obj);
      obj.destroy({ children: true });
    }
    this.objects.clear();
    this.app.destroy(true);
  }

  /**
   * Get the rendered display object for an entity
   */
  public getRenderedObject(
    entity: Entity,
    renderableId: number,
  ): PIXI.Container | undefined {
    return this.objects.get(keyFor(entity, renderableId));
  }

  // Internal methods

  /**
   * Create a new display object based on descriptor
   */
  private async createDisplayObject(r: Renderable2D): Promise<PIXI.Container> {
    if (r.sprite) {
      return await this.createSprite(r.sprite);
    }

    if (r.graphics) {
      return this.createGraphics(r.graphics);
    }

    if (r.text) {
      return this.createText(r.text);
    }

    if (r.container) {
      return this.createContainer(r.container);
    }

    throw new Error("No valid renderable type specified in Renderable2D");
  }

  /**
   * Create a sprite from descriptor
   */
  private async createSprite(desc: SpriteDesc): Promise<PIXI.Sprite> {
    const texture = await this.assets.getTexture2D(desc.texture);
    const sprite = new PIXI.Sprite(texture);

    if (desc.anchor) {
      sprite.anchor.set(desc.anchor[0], desc.anchor[1]);
    }

    if (desc.tint !== undefined) {
      sprite.tint = desc.tint;
    }

    return sprite;
  }

  /**
   * Create graphics from descriptor
   */
  private createGraphics(desc: GraphicsDesc): PIXI.Graphics {
    const graphics = new PIXI.Graphics();

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

    return graphics;
  }

  /**
   * Create text from descriptor
   */
  private createText(desc: TextDesc): PIXI.Text {
    const style = new PIXI.TextStyle(desc.style || {});
    return new PIXI.Text({ text: desc.content, style });
  }

  /**
   * Create container from descriptor
   */
  private createContainer(_desc: ContainerDesc): PIXI.Container {
    return new PIXI.Container();
  }

  /**
   * Update an existing display object
   */
  private async updateDisplayObject(
    obj: PIXI.Container,
    r: Renderable2D,
  ): Promise<void> {
    // Update sprite
    if (r.sprite && obj instanceof PIXI.Sprite) {
      const texture = await this.assets.getTexture2D(r.sprite.texture);
      obj.texture = texture;

      if (r.sprite.tint !== undefined) {
        obj.tint = r.sprite.tint;
      }

      if (r.sprite.anchor) {
        obj.anchor.set(r.sprite.anchor[0], r.sprite.anchor[1]);
      }
    }

    // Update text
    if (r.text && obj instanceof PIXI.Text) {
      obj.text = r.text.content;
      if (r.text.style) {
        obj.style = new PIXI.TextStyle(r.text.style);
      }
    }

    // Graphics would need full recreation for now
    // Could optimize later by tracking what changed
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

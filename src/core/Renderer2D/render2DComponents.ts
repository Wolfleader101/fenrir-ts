import { defineComponent } from "../ECS";

/**
 * Sprite descriptor for texture-based rendering
 */
export type SpriteDesc = {
  readonly kind: "sprite";
  readonly texture: string; // Asset key
  readonly anchor?: readonly [number, number];
  readonly tint?: number;
};

/**
 * Graphics descriptor for procedural drawing
 */
export type GraphicsDesc = {
  readonly kind: "graphics";
  readonly shape: "rect" | "circle" | "polygon";
  readonly fillColor?: number;
  readonly strokeColor?: number;
  readonly strokeWidth?: number;
  readonly data?: unknown; // Shape-specific data
};

/**
 * Text descriptor for text rendering
 */
export type TextDesc = {
  readonly kind: "text";
  readonly content: string;
  readonly style?: {
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fill?: number;
    readonly align?: "left" | "center" | "right";
  };
};

/**
 * Container descriptor for grouping display objects
 */
export type ContainerDesc = {
  readonly kind: "container";
  readonly children?: readonly number[]; // Entity IDs
};

/**
 * Rendering flags for display objects
 */
export type Render2DFlags = {
  readonly visible?: boolean;
  readonly zIndex?: number;
  readonly alpha?: number;
  readonly blendMode?: number;
};

/**
 * Core 2D rendering component for PixiJS-based entities
 */
export type Renderable2D = {
  readonly id: number;
  sprite?: SpriteDesc;
  graphics?: GraphicsDesc;
  text?: TextDesc;
  container?: ContainerDesc;
  flags?: Render2DFlags;
};

export const Renderable2D = defineComponent<Renderable2D>("Renderable2D");

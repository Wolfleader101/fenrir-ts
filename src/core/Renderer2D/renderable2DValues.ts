import type { Render2DFlags, Renderable2D, TextDesc } from "./render2DComponents";

// Each value gets its own `id`: the renderer keys an entity's view by it.
let nextRenderableId = 0;

/** Options for {@link sprite2D}. */
export type Sprite2DOptions = {
  /** Anchor in the texture, `[0, 0]` top-left to `[1, 1]` bottom-right. Pixi's default when omitted. */
  readonly anchor?: readonly [number, number];
  readonly tint?: number;
  readonly flags?: Render2DFlags;
};

/** Options for {@link circle2D} and {@link rect2D}. */
export type Shape2DOptions = {
  readonly fillColor?: number;
  readonly strokeColor?: number;
  readonly strokeWidth?: number;
  readonly flags?: Render2DFlags;
};

/** Options for {@link text2D}. */
export type Text2DOptions = {
  readonly style?: TextDesc["style"];
  readonly flags?: Render2DFlags;
};

/**
 * A `Renderable2D` that draws the texture stored under `texture` in `game.assets` (a manifest
 * asset's name, or a key loaded with `requestTexture2D`). Use it with the builder's `with`:
 *
 * ```ts
 * EntityBuilder.create().transform2D(195, 80).with(Renderable2D, sprite2D("logo")).spawn(entities);
 * ```
 *
 * Each call makes a new value with its own `id`.
 */
export function sprite2D(texture: string, options?: Sprite2DOptions): Renderable2D {
  return {
    id: nextRenderableId++,
    sprite: { kind: "sprite", texture, anchor: options?.anchor, tint: options?.tint },
    flags: options?.flags,
  };
}

/**
 * A `Renderable2D` circle of `radius`, centred on the entity's `Transform2D`:
 *
 * ```ts
 * EntityBuilder.create().transform2D(195, 320).with(Renderable2D, circle2D(16, { fillColor: 0xff6600 })).spawn(entities);
 * ```
 *
 * Each call makes a new value with its own `id`.
 */
export function circle2D(radius: number, options?: Shape2DOptions): Renderable2D {
  return {
    id: nextRenderableId++,
    graphics: {
      kind: "graphics",
      shape: "circle",
      fillColor: options?.fillColor,
      strokeColor: options?.strokeColor,
      strokeWidth: options?.strokeWidth,
      data: { x: 0, y: 0, radius },
    },
    flags: options?.flags,
  };
}

/**
 * A `Renderable2D` rectangle of `width` by `height`, centred on the entity's `Transform2D`:
 *
 * ```ts
 * EntityBuilder.create().transform2D(195, 400).with(Renderable2D, rect2D(120, 24, { fillColor: 0x224466 })).spawn(entities);
 * ```
 *
 * Each call makes a new value with its own `id`.
 */
export function rect2D(width: number, height: number, options?: Shape2DOptions): Renderable2D {
  return {
    id: nextRenderableId++,
    graphics: {
      kind: "graphics",
      shape: "rect",
      fillColor: options?.fillColor,
      strokeColor: options?.strokeColor,
      strokeWidth: options?.strokeWidth,
      data: { x: -width / 2, y: -height / 2, width, height },
    },
    flags: options?.flags,
  };
}

/**
 * A `Renderable2D` text of `content`, its top-left at the entity's `Transform2D`:
 *
 * ```ts
 * EntityBuilder.create().transform2D(20, 20).with(Renderable2D, text2D("Score: 0", { style: { fontSize: 24, fill: 0xffffff } })).spawn(entities);
 * ```
 *
 * Each call makes a new value with its own `id`.
 */
export function text2D(content: string, options?: Text2DOptions): Renderable2D {
  return {
    id: nextRenderableId++,
    text: { kind: "text", content, style: options?.style },
    flags: options?.flags,
  };
}

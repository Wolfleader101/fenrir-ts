import { EntityBuilder } from "../EntityBuilder";
import type { Container } from "pixi.js";
import { Renderable2D, type Render2DFlags } from "../../Renderer2D";
import { PixiNode } from "../../Renderer2D/PixiNode";

declare module "../EntityBuilder" {
  interface EntityBuilder {
    /**
     * Gives the entity a Pixi display object the app built (`PixiNode`). Mounted in `layer`, or
     * under the parent entity's node; destroyed with the entity unless `keep` is true.
     */
    pixiNode(node: Container, options?: { layer?: string; keep?: boolean }): this;

    /**
     * Add a 2D sprite renderable
     */
    renderSprite(
      texture: string,
      options?: {
        anchor?: readonly [number, number];
        tint?: number;
        flags?: Render2DFlags;
      },
    ): this;

    /**
     * Add a 2D circle graphic
     */
    renderCircle(
      radius: number,
      options?: {
        fillColor?: number;
        strokeColor?: number;
        strokeWidth?: number;
        flags?: Render2DFlags;
      },
    ): this;

    /**
     * Add a 2D rectangle graphic
     */
    renderRect(
      width: number,
      height: number,
      options?: {
        fillColor?: number;
        strokeColor?: number;
        strokeWidth?: number;
        flags?: Render2DFlags;
      },
    ): this;

    /**
     * Add 2D text renderable
     */
    renderText(
      content: string,
      options?: {
        style?: {
          readonly fontFamily?: string;
          readonly fontSize?: number;
          readonly fill?: number;
          readonly align?: "left" | "center" | "right";
        };
        flags?: Render2DFlags;
      },
    ): this;
  }
}

let nextRenderableId = 0;

/**
 * Add a 2D sprite renderable
 */
EntityBuilder.prototype.renderSprite = function (
  texture: string,
  options?: {
    anchor?: readonly [number, number];
    tint?: number;
    flags?: Render2DFlags;
  },
): EntityBuilder {
  return this.with(Renderable2D, {
    id: nextRenderableId++,
    sprite: {
      kind: "sprite",
      texture,
      anchor: options?.anchor,
      tint: options?.tint,
    },
    flags: options?.flags,
  });
};

/**
 * Add a 2D circle graphic
 */
EntityBuilder.prototype.renderCircle = function (
  radius: number,
  options?: {
    fillColor?: number;
    strokeColor?: number;
    strokeWidth?: number;
    flags?: Render2DFlags;
  },
): EntityBuilder {
  return this.with(Renderable2D, {
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
  });
};

/**
 * Add a 2D rectangle graphic
 */
EntityBuilder.prototype.renderRect = function (
  width: number,
  height: number,
  options?: {
    fillColor?: number;
    strokeColor?: number;
    strokeWidth?: number;
    flags?: Render2DFlags;
  },
): EntityBuilder {
  return this.with(Renderable2D, {
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
  });
};

/**
 * Add 2D text renderable
 */
EntityBuilder.prototype.renderText = function (
  content: string,
  options?: {
    style?: {
      readonly fontFamily?: string;
      readonly fontSize?: number;
      readonly fill?: number;
      readonly align?: "left" | "center" | "right";
    };
    flags?: Render2DFlags;
  },
): EntityBuilder {
  return this.with(Renderable2D, {
    id: nextRenderableId++,
    text: {
      kind: "text",
      content,
      style: options?.style,
    },
    flags: options?.flags,
  });
};

/**
 * Give the entity an app-built Pixi display object. Pass the node directly: every spawn of
 * this builder gets the same one, so spawn a builder with a node once.
 */
EntityBuilder.prototype.pixiNode = function (node: Container, options?: { layer?: string; keep?: boolean }): EntityBuilder {
  return this.with(PixiNode, { ...options, node });
};

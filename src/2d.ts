/**
 * Fenrir-TS 2D: the `fenrir-ts/2d` entry point. Peer: `pixi.js`.
 *
 * Importing it adds the `texture2d` asset kind and the default Pixi texture loader to every
 * AssetStore. It patches no class: the 2D texture calls are functions that take a `ctx` or the
 * game (`requestTexture2D(game, key, url)`), and entities get a node with
 * `with(PixiNode, { node, layer })`, or a shape with `with(Renderable2D, circle2D(16))`.
 */

// Side effect: the texture2d kind and the default Pixi loader on every AssetStore.
import "./core/Assets/Assets2D";

// Asset store: 2D textures
export {
  requestTexture2D,
  loadTexture2D,
  getTexture2D,
  registerTexture2DLoader,
  getSupportedTexture2DExtensions,
} from "./core/Assets/Assets2D";
export type { PixiTextureLoaderConfig, Texture2DHandle, Texture2DState } from "./core/Assets/Assets2D";
export { createPixiTextureLoader } from "./core/Assets/loaders/pixiTextureLoader";

// Renderable2D values, for `builder.with(Renderable2D, circle2D(16))`
export { sprite2D, circle2D, rect2D, text2D } from "./core/Renderer2D";
export type { Sprite2DOptions, Shape2DOptions, Text2DOptions } from "./core/Renderer2D";

// Renderer2D (PixiJS)
export { pixi2d, PixiNode, Renderable2D, PixiRenderer, createPixiRendererSystem } from "./core/Renderer2D";

// Transform2D and Display2D are core data (plain values); re-exported here because 2D code uses them with PixiNode.
export { Transform2D } from "./core/ECS/Transform2D";
export { Display2D } from "./core/ECS/Display2D";

// Viewport: design resolution, safe area and resize
export { Viewport, ViewportResized, layoutViewport, screenToLogical, logicalToScreen } from "./core/Renderer2D";
export type {
  ViewportDesign,
  ViewportInsets,
  ViewportPoint,
} from "./core/Renderer2D";
export type {
  Pixi2DOptions,
  Pixi2DPlugin,
  PixiRendererOptions,
  PixiRendererSystemOptions,
  SpriteDesc,
  GraphicsDesc,
  TextDesc,
  ContainerDesc,
  Render2DFlags,
} from "./core/Renderer2D";

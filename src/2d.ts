/**
 * Fenrir-TS 2D: the `fenrir-ts/2d` entry point. Peer: `pixi.js`.
 *
 * Importing it also adds, for this program, the 2D EntityBuilder methods (`pixiNode`,
 * `renderSprite`, `renderCircle`, `renderRect`, `renderText`) and the `texture2d` asset kind.
 * 2D textures load with functions (`requestTexture2D(game.assets, key, url)`), not methods
 * on AssetStore: nothing patches the store.
 */

// Side effects: patch EntityBuilder.
import "./core/EntityBuilder/extensions/render2DExtensions";

// Asset store: 2D textures
export {
  requestTexture2D,
  loadTexture2D,
  getTexture2D,
  registerTexture2DLoader,
  getSupportedTexture2DExtensions,
  addPixiTextureLoader,
  PIXI_TEXTURE_LOADER,
} from "./core/Assets/Assets2D";
export type { PixiTextureLoaderConfig, Texture2DHandle, Texture2DState } from "./core/Assets/Assets2D";
export { createPixiTextureLoader } from "./core/Assets/loaders/pixiTextureLoader";

// Entity builder extensions
export * from "./core/EntityBuilder/extensions/render2DExtensions";

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

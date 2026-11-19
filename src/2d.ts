/**
 * Fenrir-TS 2D: the `fenrir-ts/2d` entry point. Peer: `pixi.js`.
 *
 * Importing it also adds, for this program:
 * - the 2D EntityBuilder methods (`pixiNode`, `renderSprite`, `renderCircle`, `renderRect`, `renderText`)
 * - the 2D texture methods on AssetStore (`requestTexture2D`, `loadTexture2D`,
 *   `getTexture2D`, `registerTexture2DLoader`) and the default Pixi texture loader
 */

// Side effects: patch AssetStore and EntityBuilder.
import "./core/Assets/Assets2D";
import "./core/EntityBuilder/extensions/render2DExtensions";

// Asset store: 2D textures
export type { PixiTextureLoaderConfig, Texture2DHandle, Texture2DState } from "./core/Assets/Assets2D";
export { createPixiTextureLoader } from "./core/Assets/loaders/pixiTextureLoader";

// Entity builder extensions
export * from "./core/EntityBuilder/extensions/render2DExtensions";

// Renderer2D (PixiJS)
export { pixi2d, PixiNode, Renderable2D, PixiRenderer, createPixiRendererSystem } from "./core/Renderer2D";

// Transform2D is core data (plain numbers); re-exported here because 2D code uses it with PixiNode.
export { Transform2D } from "./core/ECS/Transform2D";

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

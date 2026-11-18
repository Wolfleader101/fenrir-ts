import type * as PIXI from "pixi.js";
import type { Game, Plugin } from "../Game";
import { Schedule } from "../Schedule";
import type { PixiRenderer } from "./PixiRenderer";
import type { PixiRendererOptions } from "./PixiRenderer";
import { createPixiRendererSystem } from "./PixiRendererSystem";
import type { ViewportDesign } from "./Viewport";
import { createViewportSystems } from "./ViewportSystem";

export interface Pixi2DOptions {
  /**
   * The size the game is designed for, in logical units. With it the plugin owns the canvas
   * size: the canvas fills the window, the design width fills the safe area's width, and the
   * logical height grows from `minHeight` to fill its height. A safe area too short for
   * `minHeight` scales the frame down and centres it horizontally. Game content in
   * `renderer.root` is drawn in these units. Without it, logical units are CSS pixels and the
   * canvas keeps the size it was created with.
   */
  readonly design?: ViewportDesign;
  /** With `design`, lay the frame out inside `env(safe-area-inset-*)`. Defaults to true. */
  readonly safeArea?: boolean;
  /** Caps backing-store pixels per CSS pixel: `min(devicePixelRatio, maxResolution)`. Defaults to 2. */
  readonly maxResolution?: number;
  /** Clear colour of a Pixi application the plugin creates, as 0xRRGGBB. Defaults to 0x101010. */
  readonly background?: number;
  /**
   * A Pixi application the app already owns, initialized on the game's canvas with its ticker
   * stopped. The game renders it but does not destroy it at exit.
   */
  readonly application?: PIXI.Application;
  /** Size of a Pixi application the plugin creates, without `design`. Defaults to the window size. */
  readonly width?: number;
  readonly height?: number;
  /** Other initialization options for a Pixi application the plugin creates. */
  readonly applicationOptions?: PixiRendererOptions["applicationOptions"];
}

export interface Pixi2DPlugin extends Plugin {
  /**
   * The renderer, for game code that draws with Pixi directly: add content to `renderer.root`
   * (logical units, scaled to the design frame) or `renderer.backdrop` (full-bleed, CSS pixels).
   * Available once `createGame` has installed the plugin; its Pixi application is
   * initialized when the game's Init stage runs.
   */
  readonly renderer: PixiRenderer;
}

/**
 * The PixiJS 2D renderer as a game plugin. Registers `fenrir.pixi.init` (Init),
 * `fenrir.viewport.init` (Init, after it), `fenrir.viewport.preUpdate` (PreUpdate, applies resizes),
 * `fenrir.pixi.update` (Update, syncs transforms), `fenrir.pixi.postUpdate` (PostUpdate, renders)
 * and `fenrir.pixi.exit` (Exit). Keeps the `Viewport` resource and sends `ViewportResized`.
 *
 * ```ts
 * const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, background: 0x101820 });
 * const game = await createGame({ canvas, plugins: [pixi] });
 * pixi.renderer.root; // draw here in design units, once the game runs
 * ```
 */
export function pixi2d(options: Pixi2DOptions = {}): Pixi2DPlugin {
  const { design, safeArea = true, maxResolution = 2 } = options;
  if (design) {
    const { width, minHeight } = design;
    if (!(width > 0 && Number.isFinite(width)) || !(minHeight > 0 && Number.isFinite(minHeight))) {
      throw new RangeError(`pixi2d: design needs a positive finite width and minHeight, got ${width} x ${minHeight}.`);
    }
    if (options.width !== undefined || options.height !== undefined) {
      throw new Error("pixi2d: with design the plugin sizes the canvas to the window. Remove width and height.");
    }
  }
  if (!(maxResolution > 0)) {
    throw new RangeError(`pixi2d: maxResolution must be a positive number, got ${maxResolution}.`);
  }
  let renderer: PixiRenderer | undefined;

  return {
    name: "fenrir.pixi2d",
    get renderer(): PixiRenderer {
      if (!renderer) throw new Error("pixi2d: the renderer exists once createGame has installed this plugin. Pass it in createGame's plugins first.");
      return renderer;
    },
    install(game: Game): void {
      if (renderer) throw new Error("pixi2d: this plugin is already installed in a game. Call pixi2d() again for another game.");
      const system = createPixiRendererSystem({
        canvas: game.canvas,
        logger: game.logger,
        assets: game.assets,
        clearColor: options.background,
        application: options.application,
        width: options.width,
        height: options.height,
        applicationOptions: {
          resolution: Math.min(maxResolution, window.devicePixelRatio || 1),
          ...options.applicationOptions,
        },
      });
      const viewport = createViewportSystems({ renderer: system.renderer, canvas: game.canvas, design, safeArea, maxResolution });
      game
        .addSystem(Schedule.Init, system.init)
        .addSystem(Schedule.Init, viewport.init, { after: system.init.name })
        .addSystem(Schedule.PreUpdate, viewport.preUpdate)
        .addSystem(Schedule.Update, system.update)
        .addSystem(Schedule.PostUpdate, system.postUpdate)
        .addSystem(Schedule.Exit, system.exit);
      renderer = system.renderer;
    },
  };
}

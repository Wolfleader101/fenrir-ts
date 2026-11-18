import type * as PIXI from "pixi.js";
import type { Game, Plugin } from "../Game";
import { Schedule } from "../Schedule";
import type { PixiRenderer } from "./PixiRenderer";
import type { PixiRendererOptions } from "./PixiRenderer";
import { createPixiRendererSystem } from "./PixiRendererSystem";

export interface Pixi2DOptions {
  /** Clear colour of a Pixi application the plugin creates, as 0xRRGGBB. Defaults to 0x101010. */
  readonly background?: number;
  /**
   * A Pixi application the app already owns, initialized on the game's canvas with its ticker
   * stopped. The game renders it but does not destroy it at exit.
   */
  readonly application?: PIXI.Application;
  /** Size of a Pixi application the plugin creates. Defaults to the window size. */
  readonly width?: number;
  readonly height?: number;
  /** Other initialization options for a Pixi application the plugin creates. */
  readonly applicationOptions?: PixiRendererOptions["applicationOptions"];
  // Seam for #35 (viewport): design, safeArea and maxResolution go here, applied in install below.
}

export interface Pixi2DPlugin extends Plugin {
  /**
   * The renderer, for game code that draws with Pixi directly (`renderer.app.stage`).
   * Available once `createGame` has installed the plugin; its Pixi application is
   * initialized when the game's Init stage runs.
   */
  readonly renderer: PixiRenderer;
}

/**
 * The PixiJS 2D renderer as a game plugin. Registers `fenrir.pixi.init` (Init),
 * `fenrir.pixi.update` (Update, syncs transforms), `fenrir.pixi.postUpdate` (PostUpdate, renders)
 * and `fenrir.pixi.exit` (Exit).
 *
 * ```ts
 * const pixi = pixi2d({ background: 0x101820 });
 * const game = await createGame({ canvas, plugins: [pixi] });
 * pixi.renderer.app.stage; // the Pixi stage, once the game runs
 * ```
 */
export function pixi2d(options: Pixi2DOptions = {}): Pixi2DPlugin {
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
        applicationOptions: options.applicationOptions,
      });
      game
        .addSystem(Schedule.Init, system.init)
        .addSystem(Schedule.Update, system.update)
        .addSystem(Schedule.PostUpdate, system.postUpdate)
        .addSystem(Schedule.Exit, system.exit);
      renderer = system.renderer;
    },
  };
}

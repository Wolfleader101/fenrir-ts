import { nameEngineSystems } from "../SystemName";
import type { SystemCtx } from "../SystemCtx";
import type { PixiRenderer } from "./PixiRenderer";
import {
  NO_INSETS,
  Viewport,
  ViewportResized,
  identityViewport,
  layoutViewport,
  sameViewport,
} from "./Viewport";
import type { ViewportDesign, ViewportInsets } from "./Viewport";

export interface ViewportSystemOptions {
  readonly renderer: PixiRenderer;
  readonly canvas: HTMLCanvasElement;
  /** Without it, the viewport follows the renderer's screen and the plugin listens to nothing. */
  readonly design?: ViewportDesign;
  readonly safeArea: boolean;
  readonly maxResolution: number;
}

// Padding in env() values lets getComputedStyle resolve the real insets, so pages need no CSS of their own.
const PROBE_STYLE = [
  "position:fixed", "top:0", "left:0", "width:0", "height:0", "visibility:hidden", "pointer-events:none",
  "padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)",
].join(";");

function readInsets(probe: HTMLElement): ViewportInsets {
  const style = getComputedStyle(probe);
  const px = (value: string): number => Math.max(0, parseFloat(value) || 0);
  return {
    top: px(style.paddingTop),
    right: px(style.paddingRight),
    bottom: px(style.paddingBottom),
    left: px(style.paddingLeft),
  };
}

/**
 * Keeps the `Viewport` resource, the renderer's size and its `root` container in step with the
 * screen. Registered by `pixi2d` as `fenrir.viewport.init` and `fenrir.viewport.preUpdate`.
 *
 * With `design`, listeners on window resize, `visualViewport` resize, orientation and
 * device-pixel-ratio changes mark the layout dirty, and the next frame's PreUpdate applies it,
 * before anything renders. While the game is paused no frame runs, so a callback on the
 * following animation frame applies the layout and renders once.
 */
export function createViewportSystems(opts: ViewportSystemOptions) {
  const { renderer, canvas, design, safeArea, maxResolution } = opts;
  let current: Viewport | undefined;
  let dirty = false;
  let probe: HTMLElement | undefined;

  function measure(): Viewport {
    if (!design) {
      const { width, height } = renderer.app.screen;
      return identityViewport({ width, height }, renderer.app.renderer.resolution ?? 1);
    }
    const screen = { width: window.innerWidth, height: window.innerHeight };
    const resolution = Math.min(maxResolution, window.devicePixelRatio || 1);
    return layoutViewport(design, screen, probe ? readInsets(probe) : NO_INSETS, resolution);
  }

  function update(ctx: SystemCtx): void {
    dirty = false;
    const next = measure();
    if (current && sameViewport(current, next)) return;
    current = next;
    if (design) {
      renderer.resize(next.screen.width, next.screen.height, next.resolution);
      canvas.style.width = `${next.screen.width}px`;
      canvas.style.height = `${next.screen.height}px`;
    }
    renderer.applyViewport(next);
    ctx.resources.set(Viewport, next);
    ctx.events.send(ViewportResized, next);
  }

  return nameEngineSystems("viewport", {
    init(ctx: SystemCtx): void {
      const { signal } = ctx;
      current = undefined;
      dirty = false;

      if (design) {
        // Pinned to the window, the canvas never overflows the page. A canvas still at its old,
        // wider size would make a mobile browser zoom out, and innerWidth would report the zoom.
        Object.assign(canvas.style, { position: "fixed", left: "0", top: "0", display: "block" });
        let pausedFrame: number | null = null;
        const invalidate = (): void => {
          dirty = true;
          if (pausedFrame !== null) return;
          // A running game applies the layout in its next PreUpdate, which comes first in this
          // animation frame. If it is still dirty here, no frame ran: the game is paused or starting.
          pausedFrame = requestAnimationFrame(() => {
            pausedFrame = null;
            if (!dirty || signal.aborted) return;
            update(ctx);
            if (renderer.initialized) renderer.render();
          });
        };
        const options = { signal };
        window.addEventListener("resize", invalidate, options);
        window.visualViewport?.addEventListener("resize", invalidate, options);
        window.screen.orientation?.addEventListener("change", invalidate, options);
        const watchResolution = (): void => {
          if (typeof window.matchMedia !== "function" || signal.aborted) return;
          // Matches only the current ratio, so it changes once; then watch the new ratio.
          window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener("change", () => {
            invalidate();
            watchResolution();
          }, { signal, once: true });
        };
        watchResolution();

        if (safeArea) {
          const element = document.createElement("div");
          element.setAttribute("aria-hidden", "true");
          element.style.cssText = PROBE_STYLE;
          document.body.appendChild(element);
          probe = element;
        }
        ctx.onCleanup(() => {
          if (pausedFrame !== null) cancelAnimationFrame(pausedFrame);
          pausedFrame = null;
          probe?.remove();
          probe = undefined;
          dirty = false;
        });
      }

      update(ctx);
    },
    preUpdate(ctx: SystemCtx): void {
      if (design) {
        if (dirty) update(ctx);
        return;
      }
      // Without design nothing listens: follow the renderer's screen, which only game code resizes.
      const { width, height } = renderer.app.screen;
      if (width !== current?.width || height !== current.height || (renderer.app.renderer.resolution ?? 1) !== current.resolution) {
        update(ctx);
      }
    },
  });
}

// Plain data and maths, no Pixi: core's input (src/core/Input/Input.ts) imports this file to report pointers in
// logical units, and `pnpm check:imports` forbids core reaching pixi.js. Keep it that way.
import { defineEvent } from "../EventQueue";
import { defineResource } from "../Resource";

/** The size a 2D game is designed for, in logical units. See `pixi2d({ design })`. */
export interface ViewportDesign {
  /** Logical width. Always fits the safe area exactly. */
  readonly width: number;
  /** Least logical height. The height grows past it to fill taller screens. */
  readonly minHeight: number;
}

/** Distances in CSS pixels from each edge of the screen. */
export interface ViewportInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** A point in CSS pixels or in logical units. */
export interface ViewportPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where the game's logical frame sits on the screen. Plain data: a new object each time the
 * layout changes, so a held reference is a snapshot.
 *
 * "Screen" is the canvas, in CSS pixels from its top-left corner.
 */
export interface Viewport {
  /** Logical width: the design width, or the screen width without `design`. */
  readonly width: number;
  /** Logical height: at least the design's `minHeight`, or the screen height without `design`. */
  readonly height: number;
  /** CSS pixels per logical unit. 0 while the safe area is empty. */
  readonly scale: number;
  /** Top-left corner of the logical frame on the screen, in CSS pixels. */
  readonly offset: ViewportPoint;
  /** Safe-area insets in use, in CSS pixels. All 0 with `safeArea: false` or without `design`. */
  readonly insets: ViewportInsets;
  /** The whole screen (the canvas), in CSS pixels. Full-bleed content covers this. */
  readonly screen: { readonly width: number; readonly height: number };
  /** Backing-store pixels per CSS pixel: `devicePixelRatio`, capped by `maxResolution`. */
  readonly resolution: number;
}

export const NO_INSETS: ViewportInsets = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

/**
 * The 2D viewport, set by `pixi2d` when the game starts and on every layout change.
 * Before that, or in a game without `pixi2d`, it is the identity: scale 1, offset 0, sizes 0.
 */
export const Viewport = defineResource<Viewport>("fenrir.viewport.Viewport", () => identityViewport({ width: 0, height: 0 }, 1));

/** Sent with the new `Viewport` once at startup and whenever the layout changes after that. */
export const ViewportResized = defineEvent<Viewport>("fenrir.viewport.resized");

/**
 * Lays the design frame out on a screen. The design width fills the safe area's width, and the
 * logical height grows to fill its height; a safe area too short for `minHeight` scales the
 * frame down further, keeps the height at `minHeight` and centres the frame horizontally.
 * Internal: `pixi2d` calls it; tests drive it directly.
 */
export function layoutViewport(
  design: ViewportDesign,
  screen: { readonly width: number; readonly height: number },
  insets: ViewportInsets,
  resolution: number,
): Viewport {
  const safeWidth = Math.max(0, screen.width - insets.left - insets.right);
  const safeHeight = Math.max(0, screen.height - insets.top - insets.bottom);
  const scale = Math.min(safeWidth / design.width, safeHeight / design.minHeight);
  const height = scale > 0 ? Math.max(design.minHeight, safeHeight / scale) : design.minHeight;
  return {
    width: design.width,
    height,
    scale,
    offset: { x: insets.left + (safeWidth - design.width * scale) / 2, y: insets.top },
    insets,
    screen: { width: screen.width, height: screen.height },
    resolution,
  };
}

/** The viewport of a game without `design`: logical units are CSS pixels of the screen. Internal. */
export function identityViewport(screen: { readonly width: number; readonly height: number }, resolution: number): Viewport {
  return {
    width: screen.width,
    height: screen.height,
    scale: 1,
    offset: { x: 0, y: 0 },
    insets: NO_INSETS,
    screen: { width: screen.width, height: screen.height },
    resolution,
  };
}

/** True when two viewports lay out the same. Internal. */
export function sameViewport(a: Viewport, b: Viewport): boolean {
  return a.width === b.width && a.height === b.height && a.scale === b.scale
    && a.offset.x === b.offset.x && a.offset.y === b.offset.y
    && a.insets.top === b.insets.top && a.insets.right === b.insets.right
    && a.insets.bottom === b.insets.bottom && a.insets.left === b.insets.left
    && a.screen.width === b.screen.width && a.screen.height === b.screen.height
    && a.resolution === b.resolution;
}

/**
 * Converts a point on the screen (CSS pixels from the canvas's top-left corner) into logical
 * units. Returns null while the viewport has no area (scale 0).
 */
export function screenToLogical(viewport: Viewport, point: ViewportPoint): ViewportPoint | null {
  if (!(viewport.scale > 0)) return null;
  return {
    x: (point.x - viewport.offset.x) / viewport.scale,
    y: (point.y - viewport.offset.y) / viewport.scale,
  };
}

/** Converts a point in logical units into CSS pixels from the canvas's top-left corner. */
export function logicalToScreen(viewport: Viewport, point: ViewportPoint): ViewportPoint {
  return {
    x: point.x * viewport.scale + viewport.offset.x,
    y: point.y * viewport.scale + viewport.offset.y,
  };
}

import { describe, expect, it } from "vitest";
import {
  NO_INSETS,
  identityViewport,
  layoutViewport,
  logicalToScreen,
  sameViewport,
  screenToLogical,
} from "@/core/Renderer2D/Viewport";

const design = { width: 390, minHeight: 520 };

// Expected values are the layout rule written out: scale = min(safe width / 390, safe height / 520),
// height = max(520, safe height / scale), frame centred horizontally in the safe area, top at the top inset.
const screens = [
  {
    name: "phone portrait with a notch and home bar",
    screen: { width: 390, height: 844 }, insets: { top: 47, right: 0, bottom: 34, left: 0 },
    scale: 1, height: 763, offset: { x: 0, y: 47 },
  },
  {
    name: "tall phone, width-limited, height grows",
    screen: { width: 360, height: 800 }, insets: NO_INSETS,
    scale: 360 / 390, height: 800 / (360 / 390), offset: { x: 0, y: 0 },
  },
  {
    name: "tablet portrait",
    screen: { width: 820, height: 1180 }, insets: NO_INSETS,
    scale: 820 / 390, height: 1180 / (820 / 390), offset: { x: 0, y: 0 },
  },
  {
    name: "landscape desktop, height-limited, centred",
    screen: { width: 1440, height: 900 }, insets: NO_INSETS,
    scale: 900 / 520, height: 520, offset: { x: (1440 - 390 * (900 / 520)) / 2, y: 0 },
  },
  {
    name: "landscape phone with side insets",
    screen: { width: 844, height: 390 }, insets: { top: 0, right: 47, bottom: 21, left: 47 },
    scale: 369 / 520, height: 520, offset: { x: 47 + (750 - 390 * (369 / 520)) / 2, y: 0 },
  },
  {
    name: "shorter than minHeight, scaled down and centred",
    screen: { width: 390, height: 400 }, insets: NO_INSETS,
    scale: 400 / 520, height: 520, offset: { x: (390 - 300) / 2, y: 0 },
  },
  {
    name: "fractional CSS size",
    screen: { width: 393.5, height: 851.25 }, insets: { top: 59.5, right: 0, bottom: 34, left: 0 },
    scale: 393.5 / 390, height: (851.25 - 93.5) / (393.5 / 390), offset: { x: 0, y: 59.5 },
  },
  {
    name: "zero size",
    screen: { width: 0, height: 0 }, insets: NO_INSETS,
    scale: 0, height: 520, offset: { x: 0, y: 0 },
  },
  {
    name: "insets larger than the screen",
    screen: { width: 100, height: 100 }, insets: { top: 80, right: 0, bottom: 80, left: 0 },
    scale: 0, height: 520, offset: { x: 50, y: 80 },
  },
];

describe("layoutViewport", () => {
  it.each(screens)("$name", ({ screen, insets, scale, height, offset }) => {
    const viewport = layoutViewport(design, screen, insets, 2);
    expect(viewport.width).toBe(390);
    expect(viewport.scale).toBeCloseTo(scale, 9);
    expect(viewport.height).toBeCloseTo(height, 9);
    expect(viewport.offset.x).toBeCloseTo(offset.x, 9);
    expect(viewport.offset.y).toBeCloseTo(offset.y, 9);
    expect(viewport.insets).toEqual(insets);
    expect(viewport.screen).toEqual(screen);
    expect(viewport.resolution).toBe(2);
  });

  it.each(screens.filter((s) => s.scale > 0))("keeps the frame inside the safe area: $name", ({ screen, insets }) => {
    const viewport = layoutViewport(design, screen, insets, 1);
    const topLeft = logicalToScreen(viewport, { x: 0, y: 0 });
    const bottomRight = logicalToScreen(viewport, { x: viewport.width, y: viewport.height });
    expect(topLeft.x).toBeGreaterThanOrEqual(insets.left - 1e-9);
    expect(topLeft.y).toBeCloseTo(insets.top, 9);
    expect(bottomRight.x).toBeLessThanOrEqual(screen.width - insets.right + 1e-9);
    // The frame always reaches the bottom of the safe area: the height grows, or the scale shrinks.
    expect(bottomRight.y).toBeCloseTo(screen.height - insets.bottom, 9);
  });
});

describe("screen and logical coordinates", () => {
  it("round-trips a point through logical units and back", () => {
    const viewport = layoutViewport(design, { width: 1440, height: 900 }, { top: 10, right: 0, bottom: 0, left: 20 }, 1);
    for (const point of [{ x: 0, y: 0 }, { x: 720.25, y: 450.5 }, { x: 1440, y: 900 }, { x: -5, y: 1000 }]) {
      const logical = screenToLogical(viewport, point)!;
      const back = logicalToScreen(viewport, logical);
      expect(back.x).toBeCloseTo(point.x, 9);
      expect(back.y).toBeCloseTo(point.y, 9);
    }
    expect(screenToLogical(viewport, viewport.offset)).toEqual({ x: 0, y: 0 });
  });

  it("returns null for a viewport with no area", () => {
    expect(screenToLogical(layoutViewport(design, { width: 0, height: 0 }, NO_INSETS, 1), { x: 1, y: 1 })).toBeNull();
  });

  it("maps CSS pixels one to one without a design", () => {
    const viewport = identityViewport({ width: 800, height: 600 }, 1);
    expect(viewport).toMatchObject({ width: 800, height: 600, scale: 1, offset: { x: 0, y: 0 }, insets: NO_INSETS });
    expect(screenToLogical(viewport, { x: 12, y: 34 })).toEqual({ x: 12, y: 34 });
  });

  it("compares layouts by value", () => {
    const a = layoutViewport(design, { width: 390, height: 844 }, NO_INSETS, 2);
    expect(sameViewport(a, layoutViewport(design, { width: 390, height: 844 }, NO_INSETS, 2))).toBe(true);
    expect(sameViewport(a, layoutViewport(design, { width: 390, height: 844 }, NO_INSETS, 3))).toBe(false);
    expect(sameViewport(a, layoutViewport(design, { width: 390, height: 844 }, { ...NO_INSETS, top: 1 }, 2))).toBe(false);
  });
});

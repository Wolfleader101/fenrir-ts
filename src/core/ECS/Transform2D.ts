import { defineComponent } from "./Component";

/**
 * Position, rotation and scale in 2D, as plain numbers: logical units for `x` and `y`,
 * radians for `rotation`. Opt in per entity; entities still get the default `Transform`.
 * The 2D renderer writes it to an entity's `PixiNode` and `Renderable2D` each frame and
 * prefers it over `Transform` when an entity has both. It is plain data, so game logic and
 * `createTestGame` tests use it with no renderer.
 */
export type Transform2D = {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
};

export const Transform2D = defineComponent<Transform2D>("fenrir.Transform2D");

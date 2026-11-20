import { defineComponent } from "./Component";

/**
 * How an entity's 2D node or `Renderable2D` view is shown: `alpha` from 0 to 1 and `visible`.
 * Opt in per entity. The 2D renderer writes it each frame, with `Transform2D`, and it wins over
 * a `Renderable2D`'s `flags.alpha` and `flags.visible`. Without it the renderer leaves the
 * node's own `alpha` and `visible` alone; removing it leaves the last values written.
 */
export type Display2D = {
  alpha: number;
  visible: boolean;
};

export const Display2D = defineComponent<Display2D>("fenrir.Display2D");

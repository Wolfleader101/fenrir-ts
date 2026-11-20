import type { Container } from "pixi.js";
import { defineComponent } from "../ECS/Component";

/**
 * A Pixi display object the app built, owned by an entity. The 2D renderer mounts `node` in
 * `layer` (a name from `pixi2d({ layers })`), or under the node of the entity's parent when the
 * parent has one, or in `renderer.root`. `layer: "fenrir.backdrop"` mounts it in
 * `renderer.backdrop` instead, where `Transform2D` is in CSS pixels from the screen's corner.
 * Every render writes the entity's `Transform2D` and `Display2D` to it first; without them the
 * app positions and shows the node itself. A child entity's node sorts by `zIndex` under its
 * parent's node: Pixi turns `sortableChildren` on when a child has a non-zero `zIndex`.
 *
 * When the component or the entity is removed, or the run stops, the renderer removes `node`
 * from its parent and destroys it with its children (not their textures). With `keep: true` it
 * only removes it from its parent, and at stop the component stays so the next run mounts it
 * again. A destroyed node's component is removed at stop.
 */
export type PixiNode = {
  readonly node: Container;
  /**
   * A layer from `pixi2d({ layers })`, or `"fenrir.backdrop"` for `renderer.backdrop`. Ignored
   * while the entity's parent has a node.
   */
  readonly layer?: string;
  /** Leave the node alive when it is unmounted, for nodes the app keeps. Defaults to false. */
  readonly keep?: boolean;
};

export const PixiNode = defineComponent<PixiNode>("fenrir.PixiNode");

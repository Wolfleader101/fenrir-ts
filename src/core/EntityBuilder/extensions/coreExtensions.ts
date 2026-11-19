import { EntityBuilder } from "../EntityBuilder";
import {
  Transform,
  Name,
  createDefaultTransform,
  type QuatLike,
  type Vec3Like,
} from "../../ECS/DefaultComponents";
import { Transform2D } from "../../ECS/Transform2D";

// ✅ Tell TS these methods exist on EntityBuilder
declare module "../EntityBuilder" {
  interface EntityBuilder {
    transform(pos?: Vec3Like, rot?: QuatLike, scale?: Vec3Like): EntityBuilder;

    name(value: string): EntityBuilder;

    /** Adds `Transform2D`: `x`, `y` in logical units, `rotation` in radians, scale 1 unless given. */
    transform2D(x?: number, y?: number, options?: { rotation?: number; scaleX?: number; scaleY?: number }): EntityBuilder;
  }
}

EntityBuilder.extend({
  transform(
    this: EntityBuilder,
    pos?: Vec3Like,
    rot?: QuatLike,
    scale?: Vec3Like,
  ) {
    // Defaults come from the installed factory: Three objects once fenrir-ts/3d is loaded.
    const defaults = createDefaultTransform();
    return this.with(Transform, {
      position: pos ?? defaults.position,
      rotation: rot ?? defaults.rotation,
      scale: scale ?? defaults.scale,
    });
  },

  name(this: EntityBuilder, value: string) {
    return this.with(Name, { name: value });
  },

  transform2D(this: EntityBuilder, x = 0, y = 0, options: { rotation?: number; scaleX?: number; scaleY?: number } = {}) {
    // A factory, so every spawn gets its own object.
    return this.with(Transform2D, () => ({ x, y, rotation: options.rotation ?? 0, scaleX: options.scaleX ?? 1, scaleY: options.scaleY ?? 1 }));
  },
});

// Export empty object to make this a module with exports
export {};

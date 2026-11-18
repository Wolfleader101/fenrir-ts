import { EntityBuilder } from "../EntityBuilder";
import {
  Transform,
  Name,
  createDefaultTransform,
  type QuatLike,
  type Vec3Like,
} from "../../ECS/DefaultComponents";

// ✅ Tell TS these methods exist on EntityBuilder
declare module "../EntityBuilder" {
  interface EntityBuilder {
    transform(pos?: Vec3Like, rot?: QuatLike, scale?: Vec3Like): EntityBuilder;

    name(value: string): EntityBuilder;
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
});

// Export empty object to make this a module with exports
export {};

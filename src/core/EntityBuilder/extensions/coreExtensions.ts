import { EntityBuilder } from "../EntityBuilder";
import { Transform, Name } from "../../ECS/DefaultComponents";
import { Quaternion, Vector3 } from "three";

// ✅ Tell TS these methods exist on EntityBuilder
declare module "../EntityBuilder" {
  interface EntityBuilder {
    transform(pos?: Vector3, rot?: Quaternion, scale?: Vector3): EntityBuilder;

    name(value: string): EntityBuilder;
  }
}

EntityBuilder.extend({
  transform(
    this: EntityBuilder,
    pos = new Vector3(),
    rot = new Quaternion(),
    scale = new Vector3(1, 1, 1),
  ) {
    return this.with(Transform, {
      position: pos,
      rotation: rot,
      scale,
    });
  },

  name(this: EntityBuilder, value: string) {
    return this.with(Name, { name: value });
  },
});

// Export empty object to make this a module with exports
export {};

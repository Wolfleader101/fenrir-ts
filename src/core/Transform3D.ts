import { Quaternion, Vector3 } from "three";
import { defineComponent } from "./ECS/Component";
import { setDefaultTransformFactory } from "./ECS/DefaultComponents";

/**
 * The engine's `fenrir.Transform` component, typed with Three's classes.
 *
 * It is the same component as `Transform` from `fenrir-ts`: identity is the name,
 * so both keys read and write the same storage. Loading this module makes every
 * default transform out of Three objects, which the 3D renderer, camera and
 * physics rely on.
 */
export type Transform = {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
};

export const Transform = defineComponent<Transform>("fenrir.Transform");

setDefaultTransformFactory(() => ({
  position: new Vector3(),
  rotation: new Quaternion(),
  scale: new Vector3(1, 1, 1),
}));

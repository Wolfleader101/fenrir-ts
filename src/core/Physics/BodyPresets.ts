import type { Vector3 } from "three";
import type { EntityBuilder } from "../EntityBuilder";
import { MotionType, PhysicsBody, createPhysicsBody } from "./components/PhysicsBody";
import { CommonMaterials, PhysicsMaterial } from "./components/PhysicsMaterial";
import { PhysicsShape, ShapeBuilder } from "./components/PhysicsShape";

// Each preset adds three components to the builder it is given, so it takes the builder rather
// than returning one value for `with`. Each is a plain function a bundler drops when unused.

function body<B extends EntityBuilder>(builder: B, motionType: MotionType, shape: PhysicsShape, material: PhysicsMaterial, mass?: number): B {
  return builder
    .with(PhysicsBody, createPhysicsBody({ motionType, mass }))
    .with(PhysicsShape, shape)
    .with(PhysicsMaterial, material);
}

/**
 * Adds a dynamic `PhysicsBody` of `mass`, a box `PhysicsShape` of `halfExtents` and the `default`
 * material to `builder`, and returns it:
 *
 * ```ts
 * dynamicBox(EntityBuilder.create().transform(new Vector3(0, 5, 0)), new Vector3(0.5, 0.5, 0.5), 2).spawn(entities);
 * ```
 *
 * Add `with(PhysicsMaterial, CommonMaterials.wood())` after it to change the material.
 */
export function dynamicBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3, mass?: number): B {
  return body(builder, MotionType.Dynamic, ShapeBuilder.box(halfExtents), CommonMaterials.default(), mass);
}

/** Adds a dynamic `PhysicsBody` of `mass`, a sphere `PhysicsShape` of `radius` and the `rubber` material to `builder`, and returns it. */
export function dynamicSphere<B extends EntityBuilder>(builder: B, radius: number, mass?: number): B {
  return body(builder, MotionType.Dynamic, ShapeBuilder.sphere(radius), CommonMaterials.rubber(), mass);
}

/** Adds a static `PhysicsBody`, a box `PhysicsShape` of `halfExtents` and the `stone` material to `builder`, and returns it. */
export function staticBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3): B {
  return body(builder, MotionType.Static, ShapeBuilder.box(halfExtents), CommonMaterials.stone());
}

/** Adds a static `PhysicsBody`, a sphere `PhysicsShape` of `radius` and the `stone` material to `builder`, and returns it. */
export function staticSphere<B extends EntityBuilder>(builder: B, radius: number): B {
  return body(builder, MotionType.Static, ShapeBuilder.sphere(radius), CommonMaterials.stone());
}

/** Adds a kinematic `PhysicsBody`, a box `PhysicsShape` of `halfExtents` and the `default` material to `builder`, and returns it. */
export function kinematicBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3): B {
  return body(builder, MotionType.Kinematic, ShapeBuilder.box(halfExtents), CommonMaterials.default());
}

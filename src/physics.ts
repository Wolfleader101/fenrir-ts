/**
 * Fenrir-TS physics: the `fenrir-ts/physics` entry point. Peer: `jolt-physics`
 * (and `three`, whose vectors it uses). Frozen: kept working and tested, no new
 * features.
 *
 * Importing it also, for this program:
 * - adds `physics?: PhysicsHelpers` to SystemCtx (set by the physics system's init)
 * - makes every default `Transform` out of Three objects, which the physics
 *   system writes into
 *
 * It patches no `EntityBuilder` method: entities get physics with the builder's `with`, as
 * `with(PhysicsBody, createPhysicsBody({ motionType }))`, `with(PhysicsShape, ShapeBuilder.box(halfExtents))`
 * and `with(PhysicsMaterial, CommonMaterials.stone())`, or with a preset such as
 * `dynamicBox(builder, halfExtents, mass)`.
 */

// Side effect: Three default transforms.
import "./core/Transform3D";

export * from "./core/Physics";

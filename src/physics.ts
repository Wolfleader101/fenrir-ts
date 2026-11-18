/**
 * Fenrir-TS physics: the `fenrir-ts/physics` entry point. Peer: `jolt-physics`
 * (and `three`, whose vectors it uses). Frozen: kept working and tested, no new
 * features.
 *
 * Importing it also, for this program:
 * - adds `physics?: PhysicsHelpers` to SystemCtx (set by the physics system's init)
 * - adds the physics EntityBuilder methods
 * - makes every default `Transform` out of Three objects, which the physics
 *   system writes into
 */

// Side effects: Three default transforms and EntityBuilder patches.
import "./core/Transform3D";
import "./core/EntityBuilder/extensions/physicsExtensions";

export * from "./core/EntityBuilder/extensions/physicsExtensions";
export * from "./core/Physics";

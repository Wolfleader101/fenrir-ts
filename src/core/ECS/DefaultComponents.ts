import { defineComponent } from "./Component";
import type { Entity, EntityList } from "./EntityList";

/** A 3D vector as the core reads it. Three's `Vector3` satisfies it. */
export type Vec3Like = { x: number; y: number; z: number };

/** A rotation quaternion as the core reads it. Three's `Quaternion` satisfies it. */
export type QuatLike = { x: number; y: number; z: number; w: number };

/**
 * Position, rotation and scale. Core and the 2D renderer only read the fields.
 * `fenrir-ts/3d` exports the same component typed with Three's classes, and once
 * it is loaded every default transform is made of Three objects.
 */
export type Transform = {
  position: Vec3Like;
  rotation: QuatLike;
  scale: Vec3Like;
};

export const Transform = defineComponent<Transform>("fenrir.Transform");

let makeDefaultTransform = (): Transform => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1 },
  scale: { x: 1, y: 1, z: 1 },
});

/** A new identity transform, from the factory currently installed. */
export function createDefaultTransform(): Transform {
  return makeDefaultTransform();
}

/**
 * Replaces the factory for default transforms. The 3D entry calls this so that
 * entities get Three `Vector3` and `Quaternion` values. Internal, not exported
 * from any entry point.
 */
export function setDefaultTransformFactory(factory: () => Transform): void {
  makeDefaultTransform = factory;
}

/** The engine's name component (`fenrir.Name`), set by `EntityBuilder.name()`. `inspect()` shows it as the entity's `name`. */
export type Name = {
  name: string;
};

export const Name = defineComponent<Name>("fenrir.Name");

/** The engine's parent and sibling links (`fenrir.Relationship`), set by `EntityBuilder.child()` and `spawnInto`. `inspect()` shows it as `parent`. */
export type Relationship = {
  parent: Entity;
  firstChild: Entity;
  nextSibling: Entity;
  prevSibling: Entity;
};

export const Relationship = defineComponent<Relationship>("fenrir.Relationship");

// Helper creator so you never allocate new objects accidentally elsewhere
export function makeRelationship(nullEntity: Entity): Relationship {
  return {
    parent: nullEntity,
    firstChild: nullEntity,
    nextSibling: nullEntity,
    prevSibling: nullEntity,
  };
}

export function applyDefaultComponents(entities: EntityList, e: Entity) {
  entities.set(e, Transform, makeDefaultTransform());

  entities.set(e, Name, { name: `Entity ${entities.idOf(e)}` });
  entities.set(e, Relationship, makeRelationship(entities.nullEntity()));
}

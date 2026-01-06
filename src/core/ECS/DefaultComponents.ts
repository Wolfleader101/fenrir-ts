import { Vector3, Quaternion } from "three";
import { defineComponent } from "./Component";
import type { Entity, EntityList } from "./EntityList";

export type Transform = {
  position: Vector3;
  rotation: Quaternion;
  scale: Vector3;
};

export const Transform = defineComponent<Transform>("Transform");

export type Name = {
  name: string;
};

export const Name = defineComponent<Name>("Name");

export type Relationship = {
  parent: Entity;
  firstChild: Entity;
  nextSibling: Entity;
  prevSibling: Entity;
};

export const Relationship = defineComponent<Relationship>("Relationship");

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
  entities.set(e, Transform, {
    position: new Vector3(),
    rotation: new Quaternion(),
    scale: new Vector3(1, 1, 1),
  });

  entities.set(e, Name, { name: `Entity ${entities.idOf(e)}` });
  entities.set(e, Relationship, makeRelationship(entities.nullEntity()));
}

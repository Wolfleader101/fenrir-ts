import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { Transform as CoreTransform } from "@/core/ECS/DefaultComponents";
import { EntityList } from "@/core/ECS/EntityList";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { Transform } from "@/core/Transform3D";

describe("Transform3D", () => {
  it("is the same component as the core Transform", () => {
    expect(Transform).toBe(CoreTransform);
  });

  it("makes default transforms out of Three objects once loaded", () => {
    const entities = new EntityList();
    const transform = entities.get(entities.createEntity(), Transform);

    expect(transform.position).toBeInstanceOf(Vector3);
    expect(transform.rotation).toBeInstanceOf(Quaternion);
    expect(transform.scale).toBeInstanceOf(Vector3);
    expect(transform.position.toArray()).toEqual([0, 0, 0]);
    expect(transform.rotation.toArray()).toEqual([0, 0, 0, 1]);
    expect(transform.scale.toArray()).toEqual([1, 1, 1]);
  });

  it("gives each entity its own vectors", () => {
    const entities = new EntityList();
    const a = entities.get(entities.createEntity(), Transform);
    const b = entities.get(entities.createEntity(), Transform);
    a.position.set(1, 2, 3);
    expect(b.position.toArray()).toEqual([0, 0, 0]);
  });

  it("uses Three objects for the builder's default transform", () => {
    const entities = new EntityList();
    const entity = EntityBuilder.create().transform().spawn(entities);
    const transform = entities.get(entity, Transform);

    expect(transform.position).toBeInstanceOf(Vector3);
    expect(transform.rotation).toBeInstanceOf(Quaternion);
    expect(transform.scale.toArray()).toEqual([1, 1, 1]);
  });
});

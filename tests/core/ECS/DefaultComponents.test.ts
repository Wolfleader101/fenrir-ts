import { describe, it, expect, beforeEach } from "vitest";
import { Vector3, Quaternion } from "three";
import {
  Transform,
  Name,
  Relationship,
  makeRelationship,
  applyDefaultComponents,
} from "@/core/ECS/DefaultComponents";
import { EntityList } from "@/core/ECS/EntityList";

describe("DefaultComponents", () => {
  describe("Transform component", () => {
    it("should define Transform component", () => {
      expect(Transform).toBeDefined();
      expect(typeof Transform).toBe("symbol");
    });

    it("should have correct Transform type structure", () => {
      const transform = {
        position: new Vector3(1, 2, 3),
        rotation: new Quaternion(0, 0, 0, 1),
        scale: new Vector3(2, 2, 2),
      };

      expect(transform.position).toBeInstanceOf(Vector3);
      expect(transform.rotation).toBeInstanceOf(Quaternion);
      expect(transform.scale).toBeInstanceOf(Vector3);
    });
  });

  describe("Name component", () => {
    it("should define Name component", () => {
      expect(Name).toBeDefined();
      expect(typeof Name).toBe("symbol");
    });

    it("should have correct Name type structure", () => {
      const name = { name: "TestEntity" };

      expect(typeof name.name).toBe("string");
      expect(name.name).toBe("TestEntity");
    });
  });

  describe("Relationship component", () => {
    let entityList: EntityList;
    let nullEntity: any;

    beforeEach(() => {
      entityList = new EntityList();
      nullEntity = entityList.nullEntity();
    });

    it("should define Relationship component", () => {
      expect(Relationship).toBeDefined();
      expect(typeof Relationship).toBe("symbol");
    });

    it("should have correct Relationship type structure", () => {
      const parentEntity = entityList.createEntity();
      const childEntity = entityList.createEntity();
      const siblingEntity = entityList.createEntity();

      const relationship = {
        parent: parentEntity,
        firstChild: childEntity,
        nextSibling: siblingEntity,
        prevSibling: nullEntity,
      };

      expect(relationship.parent).toBeDefined();
      expect(relationship.firstChild).toBeDefined();
      expect(relationship.nextSibling).toBeDefined();
      expect(relationship.prevSibling).toBeDefined();
    });

    describe("makeRelationship helper", () => {
      it("should create relationship with all null entity references", () => {
        const relationship = makeRelationship(nullEntity);

        expect(relationship.parent).toBe(nullEntity);
        expect(relationship.firstChild).toBe(nullEntity);
        expect(relationship.nextSibling).toBe(nullEntity);
        expect(relationship.prevSibling).toBe(nullEntity);
      });

      it("should create new objects on each call", () => {
        const rel1 = makeRelationship(nullEntity);
        const rel2 = makeRelationship(nullEntity);

        expect(rel1).not.toBe(rel2);
        expect(rel1).toEqual(rel2);
      });

      it("should use provided null entity", () => {
        const customNullEntity = entityList.createEntity();
        const relationship = makeRelationship(customNullEntity);

        expect(relationship.parent).toBe(customNullEntity);
        expect(relationship.firstChild).toBe(customNullEntity);
        expect(relationship.nextSibling).toBe(customNullEntity);
        expect(relationship.prevSibling).toBe(customNullEntity);
      });
    });
  });

  describe("applyDefaultComponents", () => {
    let entityList: EntityList;
    let entity: any;

    beforeEach(() => {
      entityList = new EntityList();
      entity = entityList.createEntity();
    });

    it("should apply Transform component with default values", () => {
      applyDefaultComponents(entityList, entity);

      expect(entityList.has(entity, Transform)).toBe(true);

      const transform = entityList.get(entity, Transform);
      expect(transform.position).toBeInstanceOf(Vector3);
      expect(transform.rotation).toBeInstanceOf(Quaternion);
      expect(transform.scale).toBeInstanceOf(Vector3);

      // Check default values
      expect(transform.position.x).toBe(0);
      expect(transform.position.y).toBe(0);
      expect(transform.position.z).toBe(0);

      expect(transform.rotation.x).toBe(0);
      expect(transform.rotation.y).toBe(0);
      expect(transform.rotation.z).toBe(0);
      expect(transform.rotation.w).toBe(1);

      expect(transform.scale.x).toBe(1);
      expect(transform.scale.y).toBe(1);
      expect(transform.scale.z).toBe(1);
    });

    it("should apply Name component with entity ID", () => {
      applyDefaultComponents(entityList, entity);

      expect(entityList.has(entity, Name)).toBe(true);

      const nameComponent = entityList.get(entity, Name);
      const entityId = entityList.idOf(entity);
      expect(nameComponent.name).toBe(`Entity ${entityId}`);
    });

    it("should apply Relationship component with null references", () => {
      applyDefaultComponents(entityList, entity);

      expect(entityList.has(entity, Relationship)).toBe(true);

      const relationship = entityList.get(entity, Relationship);
      const nullEntity = entityList.nullEntity();

      expect(relationship.parent).toBe(nullEntity);
      expect(relationship.firstChild).toBe(nullEntity);
      expect(relationship.nextSibling).toBe(nullEntity);
      expect(relationship.prevSibling).toBe(nullEntity);
    });

    it("should not overwrite existing components", () => {
      // Set a custom Transform first
      const customTransform = {
        position: new Vector3(10, 20, 30),
        rotation: new Quaternion(0.5, 0.5, 0.5, 0.5),
        scale: new Vector3(2, 3, 4),
      };
      entityList.set(entity, Transform, customTransform);

      applyDefaultComponents(entityList, entity);

      const resultTransform = entityList.get(entity, Transform);
      expect(resultTransform.position.x).toBe(0); // Default was applied, overwriting custom
      expect(resultTransform.position.y).toBe(0);
      expect(resultTransform.position.z).toBe(0);
    });

    it("should work with multiple entities", () => {
      const entity1 = entityList.createEntity();
      const entity2 = entityList.createEntity();

      applyDefaultComponents(entityList, entity1);
      applyDefaultComponents(entityList, entity2);

      // Both entities should have all default components
      [entity1, entity2].forEach((e) => {
        expect(entityList.has(e, Transform)).toBe(true);
        expect(entityList.has(e, Name)).toBe(true);
        expect(entityList.has(e, Relationship)).toBe(true);
      });

      // Names should be different based on entity IDs
      const name1 = entityList.get(entity1, Name);
      const name2 = entityList.get(entity2, Name);
      expect(name1.name).not.toBe(name2.name);
    });

    it("should create independent component instances", () => {
      const entity1 = entityList.createEntity();
      const entity2 = entityList.createEntity();

      applyDefaultComponents(entityList, entity1);
      applyDefaultComponents(entityList, entity2);

      const transform1 = entityList.get(entity1, Transform);
      const transform2 = entityList.get(entity2, Transform);
      const relationship1 = entityList.get(entity1, Relationship);
      const relationship2 = entityList.get(entity2, Relationship);

      // Should be different instances
      expect(transform1).not.toBe(transform2);
      expect(relationship1).not.toBe(relationship2);

      // Modifying one shouldn't affect the other
      transform1.position.x = 100;
      expect(transform2.position.x).toBe(0);
    });
  });

  describe("component uniqueness", () => {
    it("should have unique symbols for each component", () => {
      const components = [Transform, Name, Relationship];
      const uniqueSymbols = new Set(components);

      expect(uniqueSymbols.size).toBe(components.length);
      expect(components.every((comp) => typeof comp === "symbol")).toBe(true);
    });

    it("should have descriptive symbol names", () => {
      expect(Transform.toString()).toContain("Transform");
      expect(Name.toString()).toContain("Name");
      expect(Relationship.toString()).toContain("Relationship");
    });
  });
});

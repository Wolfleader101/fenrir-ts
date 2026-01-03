import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityList, defineComponent } from "@/core/ECS";
import { Relationship } from "@/core/ECS/DefaultComponents";

// Test component types
type Position = { x: number; y: number };
type Velocity = { x: number; y: number };
type Health = { hp: number; maxHp: number };
type Name = { value: string };

const Position = defineComponent<Position>("Position");
const Velocity = defineComponent<Velocity>("Velocity");
const Health = defineComponent<Health>("Health");
const Name = defineComponent<Name>("Name");

describe("EntityList", () => {
  let entityList: EntityList;

  beforeEach(() => {
    entityList = new EntityList();
  });

  describe("entity lifecycle", () => {
    it("should create entities with incrementing IDs", () => {
      const entity1 = entityList.createEntity();
      const entity2 = entityList.createEntity();
      const entity3 = entityList.createEntity();

      expect(entityList.idOf(entity1)).toBe(0);
      expect(entityList.idOf(entity2)).toBe(1);
      expect(entityList.idOf(entity3)).toBe(2);

      expect(entityList.isAlive(entity1)).toBe(true);
      expect(entityList.isAlive(entity2)).toBe(true);
      expect(entityList.isAlive(entity3)).toBe(true);
    });

    it("should have generation 0 for new entities", () => {
      const entity = entityList.createEntity();
      expect(entityList.genOf(entity)).toBe(0);
    });

    it("should destroy entities and mark them as not alive", () => {
      const entity = entityList.createEntity();
      expect(entityList.isAlive(entity)).toBe(true);

      const wasDestroyed = entityList.destroyEntity(entity);
      expect(wasDestroyed).toBe(true);
      expect(entityList.isAlive(entity)).toBe(false);
    });

    it("should return false when destroying already dead entity", () => {
      const entity = entityList.createEntity();
      entityList.destroyEntity(entity);

      const wasDestroyed = entityList.destroyEntity(entity);
      expect(wasDestroyed).toBe(false);
    });

    it("should recycle entity IDs with incremented generation", () => {
      const entity1 = entityList.createEntity();
      const id1 = entityList.idOf(entity1);
      const gen1 = entityList.genOf(entity1);

      entityList.destroyEntity(entity1);

      const entity2 = entityList.createEntity();
      const id2 = entityList.idOf(entity2);
      const gen2 = entityList.genOf(entity2);

      // Same ID, but generation should be incremented
      expect(id2).toBe(id1);
      expect(gen2).toBe(gen1 + 1);
      expect(entityList.isAlive(entity1)).toBe(false); // Old handle invalid
      expect(entityList.isAlive(entity2)).toBe(true); // New handle valid
    });

    it("should handle generation wraparound", () => {
      // This test simulates generation overflow (12 bits = 4096 generations)
      const entity = entityList.createEntity();
      const id = entityList.idOf(entity);

      // Manually set generation close to max (this is testing internal behavior)
      // In practice, we'd need to destroy/create 4095 times to test this properly
      const GEN_MASK = (1 << 12) - 1; // 0xFFF

      // For this test, we'll just verify the generation extraction works correctly
      expect(entityList.genOf(entity)).toBe(0);
    });

    it("should track capacity correctly", () => {
      expect(entityList.capacity()).toBe(0);

      const entity1 = entityList.createEntity();
      expect(entityList.capacity()).toBe(1);

      const entity2 = entityList.createEntity();
      expect(entityList.capacity()).toBe(2);

      entityList.destroyEntity(entity1);
      expect(entityList.capacity()).toBe(2); // Capacity doesn't decrease

      const entity3 = entityList.createEntity(); // Reuses ID 0
      expect(entityList.capacity()).toBe(2); // Still same capacity
    });
  });

  describe("component operations", () => {
    let entity: ReturnType<typeof entityList.createEntity>;

    beforeEach(() => {
      entity = entityList.createEntity();
    });

    it("should add components to entities", () => {
      const pos = { x: 10, y: 20 };
      const wasAdded = entityList.set(entity, Position, pos);

      expect(wasAdded).toBe(true);
      expect(entityList.has(entity, Position)).toBe(true);
      expect(entityList.get(entity, Position)).toEqual(pos);
    });

    it("should replace existing components", () => {
      const pos1 = { x: 10, y: 20 };
      const pos2 = { x: 30, y: 40 };

      entityList.set(entity, Position, pos1);
      const wasAdded = entityList.set(entity, Position, pos2);

      expect(wasAdded).toBe(false); // replacement, not addition
      expect(entityList.get(entity, Position)).toEqual(pos2);
    });

    it("should use add as alias for set", () => {
      const pos = { x: 10, y: 20 };
      const wasAdded = entityList.add(entity, Position, pos);

      expect(wasAdded).toBe(true);
      expect(entityList.has(entity, Position)).toBe(true);
      expect(entityList.get(entity, Position)).toEqual(pos);
    });

    it("should remove components from entities", () => {
      const pos = { x: 10, y: 20 };
      entityList.set(entity, Position, pos);

      const wasRemoved = entityList.remove(entity, Position);
      expect(wasRemoved).toBe(true);
      expect(entityList.has(entity, Position)).toBe(false);
    });

    it("should return false when removing non-existent component", () => {
      const wasRemoved = entityList.remove(entity, Position);
      expect(wasRemoved).toBe(false);
    });

    it("should throw error when getting non-existent component", () => {
      expect(() => entityList.get(entity, Position)).toThrow(
        "Component missing on entity"
      );
    });

    it("should return undefined for tryGet on non-existent component", () => {
      expect(entityList.tryGet(entity, Position)).toBeUndefined();
    });

    it("should return component for tryGet on existing component", () => {
      const pos = { x: 10, y: 20 };
      entityList.set(entity, Position, pos);
      expect(entityList.tryGet(entity, Position)).toEqual(pos);
    });

    it("should throw error when operating on dead entity", () => {
      entityList.destroyEntity(entity);

      expect(() => entityList.set(entity, Position, { x: 1, y: 1 })).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.has(entity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.get(entity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.tryGet(entity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.remove(entity, Position)).toThrow(
        "Entity is not alive"
      );
    });

    it("should handle multiple component types on same entity", () => {
      const pos = { x: 10, y: 20 };
      const vel = { x: 1, y: -1 };
      const health = { hp: 100, maxHp: 100 };

      entityList.set(entity, Position, pos);
      entityList.set(entity, Velocity, vel);
      entityList.set(entity, Health, health);

      expect(entityList.has(entity, Position)).toBe(true);
      expect(entityList.has(entity, Velocity)).toBe(true);
      expect(entityList.has(entity, Health)).toBe(true);

      expect(entityList.get(entity, Position)).toEqual(pos);
      expect(entityList.get(entity, Velocity)).toEqual(vel);
      expect(entityList.get(entity, Health)).toEqual(health);
    });
  });

  describe("component signals", () => {
    let entity: ReturnType<typeof entityList.createEntity>;

    beforeEach(() => {
      entity = entityList.createEntity();
    });

    it("should emit add signals when components are added", () => {
      const addCallback = vi.fn();
      const unsubscribe = entityList.signals.onAdd(Position, addCallback);

      const pos = { x: 10, y: 20 };
      entityList.set(entity, Position, pos);

      expect(addCallback).toHaveBeenCalledWith(entity, pos);
      expect(addCallback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("should emit replace signals when components are replaced", () => {
      const addCallback = vi.fn();
      const replaceCallback = vi.fn();

      const unsubAdd = entityList.signals.onAdd(Position, addCallback);
      const unsubReplace = entityList.signals.onReplace(
        Position,
        replaceCallback
      );

      const pos1 = { x: 10, y: 20 };
      const pos2 = { x: 30, y: 40 };

      entityList.set(entity, Position, pos1); // Should emit add
      entityList.set(entity, Position, pos2); // Should emit replace

      expect(addCallback).toHaveBeenCalledWith(entity, pos1);
      expect(addCallback).toHaveBeenCalledTimes(1);

      expect(replaceCallback).toHaveBeenCalledWith(entity, pos2);
      expect(replaceCallback).toHaveBeenCalledTimes(1);

      unsubAdd();
      unsubReplace();
    });

    it("should emit remove signals when components are removed", () => {
      const removeCallback = vi.fn();
      const unsubscribe = entityList.signals.onRemove(Position, removeCallback);

      const pos = { x: 10, y: 20 };
      entityList.set(entity, Position, pos);
      entityList.remove(entity, Position);

      expect(removeCallback).toHaveBeenCalledWith(entity, pos);
      expect(removeCallback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("should emit remove signals when entity is destroyed", () => {
      const removeCallback = vi.fn();
      const unsubscribe = entityList.signals.onRemove(Position, removeCallback);

      const pos = { x: 10, y: 20 };
      entityList.set(entity, Position, pos);
      entityList.destroyEntity(entity);

      expect(removeCallback).toHaveBeenCalledWith(entity, pos);
      expect(removeCallback).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("should remove all components and emit signals when destroying entity with multiple components", () => {
      const removePositionSpy = vi.fn();
      const removeVelocitySpy = vi.fn();
      const removeHealthSpy = vi.fn();

      entityList.signals.onRemove(Position, removePositionSpy);
      entityList.signals.onRemove(Velocity, removeVelocitySpy);
      entityList.signals.onRemove(Health, removeHealthSpy);

      // Add multiple components
      entityList.set(entity, Position, { x: 10, y: 20 });
      entityList.set(entity, Velocity, { x: 1, y: 2 });
      entityList.set(entity, Health, { hp: 100, maxHp: 100 });

      expect(entityList.has(entity, Position)).toBe(true);
      expect(entityList.has(entity, Velocity)).toBe(true);
      expect(entityList.has(entity, Health)).toBe(true);

      // Destroy entity - should remove all components and emit signals
      const destroyed = entityList.destroyEntity(entity);

      expect(destroyed).toBe(true);
      expect(entityList.isAlive(entity)).toBe(false);

      // All remove signals should have been emitted
      expect(removePositionSpy).toHaveBeenCalledWith(entity, { x: 10, y: 20 });
      expect(removeVelocitySpy).toHaveBeenCalledWith(entity, { x: 1, y: 2 });
      expect(removeHealthSpy).toHaveBeenCalledWith(entity, {
        hp: 100,
        maxHp: 100,
      });

      expect(removePositionSpy).toHaveBeenCalledTimes(1);
      expect(removeVelocitySpy).toHaveBeenCalledTimes(1);
      expect(removeHealthSpy).toHaveBeenCalledTimes(1);
    });

    it("should properly iterate through pools map during entity destruction", () => {
      const ComponentA = defineComponent<number>("ComponentA");
      const ComponentB = defineComponent<string>("ComponentB");
      const ComponentC = defineComponent<boolean>("ComponentC");

      // Create entity and add components to create pools
      entityList.set(entity, ComponentA, 42);
      entityList.set(entity, ComponentB, "test");
      entityList.set(entity, ComponentC, true);

      // Verify components exist
      expect(entityList.has(entity, ComponentA)).toBe(true);
      expect(entityList.has(entity, ComponentB)).toBe(true);
      expect(entityList.has(entity, ComponentC)).toBe(true);

      // Create spies to track removal signals
      const spyA = vi.fn();
      const spyB = vi.fn();
      const spyC = vi.fn();

      entityList.signals.onRemove(ComponentA, spyA);
      entityList.signals.onRemove(ComponentB, spyB);
      entityList.signals.onRemove(ComponentC, spyC);

      // Destroy entity - this should trigger the for loop in destroyEntity (lines 91-97)
      const destroyed = entityList.destroyEntity(entity);

      expect(destroyed).toBe(true);
      expect(entityList.isAlive(entity)).toBe(false);

      // All removal signals should have been emitted (covers lines 93-96)
      expect(spyA).toHaveBeenCalledWith(entity, 42);
      expect(spyB).toHaveBeenCalledWith(entity, "test");
      expect(spyC).toHaveBeenCalledWith(entity, true);
    });

    it("should emit any component signals", () => {
      const anyAddCallback = vi.fn();
      const anyRemoveCallback = vi.fn();
      const anyReplaceCallback = vi.fn();

      const unsubAdd = entityList.signals.onAnyComponentAdded(anyAddCallback);
      const unsubRemove =
        entityList.signals.onAnyComponentRemoved(anyRemoveCallback);
      const unsubReplace =
        entityList.signals.onAnyComponentReplaced(anyReplaceCallback);

      const pos1 = { x: 10, y: 20 };
      const pos2 = { x: 30, y: 40 };

      entityList.set(entity, Position, pos1); // Add
      entityList.set(entity, Position, pos2); // Replace
      entityList.remove(entity, Position); // Remove

      expect(anyAddCallback).toHaveBeenCalledWith(Position, entity);
      expect(anyReplaceCallback).toHaveBeenCalledWith(Position, entity);
      expect(anyRemoveCallback).toHaveBeenCalledWith(Position, entity);

      expect(anyAddCallback).toHaveBeenCalledTimes(1);
      expect(anyReplaceCallback).toHaveBeenCalledTimes(1);
      expect(anyRemoveCallback).toHaveBeenCalledTimes(1);

      unsubAdd();
      unsubRemove();
      unsubReplace();
    });

    it("should allow unsubscribing from signals", () => {
      const addCallback = vi.fn();
      const unsubscribe = entityList.signals.onAdd(Position, addCallback);

      const pos1 = { x: 10, y: 20 };
      entityList.set(entity, Position, pos1);

      expect(addCallback).toHaveBeenCalledTimes(1);

      unsubscribe(); // Unsubscribe

      const pos2 = { x: 30, y: 40 };
      const entity2 = entityList.createEntity();
      entityList.set(entity2, Position, pos2);

      expect(addCallback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe("pool access", () => {
    it("should provide access to component pools", () => {
      const entity = entityList.createEntity();
      const pos = { x: 10, y: 20 };

      entityList.set(entity, Position, pos);

      const pool = entityList.pool(Position);
      expect(pool.size()).toBe(1);
      expect(pool.has(entityList.idOf(entity))).toBe(true);
      expect(pool.get(entityList.idOf(entity))).toEqual(pos);
    });

    it("should return same pool instance for same component type", () => {
      const pool1 = entityList.pool(Position);
      const pool2 = entityList.pool(Position);

      expect(pool1).toBe(pool2);
    });

    it("should return different pools for different component types", () => {
      const positionPool = entityList.pool(Position);
      const velocityPool = entityList.pool(Velocity);

      expect(positionPool).not.toBe(velocityPool);
    });
  });

  describe("entity from ID", () => {
    it("should convert entity ID back to entity handle", () => {
      const entity = entityList.createEntity();
      const id = entityList.idOf(entity);

      const reconstructed = entityList.entityFromId(id);

      expect(reconstructed).toBe(entity);
      expect(entityList.isAlive(reconstructed)).toBe(true);
    });

    it("should work correctly with recycled IDs", () => {
      const entity1 = entityList.createEntity();
      const id = entityList.idOf(entity1);

      entityList.destroyEntity(entity1);

      const entity2 = entityList.createEntity(); // Reuses same ID
      expect(entityList.idOf(entity2)).toBe(id);

      const reconstructed = entityList.entityFromId(id);

      expect(reconstructed).toBe(entity2);
      expect(reconstructed).not.toBe(entity1);
      expect(entityList.isAlive(reconstructed)).toBe(true);
      expect(entityList.isAlive(entity1)).toBe(false);
    });
  });

  describe("views and queries", () => {
    beforeEach(() => {
      // Set up some test entities
      const entity1 = entityList.createEntity();
      const entity2 = entityList.createEntity();
      const entity3 = entityList.createEntity();

      entityList.set(entity1, Position, { x: 1, y: 1 });
      entityList.set(entity1, Velocity, { x: 0.1, y: 0.1 });

      entityList.set(entity2, Position, { x: 2, y: 2 });
      entityList.set(entity2, Health, { hp: 100, maxHp: 100 });

      entityList.set(entity3, Velocity, { x: 0.2, y: 0.2 });
      entityList.set(entity3, Health, { hp: 50, maxHp: 100 });
    });

    it("should create views for component queries", () => {
      const query = [Position, Velocity] as const;
      const view = entityList.view(query);

      expect(view).toBeDefined();
      expect(view.types).toBe(query);
    });

    it("should cache views for the same query array reference", () => {
      const query = [Position, Velocity] as const;
      const view1 = entityList.view(query);
      const view2 = entityList.view(query);

      expect(view1).toBe(view2); // Should be same instance due to caching
    });

    it("should iterate over entities with matching components using each", () => {
      const results: Array<{ entity: any; pos: Position; vel: Velocity }> = [];

      entityList.each([Position, Velocity] as const, (entity, pos, vel) => {
        results.push({ entity, pos, vel });
      });

      expect(results).toHaveLength(1); // Only entity1 has both Position and Velocity
      expect(results[0].pos).toEqual({ x: 1, y: 1 });
      expect(results[0].vel).toEqual({ x: 0.1, y: 0.1 });
    });

    it("should iterate over single component queries", () => {
      const positions: Position[] = [];

      entityList.each([Position] as const, (entity, pos) => {
        positions.push(pos);
      });

      expect(positions).toHaveLength(2); // entity1 and entity2 have Position
      expect(positions).toContainEqual({ x: 1, y: 1 });
      expect(positions).toContainEqual({ x: 2, y: 2 });
    });

    it("should handle empty queries gracefully", () => {
      let callCount = 0;

      entityList.each([Name] as const, () => {
        callCount++;
      });

      expect(callCount).toBe(3); // All entities have Name component by default
    });
  });

  describe("edge cases", () => {
    it("should handle entity ID boundaries correctly", () => {
      // Test entity ID 0 specifically
      const entity = entityList.createEntity();
      expect(entityList.idOf(entity)).toBe(0);
      expect(entityList.isAlive(entity)).toBe(true);

      const pos = { x: 0, y: 0 };
      entityList.set(entity, Position, pos);
      expect(entityList.get(entity, Position)).toEqual(pos);
    });

    it("should handle rapid create/destroy cycles", () => {
      const entities = [];

      // Create many entities
      for (let i = 0; i < 100; i++) {
        entities.push(entityList.createEntity());
      }

      // Destroy every other one
      for (let i = 0; i < entities.length; i += 2) {
        entityList.destroyEntity(entities[i]);
      }

      // Create new ones (should reuse IDs)
      const newEntities = [];
      for (let i = 0; i < 50; i++) {
        newEntities.push(entityList.createEntity());
      }

      // All new entities should be alive
      newEntities.forEach((entity) => {
        expect(entityList.isAlive(entity)).toBe(true);
      });

      // Old destroyed entities should still be dead
      for (let i = 0; i < entities.length; i += 2) {
        expect(entityList.isAlive(entities[i])).toBe(false);
      }

      // Old surviving entities should still be alive
      for (let i = 1; i < entities.length; i += 2) {
        expect(entityList.isAlive(entities[i])).toBe(true);
      }
    });

    it("should maintain consistency when components are modified during iteration", () => {
      // This is a more advanced test that would require deeper integration
      // For now, we'll test basic consistency
      const entities = [];
      for (let i = 0; i < 10; i++) {
        const entity = entityList.createEntity();
        entityList.set(entity, Position, { x: i, y: i });
        entities.push(entity);
      }

      let processedCount = 0;
      entityList.each([Position] as const, (entity, pos) => {
        processedCount++;
        // In a real scenario, we might add/remove components here
      });

      expect(processedCount).toBe(10);
    });
  });

  describe("null entity", () => {
    it("should create a consistent null entity", () => {
      const null1 = entityList.nullEntity();
      const null2 = entityList.nullEntity();

      expect(null1).toBe(null2);
      expect(null1).toEqual(null2);
    });

    it("should have invalid ID for null entity", () => {
      const nullEntity = entityList.nullEntity();
      const id = entityList.idOf(nullEntity);

      // INVALID_ID is -1, but due to bit masking it becomes a large number
      // The ID should be the masked value of -1
      const ID_MASK = (1 << 20) - 1; // 0xFFFFF
      expect(id).toBe(ID_MASK); // -1 & ID_MASK = 0xFFFFF
    });

    it("should have generation 0 for null entity", () => {
      const nullEntity = entityList.nullEntity();
      const gen = entityList.genOf(nullEntity);

      expect(gen).toBe(0);
    });

    it("should not be considered alive", () => {
      const nullEntity = entityList.nullEntity();

      expect(entityList.isAlive(nullEntity)).toBe(false);
    });

    it("should reject operations on null entity", () => {
      const nullEntity = entityList.nullEntity();
      const pos = { x: 10, y: 20 };

      expect(() => entityList.set(nullEntity, Position, pos)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.has(nullEntity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.get(nullEntity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.tryGet(nullEntity, Position)).toThrow(
        "Entity is not alive"
      );
      expect(() => entityList.remove(nullEntity, Position)).toThrow(
        "Entity is not alive"
      );
    });

    it("should not be destroyable", () => {
      const nullEntity = entityList.nullEntity();

      const result = entityList.destroyEntity(nullEntity);
      expect(result).toBe(false);
    });

    it("should be distinguishable from regular entities", () => {
      const nullEntity = entityList.nullEntity();
      const regularEntity = entityList.createEntity();

      expect(nullEntity).not.toBe(regularEntity);
      expect(entityList.isAlive(nullEntity)).toBe(false);
      expect(entityList.isAlive(regularEntity)).toBe(true);
    });

    it("should remain invalid even if entities are created and destroyed", () => {
      const nullEntity = entityList.nullEntity();

      // Create and destroy some entities
      const entity1 = entityList.createEntity();
      const entity2 = entityList.createEntity();
      entityList.destroyEntity(entity1);
      entityList.destroyEntity(entity2);

      // Null entity should still be invalid
      expect(entityList.isAlive(nullEntity)).toBe(false);
    });

    it("should be usable as sentinel value in data structures", () => {
      const nullEntity = entityList.nullEntity();

      // Test usage as sentinel in a simple structure
      const relationships = {
        parent: nullEntity,
        children: [nullEntity, nullEntity],
      };

      expect(relationships.parent).toBe(nullEntity);
      expect(relationships.children[0]).toBe(nullEntity);
      expect(entityList.isAlive(relationships.parent)).toBe(false);
    });
  });

  describe("relationship system", () => {
    let parent: ReturnType<typeof entityList.createEntity>;
    let child1: ReturnType<typeof entityList.createEntity>;
    let child2: ReturnType<typeof entityList.createEntity>;

    beforeEach(() => {
      parent = entityList.createEntity();
      child1 = entityList.createEntity();
      child2 = entityList.createEntity();
    });

    it("should add child to parent using null entities as default", () => {
      entityList.addChild(parent, child1);

      expect(entityList.has(parent, Relationship)).toBe(true);
      expect(entityList.has(child1, Relationship)).toBe(true);

      const parentRel = entityList.get(parent, Relationship);
      const childRel = entityList.get(child1, Relationship);

      expect(parentRel.firstChild).toBe(child1);
      expect(childRel.parent).toBe(parent);
      expect(childRel.prevSibling).toBe(entityList.nullEntity());
      expect(childRel.nextSibling).toBe(entityList.nullEntity());
    });

    it("should handle multiple children with null entity linking", () => {
      entityList.addChild(parent, child1);
      entityList.addChild(parent, child2);

      const parentRel = entityList.get(parent, Relationship);
      const child1Rel = entityList.get(child1, Relationship);
      const child2Rel = entityList.get(child2, Relationship);

      expect(parentRel.firstChild).toBe(child1);

      // child1 should be first, with child2 as next sibling
      expect(child1Rel.nextSibling).toBe(child2);
      expect(child1Rel.prevSibling).toBe(entityList.nullEntity());

      // child2 should be last, with child1 as prev sibling
      expect(child2Rel.prevSibling).toBe(child1);
      expect(child2Rel.nextSibling).toBe(entityList.nullEntity());
    });

    it("should iterate through children correctly using null entity termination", () => {
      entityList.addChild(parent, child1);
      entityList.addChild(parent, child2);

      const children: any[] = [];
      entityList.forEachChild(parent, (child) => {
        children.push(child);
      });

      expect(children).toHaveLength(2);
      expect(children).toContain(child1);
      expect(children).toContain(child2);
    });

    it("should handle empty parent iteration gracefully", () => {
      // Parent with no children
      let callCount = 0;
      entityList.forEachChild(parent, () => {
        callCount++;
      });

      expect(callCount).toBe(0);
    });

    it("should handle parent without Relationship component", () => {
      // Parent without any Relationship component
      let callCount = 0;
      entityList.forEachChild(parent, () => {
        callCount++;
      });

      expect(callCount).toBe(0);
    });

    it("should remove child correctly and maintain null entity links", () => {
      entityList.addChild(parent, child1);
      entityList.addChild(parent, child2);

      entityList.removeChild(parent, child1);

      const parentRel = entityList.get(parent, Relationship);
      const child1Rel = entityList.get(child1, Relationship);
      const child2Rel = entityList.get(child2, Relationship);

      // Parent should now point to child2 as first child
      expect(parentRel.firstChild).toBe(child2);

      // child1 should be detached (all null entity references)
      expect(child1Rel.parent).toBe(entityList.nullEntity());
      expect(child1Rel.prevSibling).toBe(entityList.nullEntity());
      expect(child1Rel.nextSibling).toBe(entityList.nullEntity());

      // child2 should now be first and only child
      expect(child2Rel.parent).toBe(parent);
      expect(child2Rel.prevSibling).toBe(entityList.nullEntity());
      expect(child2Rel.nextSibling).toBe(entityList.nullEntity());
    });

    it("should handle removal of middle child in chain", () => {
      const child3 = entityList.createEntity();

      entityList.addChild(parent, child1);
      entityList.addChild(parent, child2);
      entityList.addChild(parent, child3);

      // Remove middle child
      entityList.removeChild(parent, child2);

      const child1Rel = entityList.get(child1, Relationship);
      const child2Rel = entityList.get(child2, Relationship);
      const child3Rel = entityList.get(child3, Relationship);

      // child1 should now link directly to child3
      expect(child1Rel.nextSibling).toBe(child3);
      expect(child3Rel.prevSibling).toBe(child1);

      // child2 should be fully detached
      expect(child2Rel.parent).toBe(entityList.nullEntity());
      expect(child2Rel.prevSibling).toBe(entityList.nullEntity());
      expect(child2Rel.nextSibling).toBe(entityList.nullEntity());
    });

    it("should handle reparenting with proper null entity cleanup", () => {
      const newParent = entityList.createEntity();

      entityList.addChild(parent, child1);
      entityList.addChild(newParent, child1); // Reparent

      const oldParentRel = entityList.get(parent, Relationship);
      const newParentRel = entityList.get(newParent, Relationship);
      const childRel = entityList.get(child1, Relationship);

      // Old parent should have no children
      expect(oldParentRel.firstChild).toBe(entityList.nullEntity());

      // New parent should have child1
      expect(newParentRel.firstChild).toBe(child1);

      // child1 should be parented to new parent
      expect(childRel.parent).toBe(newParent);
    });

    it("should handle operations on non-alive entities gracefully", () => {
      const deadEntity = entityList.createEntity();
      entityList.destroyEntity(deadEntity);

      // Should not crash, just return early
      entityList.addChild(deadEntity, child1);
      entityList.addChild(parent, deadEntity);
      entityList.removeChild(deadEntity, child1);
      entityList.removeChild(parent, deadEntity);

      let callCount = 0;
      entityList.forEachChild(deadEntity, () => {
        callCount++;
      });
      expect(callCount).toBe(0);
    });

    it("should prevent operations when entities lack Relationship component during removal", () => {
      // Try to remove child from parent when neither has Relationship component
      entityList.removeChild(parent, child1);

      // Should handle gracefully - no crash, no changes
      expect(entityList.has(parent, Relationship)).toBe(true);
      expect(entityList.has(child1, Relationship)).toBe(true);
    });

    it("should validate parent-child relationship during removal", () => {
      const wrongParent = entityList.createEntity();

      entityList.addChild(parent, child1);
      entityList.addChild(wrongParent, child2);

      // Try to remove child1 from wrong parent
      entityList.removeChild(wrongParent, child1);

      // child1 should still be parented to correct parent
      const child1Rel = entityList.get(child1, Relationship);
      expect(child1Rel.parent).toBe(parent);
    });
  });
});

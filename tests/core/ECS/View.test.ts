import { describe, it, expect, beforeEach, vi } from "vitest";
import { View } from "@/core/ECS/View";
import { EntityList } from "@/core/ECS/EntityList";
import { defineComponent } from "@/core/ECS/Component";
import type { Entity } from "@/core/ECS/EntityList";

// Test component types
type Position = { x: number; y: number };
type Velocity = { dx: number; dy: number };
type Health = { hp: number; maxHp: number };
type Name = { name: string };
type Tag = { tag: string };

const Position = defineComponent<Position>("Position");
const Velocity = defineComponent<Velocity>("Velocity");
const Health = defineComponent<Health>("Health");
const Name = defineComponent<Name>("Name");
const Tag = defineComponent<Tag>("Tag");

describe("View", () => {
  let entityList: EntityList;
  let entities: Entity[];

  beforeEach(() => {
    entityList = new EntityList();
    entities = [];

    // Create test entities
    for (let i = 0; i < 10; i++) {
      entities.push(entityList.createEntity());
    }
  });

  describe("initialization", () => {
    it("should create view with single component type", () => {
      const view = new View(entityList, [Position]);

      expect(view).toBeDefined();
      expect(view.types).toEqual([Position]);
    });

    it("should create view with multiple component types", () => {
      const types = [Position, Velocity, Health] as const;
      const view = new View(entityList, types);

      expect(view).toBeDefined();
      expect(view.types).toEqual(types);
    });

    it("should handle empty component types array", () => {
      const view = new View(entityList, []);

      expect(view).toBeDefined();
      expect(view.types).toEqual([]);
    });
  });

  describe("single component iteration (each1)", () => {
    it("should iterate over entities with single component", () => {
      // Add Position to some entities
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[2], Position, { x: 30, y: 40 });
      entityList.set(entities[4], Position, { x: 50, y: 60 });

      const view = new View(entityList, [Position]);
      const results: Array<{ entity: Entity; position: Position }> = [];

      view.each((entity, position) => {
        results.push({ entity, position });
      });

      expect(results).toHaveLength(3);
      expect(results).toEqual([
        { entity: entities[0], position: { x: 10, y: 20 } },
        { entity: entities[2], position: { x: 30, y: 40 } },
        { entity: entities[4], position: { x: 50, y: 60 } },
      ]);
    });

    it("should handle no entities with component", () => {
      const view = new View(entityList, [Position]);
      const results: any[] = [];

      view.each((entity, position) => {
        results.push({ entity, position });
      });

      expect(results).toHaveLength(0);
    });

    it("should handle entity removal during iteration", () => {
      // Add components
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[2], Position, { x: 50, y: 60 });

      const view = new View(entityList, [Position]);
      const results: Entity[] = [];

      view.each((entity, position) => {
        results.push(entity);
        // Remove the component from the first entity during iteration
        if (entity === entities[0]) {
          entityList.remove(entity, Position);
        }
      });

      // Should still process all entities that were present at start
      expect(results).toHaveLength(3);
    });
  });

  describe("two component iteration (each2)", () => {
    it("should iterate over entities with both components", () => {
      // Add both Position and Velocity to some entities
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });

      entityList.set(entities[1], Position, { x: 30, y: 40 });
      // No velocity for entities[1]

      entityList.set(entities[2], Position, { x: 50, y: 60 });
      entityList.set(entities[2], Velocity, { dx: 3, dy: 4 });

      const view = new View(entityList, [Position, Velocity]);
      const results: Array<{
        entity: Entity;
        position: Position;
        velocity: Velocity;
      }> = [];

      view.each((entity, position, velocity) => {
        results.push({
          entity,
          position: position as Position,
          velocity: velocity as Velocity,
        });
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        entity: entities[0],
        position: { x: 10, y: 20 },
        velocity: { dx: 1, dy: 2 },
      });
      expect(results).toContainEqual({
        entity: entities[2],
        position: { x: 50, y: 60 },
        velocity: { dx: 3, dy: 4 },
      });
    });

    it("should use smallest pool as driver", () => {
      // Add Position to many entities
      for (let i = 0; i < 8; i++) {
        entityList.set(entities[i], Position, { x: i * 10, y: i * 20 });
      }

      // Add Velocity to fewer entities
      entityList.set(entities[1], Velocity, { dx: 1, dy: 1 });
      entityList.set(entities[3], Velocity, { dx: 2, dy: 2 });
      entityList.set(entities[5], Velocity, { dx: 3, dy: 3 });

      const view = new View(entityList, [Position, Velocity]);
      const results: any[] = [];

      view.each((entity, position, velocity) => {
        results.push({ entity, position, velocity });
      });

      // Should only get entities that have both components
      expect(results).toHaveLength(3);
    });
  });

  describe("three component iteration (each3)", () => {
    it("should iterate over entities with all three components", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });

      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[1], Velocity, { dx: 3, dy: 4 });
      // No health for entities[1]

      entityList.set(entities[2], Position, { x: 50, y: 60 });
      entityList.set(entities[2], Velocity, { dx: 5, dy: 6 });
      entityList.set(entities[2], Health, { hp: 75, maxHp: 100 });

      const view = new View(entityList, [Position, Velocity, Health]);
      const results: any[] = [];

      view.each((entity, position, velocity, health) => {
        results.push({ entity, position, velocity, health });
      });

      expect(results).toHaveLength(2);
      expect(results).toContainEqual({
        entity: entities[0],
        position: { x: 10, y: 20 },
        velocity: { dx: 1, dy: 2 },
        health: { hp: 100, maxHp: 100 },
      });
      expect(results).toContainEqual({
        entity: entities[2],
        position: { x: 50, y: 60 },
        velocity: { dx: 5, dy: 6 },
        health: { hp: 75, maxHp: 100 },
      });
    });
  });

  describe("four component iteration (each4)", () => {
    it("should iterate over entities with all four components", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });
      entityList.set(entities[0], Name, { name: "Entity0" });

      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[1], Velocity, { dx: 3, dy: 4 });
      entityList.set(entities[1], Health, { hp: 75, maxHp: 100 });
      // No name for entities[1]

      const view = new View(entityList, [Position, Velocity, Health, Name]);
      const results: any[] = [];

      view.each((entity, position, velocity, health, name) => {
        results.push({ entity, position, velocity, health, name });
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        entity: entities[0],
        position: { x: 10, y: 20 },
        velocity: { dx: 1, dy: 2 },
        health: { hp: 100, maxHp: 100 },
        name: { name: "Entity0" },
      });
    });
  });

  describe("N component iteration (eachN)", () => {
    it("should iterate over entities with 5+ components", () => {
      const types = [Position, Velocity, Health, Name, Tag] as const;

      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });
      entityList.set(entities[0], Name, { name: "Entity0" });
      entityList.set(entities[0], Tag, { tag: "player" });

      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[1], Velocity, { dx: 3, dy: 4 });
      entityList.set(entities[1], Health, { hp: 75, maxHp: 100 });
      entityList.set(entities[1], Name, { name: "Entity1" });
      // No tag for entities[1]

      const view = new View(entityList, types);
      const results: any[] = [];

      view.each((entity, position, velocity, health, name, tag) => {
        results.push({ entity, position, velocity, health, name, tag });
      });

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        entity: entities[0],
        position: { x: 10, y: 20 },
        velocity: { dx: 1, dy: 2 },
        health: { hp: 100, maxHp: 100 },
        name: { name: "Entity0" },
        tag: { tag: "player" },
      });
    });

    it("should handle entities missing components in eachN (break coverage)", () => {
      const types = [Position, Velocity, Health, Name, Tag] as const;

      // Entity 0: has all components
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });
      entityList.set(entities[0], Name, { name: "Entity0" });
      entityList.set(entities[0], Tag, { tag: "player" });

      // Entity 1: missing Tag (should trigger break in eachN)
      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[1], Velocity, { dx: 3, dy: 4 });
      entityList.set(entities[1], Health, { hp: 75, maxHp: 100 });
      entityList.set(entities[1], Name, { name: "Entity1" });
      // No Tag for entities[1]

      const view = new View(entityList, types);
      const results: any[] = [];

      view.each((entity, position, velocity, health, name, tag) => {
        results.push({ entity, position, velocity, health, name, tag });
      });

      // Only entity0 should match (entity1 should be skipped due to missing Tag)
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        entity: entities[0],
        position: { x: 10, y: 20 },
        velocity: { dx: 1, dy: 2 },
        health: { hp: 100, maxHp: 100 },
        name: { name: "Entity0" },
        tag: { tag: "player" },
      });
    });

    it("should trigger break condition in eachN when entity missing early component", () => {
      // Create 6 component types to ensure eachN is used (not each1-4)
      const CompA = defineComponent<number>("CompA");
      const CompB = defineComponent<string>("CompB");
      const CompC = defineComponent<boolean>("CompC");
      const CompD = defineComponent<{ value: number }>("CompD");
      const CompE = defineComponent<{ name: string }>("CompE");
      const CompF = defineComponent<number[]>("CompF");

      const types = [CompA, CompB, CompC, CompD, CompE, CompF] as const;

      // Entity with all components
      entityList.set(entities[0], CompA, 1);
      entityList.set(entities[0], CompB, "test1");
      entityList.set(entities[0], CompC, true);
      entityList.set(entities[0], CompD, { value: 10 });
      entityList.set(entities[0], CompE, { name: "entity0" });
      entityList.set(entities[0], CompF, [1, 2, 3]);

      // Entity missing CompC (should trigger break on p=2, covering lines 220-221)
      entityList.set(entities[1], CompA, 2);
      entityList.set(entities[1], CompB, "test2");
      // Missing CompC
      entityList.set(entities[1], CompD, { value: 20 });
      entityList.set(entities[1], CompE, { name: "entity1" });
      entityList.set(entities[1], CompF, [4, 5, 6]);

      const view = new View(entityList, types);
      const results: any[] = [];

      view.each((entity, a, b, c, d, e, f) => {
        results.push({ entity, a, b, c, d, e, f });
      });

      // Only entities[0] should match (entities[1] breaks early due to missing CompC)
      expect(results).toHaveLength(1);
      expect(results[0].a).toBe(1);
      expect(results[0].b).toBe("test1");
      expect(results[0].c).toBe(true);
    });
  });

  describe("empty component types", () => {
    it("should handle view with no component types", () => {
      const view = new View(entityList, []);
      const results: any[] = [];

      view.each((...args) => {
        results.push(args);
      });

      expect(results).toHaveLength(0);
    });
  });

  describe("pool optimization", () => {
    it("should use smallest pool as driver for efficiency", () => {
      // First, add Position to the test entities that already exist
      entityList.set(entities[0], Position, { x: 0, y: 0 });
      entityList.set(entities[1], Position, { x: 10, y: 10 });
      entityList.set(entities[2], Position, { x: 20, y: 20 });
      entityList.set(entities[3], Position, { x: 30, y: 30 });
      entityList.set(entities[4], Position, { x: 40, y: 40 });

      // Only add Velocity to some of them
      entityList.set(entities[0], Velocity, { dx: 1, dy: 1 });
      entityList.set(entities[2], Velocity, { dx: 2, dy: 2 });
      entityList.set(entities[4], Velocity, { dx: 3, dy: 3 });

      const view = new View(entityList, [Position, Velocity]);
      const results: any[] = [];

      view.each((entity, position, velocity) => {
        results.push({ entity, position, velocity });
      });

      // Should efficiently iterate only over the few entities with both components
      expect(results).toHaveLength(3);
    });
  });

  describe("concurrent modifications", () => {
    it("should handle component additions during iteration", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });

      const view = new View(entityList, [Position]);
      const results: Entity[] = [];

      view.each((entity, position) => {
        results.push(entity);

        // Add component to another entity during iteration
        if (entity === entities[0]) {
          entityList.set(entities[2], Position, { x: 50, y: 60 });
        }
      });

      // Should not include the newly added entity in current iteration
      expect(results).toEqual([entities[0], entities[1]]);
    });

    it("should handle component removals during iteration", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[2], Position, { x: 50, y: 60 });

      const view = new View(entityList, [Position]);
      const results: Entity[] = [];

      view.each((entity, position) => {
        results.push(entity);

        // Remove component during iteration
        if (entity === entities[1]) {
          entityList.remove(entities[2], Position);
        }
      });

      // Should handle the removal gracefully
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle entity destruction during iteration", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[2], Position, { x: 50, y: 60 });

      const view = new View(entityList, [Position]);
      const results: Entity[] = [];

      view.each((entity, position) => {
        results.push(entity);

        // Destroy entity during iteration
        if (entity === entities[1]) {
          entityList.destroyEntity(entities[2]);
        }
      });

      // Should handle entity destruction gracefully
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("performance considerations", () => {
    it("should handle large numbers of entities efficiently", () => {
      const manyEntities: Entity[] = [];

      // Create many entities with components
      for (let i = 0; i < 1000; i++) {
        const entity = entityList.createEntity();
        manyEntities.push(entity);
        entityList.set(entity, Position, { x: i, y: i * 2 });

        if (i % 2 === 0) {
          entityList.set(entity, Velocity, { dx: i, dy: i });
        }
      }

      const view = new View(entityList, [Position, Velocity]);
      let count = 0;

      const start = performance.now();
      view.each((entity, position, velocity) => {
        count++;
      });
      const end = performance.now();

      expect(count).toBe(500); // Half the entities have both components
      expect(end - start).toBeLessThan(100); // Should be fast
    });

    it("should reuse arrays efficiently in eachN", () => {
      const types = [Position, Velocity, Health, Name, Tag] as const;

      // Create entity with all components
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });
      entityList.set(entities[0], Name, { name: "Test" });
      entityList.set(entities[0], Tag, { tag: "test" });

      const view = new View(entityList, types);

      // Run multiple iterations to test array reuse
      for (let i = 0; i < 10; i++) {
        view.each((entity, position, velocity, health, name, tag) => {
          expect(position).toEqual({ x: 10, y: 20 });
          expect(velocity).toEqual({ dx: 1, dy: 2 });
          expect(health).toEqual({ hp: 100, maxHp: 100 });
          expect(name).toEqual({ name: "Test" });
          expect(tag).toEqual({ tag: "test" });
        });
      }
    });
  });

  describe("type system integration", () => {
    it("should provide correct component types in callback", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });

      const view = new View(entityList, [Position, Velocity] as const);

      view.each((entity, position, velocity) => {
        // TypeScript should enforce these types
        expect(typeof position.x).toBe("number");
        expect(typeof position.y).toBe("number");
        expect(typeof velocity.dx).toBe("number");
        expect(typeof velocity.dy).toBe("number");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle views of same entity with different component combinations", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[0], Velocity, { dx: 1, dy: 2 });
      entityList.set(entities[0], Health, { hp: 100, maxHp: 100 });

      const positionView = new View(entityList, [Position]);
      const movementView = new View(entityList, [Position, Velocity]);
      const fullView = new View(entityList, [Position, Velocity, Health]);

      let positionCount = 0;
      let movementCount = 0;
      let fullCount = 0;

      positionView.each(() => positionCount++);
      movementView.each(() => movementCount++);
      fullView.each(() => fullCount++);

      expect(positionCount).toBe(1);
      expect(movementCount).toBe(1);
      expect(fullCount).toBe(1);
    });

    it("should handle duplicate component types gracefully", () => {
      // This shouldn't happen in practice, but test robustness
      const view = new View(entityList, [Position, Position] as any);

      entityList.set(entities[0], Position, { x: 10, y: 20 });

      const results: any[] = [];
      view.each((...args) => {
        results.push(args);
      });

      expect(results).toHaveLength(1);
    });

    it("should handle component modification during iteration", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });

      const view = new View(entityList, [Position]);
      const results: Position[] = [];

      view.each((entity, position) => {
        results.push({ ...position }); // Copy current value

        // Modify component during iteration
        if (entity === entities[0]) {
          entityList.set(entity, Position, { x: 999, y: 999 });
        }
      });

      // Should see original values, not modified ones
      expect(results).toEqual([
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]);
    });
  });

  describe("integration with entity lifecycle", () => {
    it("should properly handle view queries after entity destruction", () => {
      entityList.set(entities[0], Position, { x: 10, y: 20 });
      entityList.set(entities[1], Position, { x: 30, y: 40 });
      entityList.set(entities[2], Position, { x: 50, y: 60 });

      const view = new View(entityList, [Position]);

      // Count before destruction
      let countBefore = 0;
      view.each(() => countBefore++);
      expect(countBefore).toBe(3);

      // Destroy an entity
      entityList.destroyEntity(entities[1]);

      // Count after destruction
      let countAfter = 0;
      const remainingEntities: Entity[] = [];
      view.each((entity) => {
        countAfter++;
        remainingEntities.push(entity);
      });

      expect(countAfter).toBe(2);
      expect(remainingEntities).toContain(entities[0]);
      expect(remainingEntities).toContain(entities[2]);
      expect(remainingEntities).not.toContain(entities[1]);
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { Pool } from "@/core/ECS";

describe("Pool", () => {
  let pool: Pool<{ x: number; y: number }>;

  beforeEach(() => {
    pool = new Pool<{ x: number; y: number }>();
  });

  describe("basic operations", () => {
    it("should start empty", () => {
      expect(pool.size()).toBe(0);
      expect(pool.has(0)).toBe(false);
      expect(pool.has(100)).toBe(false);
    });

    it("should add and retrieve components", () => {
      const component = { x: 10, y: 20 };
      const wasInserted = pool.set(42, component);

      expect(wasInserted).toBe(true);
      expect(pool.size()).toBe(1);
      expect(pool.has(42)).toBe(true);
      expect(pool.get(42)).toEqual(component);
    });

    it("should replace existing components", () => {
      const component1 = { x: 10, y: 20 };
      const component2 = { x: 30, y: 40 };

      const wasInserted1 = pool.set(42, component1);
      const wasInserted2 = pool.set(42, component2);

      expect(wasInserted1).toBe(true);
      expect(wasInserted2).toBe(false); // replacement
      expect(pool.size()).toBe(1);
      expect(pool.get(42)).toEqual(component2);
    });

    it("should throw error when getting non-existent component", () => {
      expect(() => pool.get(999)).toThrow("Component missing on entity 999");
    });

    it("should return undefined for tryGet on non-existent component", () => {
      expect(pool.tryGet(999)).toBeUndefined();
    });

    it("should return component for tryGet on existing component", () => {
      const component = { x: 10, y: 20 };
      pool.set(42, component);
      expect(pool.tryGet(42)).toEqual(component);
    });
  });

  describe("index operations", () => {
    it("should return correct dense index for existing entities", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(100, comp1);
      pool.set(200, comp2);
      pool.set(300, comp3);

      expect(pool.indexOf(100)).toBe(0);
      expect(pool.indexOf(200)).toBe(1);
      expect(pool.indexOf(300)).toBe(2);
    });

    it("should return -1 for non-existent entities", () => {
      expect(pool.indexOf(999)).toBe(-1);
    });

    it("should get components by dense index", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(100, comp1);
      pool.set(200, comp2);

      expect(pool.getAt(0)).toEqual(comp1);
      expect(pool.getAt(1)).toEqual(comp2);
    });

    it("should get entity IDs by dense index", () => {
      pool.set(100, { x: 1, y: 1 });
      pool.set(200, { x: 2, y: 2 });

      expect(pool.entityAt(0)).toBe(100);
      expect(pool.entityAt(1)).toBe(200);
    });

    it("should maintain index consistency after replacement", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(100, comp1);
      const originalIndex = pool.indexOf(100);

      pool.set(100, comp2); // replace

      expect(pool.indexOf(100)).toBe(originalIndex);
      expect(pool.getAt(originalIndex)).toEqual(comp2);
    });
  });

  describe("removal", () => {
    it("should remove existing components", () => {
      const component = { x: 10, y: 20 };
      pool.set(42, component);

      const removedComponent = pool.remove(42);
      expect(removedComponent).toEqual(component);
      expect(pool.size()).toBe(0);
      expect(pool.has(42)).toBe(false);
      expect(pool.indexOf(42)).toBe(-1);
    });

    it("should return undefined when removing non-existent component", () => {
      const removedComponent = pool.remove(999);
      expect(removedComponent).toBeUndefined();
    });

    it("should handle swap-and-pop removal correctly", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(10, comp1);
      pool.set(20, comp2);
      pool.set(30, comp3);

      // Remove middle entity (should swap last to middle)
      const removedComponent = pool.remove(20);

      expect(removedComponent).toEqual(comp2);
      expect(pool.size()).toBe(2);
      expect(pool.has(10)).toBe(true);
      expect(pool.has(20)).toBe(false);
      expect(pool.has(30)).toBe(true);
      expect(pool.get(10)).toEqual(comp1);
      expect(pool.get(30)).toEqual(comp3);

      // Verify indices after swap
      expect(pool.indexOf(10)).toBe(0);
      expect(pool.indexOf(30)).toBe(1); // was moved from index 2 to index 1
    });

    it("should handle removing last element correctly", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(10, comp1);
      pool.set(20, comp2);

      // Remove last entity
      const removedComponent = pool.remove(20);

      expect(removedComponent).toEqual(comp2);
      expect(pool.size()).toBe(1);
      expect(pool.has(10)).toBe(true);
      expect(pool.has(20)).toBe(false);
      expect(pool.get(10)).toEqual(comp1);
      expect(pool.indexOf(10)).toBe(0);
    });

    it("should update indices correctly after removal", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(100, comp1);
      pool.set(200, comp2);
      pool.set(300, comp3);

      pool.remove(200); // Remove middle

      // Entity 300 should have moved to index 1 (where 200 was)
      expect(pool.indexOf(100)).toBe(0);
      expect(pool.indexOf(300)).toBe(1);
      expect(pool.entityAt(0)).toBe(100);
      expect(pool.entityAt(1)).toBe(300);
      expect(pool.getAt(0)).toEqual(comp1);
      expect(pool.getAt(1)).toEqual(comp3);
    });
  });

  describe("iteration", () => {
    it("should iterate over all components in packed order", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(100, comp1);
      pool.set(200, comp2);
      pool.set(300, comp3);

      const results: Array<{
        entityId: number;
        component: { x: number; y: number };
      }> = [];
      pool.forEach((entityId, component) => {
        results.push({ entityId, component });
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ entityId: 100, component: comp1 });
      expect(results[1]).toEqual({ entityId: 200, component: comp2 });
      expect(results[2]).toEqual({ entityId: 300, component: comp3 });
    });

    it("should maintain correct order after removal", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(100, comp1);
      pool.set(200, comp2);
      pool.set(300, comp3);

      // Remove middle entity
      pool.remove(200);

      const results: Array<{
        entityId: number;
        component: { x: number; y: number };
      }> = [];
      pool.forEach((entityId, component) => {
        results.push({ entityId, component });
      });

      expect(results).toHaveLength(2);
      // After swap-and-pop, entity 300 should be in index 1 (where 200 was)
      expect(results[0]).toEqual({ entityId: 100, component: comp1 });
      expect(results[1]).toEqual({ entityId: 300, component: comp3 });
    });

    it("should handle empty forEach", () => {
      let callCount = 0;
      pool.forEach(() => {
        callCount++;
      });
      expect(callCount).toBe(0);
    });
  });

  describe("array exposure", () => {
    it("should expose packed entity and component arrays", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(100, comp1);
      pool.set(200, comp2);

      const entities = pool.entities();
      const components = pool.components();

      expect(entities).toEqual([100, 200]);
      expect(components).toEqual([comp1, comp2]);

      // Arrays should be readonly references to internal state
      expect(pool.entities()).toBe(entities); // Same reference
      expect(pool.components()).toBe(components); // Same reference
    });

    it("should maintain array consistency after operations", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };
      const comp3 = { x: 3, y: 3 };

      pool.set(100, comp1);
      pool.set(200, comp2);
      pool.set(300, comp3);
      pool.remove(200); // Should swap 300 to index 1

      const entities = pool.entities();
      const components = pool.components();

      expect(entities).toHaveLength(2);
      expect(components).toHaveLength(2);
      expect(entities[0]).toBe(100);
      expect(entities[1]).toBe(300);
      expect(components[0]).toEqual(comp1);
      expect(components[1]).toEqual(comp3);
    });
  });

  describe("sparse set behavior", () => {
    it("should handle sparse entity IDs efficiently", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      // Use very sparse IDs
      pool.set(1000000, comp1);
      pool.set(5000000, comp2);

      expect(pool.size()).toBe(2);
      expect(pool.has(1000000)).toBe(true);
      expect(pool.has(5000000)).toBe(true);
      expect(pool.get(1000000)).toEqual(comp1);
      expect(pool.get(5000000)).toEqual(comp2);
      expect(pool.indexOf(1000000)).toBe(0);
      expect(pool.indexOf(5000000)).toBe(1);

      // Dense arrays should still be compact
      expect(pool.entities()).toEqual([1000000, 5000000]);
      expect(pool.components()).toEqual([comp1, comp2]);
    });

    it("should handle entity ID 0 correctly", () => {
      const comp = { x: 0, y: 0 };
      pool.set(0, comp);

      expect(pool.has(0)).toBe(true);
      expect(pool.get(0)).toEqual(comp);
      expect(pool.indexOf(0)).toBe(0);
      expect(pool.size()).toBe(1);
      expect(pool.entityAt(0)).toBe(0);
      expect(pool.getAt(0)).toEqual(comp);
    });
  });

  describe("edge cases", () => {
    it("should handle multiple operations on same entity", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(42, comp1);
      expect(pool.indexOf(42)).toBe(0);

      pool.set(42, comp2); // replace
      expect(pool.get(42)).toEqual(comp2);
      expect(pool.indexOf(42)).toBe(0); // Same index

      const removedComponent = pool.remove(42);
      expect(removedComponent).toEqual(comp2);
      expect(pool.has(42)).toBe(false);
      expect(pool.indexOf(42)).toBe(-1);

      pool.set(42, comp1); // add again
      expect(pool.get(42)).toEqual(comp1);
      expect(pool.indexOf(42)).toBe(0); // Back at index 0
    });

    it("should handle boundary dense index access", () => {
      const comp1 = { x: 1, y: 1 };
      const comp2 = { x: 2, y: 2 };

      pool.set(100, comp1);
      pool.set(200, comp2);

      // Valid indices
      expect(pool.getAt(0)).toEqual(comp1);
      expect(pool.getAt(1)).toEqual(comp2);
      expect(pool.entityAt(0)).toBe(100);
      expect(pool.entityAt(1)).toBe(200);

      // Note: Invalid index access would throw at runtime, but we don't test that
      // as it's expected behavior for direct array access
    });

    it("should maintain sparse array efficiency with gaps", () => {
      // Create entities with large gaps
      const entities = [1, 1000, 1000000];
      const components = [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ];

      entities.forEach((id, i) => {
        pool.set(id, components[i]);
      });

      // All should be accessible with correct dense indices
      entities.forEach((id, i) => {
        expect(pool.indexOf(id)).toBe(i);
        expect(pool.get(id)).toEqual(components[i]);
        expect(pool.getAt(i)).toEqual(components[i]);
        expect(pool.entityAt(i)).toBe(id);
      });

      // Intermediate IDs should not exist
      expect(pool.has(500)).toBe(false);
      expect(pool.indexOf(500)).toBe(-1);
      expect(pool.tryGet(500)).toBeUndefined();
    });
  });

  describe("performance characteristics", () => {
    it("should maintain O(1) operations with large entity IDs", () => {
      const largeId = 999999999;
      const component = { x: 42, y: 24 };

      // These operations should be O(1)
      const startTime = performance.now();
      pool.set(largeId, component);
      expect(pool.has(largeId)).toBe(true);
      expect(pool.get(largeId)).toEqual(component);
      expect(pool.indexOf(largeId)).toBe(0);
      pool.remove(largeId);
      const endTime = performance.now();

      // Should complete very quickly (this is more of a sanity check)
      expect(endTime - startTime).toBeLessThan(10); // 10ms is very generous
    });
  });
});

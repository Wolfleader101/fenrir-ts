import { describe, it, expect, beforeEach, vi } from "vitest";
import { ComponentSignals } from "@/core/ECS/Signals";
import { defineComponent } from "@/core/ECS/Component";
import type { Entity } from "@/core/ECS/EntityList";

// Test component types
type Position = { x: number; y: number };
type Velocity = { dx: number; dy: number };
type Health = { hp: number; maxHp: number };

const Position = defineComponent<Position>("Position");
const Velocity = defineComponent<Velocity>("Velocity");
const Health = defineComponent<Health>("Health");

describe("ComponentSignals", () => {
  let signals: ComponentSignals;
  let testEntity: Entity;

  beforeEach(() => {
    signals = new ComponentSignals();
    testEntity = 12345; // Mock entity ID
  });

  describe("initialization", () => {
    it("should start with no registered listeners", () => {
      // Should not throw when emitting to empty signals
      expect(() => {
        signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
        signals.emitRemove(Position, testEntity, { x: 10, y: 20 });
        signals.emitReplace(Position, testEntity, { x: 30, y: 40 });
      }).not.toThrow();
    });
  });

  describe("onAdd listeners", () => {
    it("should register and call add listeners", () => {
      const addListener = vi.fn();
      const component = { x: 10, y: 20 };

      signals.onAdd(Position, addListener);
      signals.emitAdd(Position, testEntity, component);

      expect(addListener).toHaveBeenCalledOnce();
      expect(addListener).toHaveBeenCalledWith(testEntity, component);
    });

    it("should support multiple listeners for same component type", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();
      const component = { x: 10, y: 20 };

      signals.onAdd(Position, listener1);
      signals.onAdd(Position, listener2);
      signals.onAdd(Position, listener3);

      signals.emitAdd(Position, testEntity, component);

      expect(listener1).toHaveBeenCalledWith(testEntity, component);
      expect(listener2).toHaveBeenCalledWith(testEntity, component);
      expect(listener3).toHaveBeenCalledWith(testEntity, component);
    });

    it("should isolate listeners by component type", () => {
      const positionListener = vi.fn();
      const velocityListener = vi.fn();

      signals.onAdd(Position, positionListener);
      signals.onAdd(Velocity, velocityListener);

      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });

      expect(positionListener).toHaveBeenCalledOnce();
      expect(velocityListener).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function", () => {
      const listener = vi.fn();
      const component = { x: 10, y: 20 };

      const unsubscribe = signals.onAdd(Position, listener);

      // Should work before unsubscribe
      signals.emitAdd(Position, testEntity, component);
      expect(listener).toHaveBeenCalledTimes(1);

      // Unsubscribe and verify no longer called
      unsubscribe();
      signals.emitAdd(Position, testEntity, component);
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should handle multiple unsubscribes safely", () => {
      const listener = vi.fn();
      const unsubscribe = signals.onAdd(Position, listener);

      expect(() => {
        unsubscribe();
        unsubscribe(); // Should not throw
      }).not.toThrow();
    });
  });

  describe("onRemove listeners", () => {
    it("should register and call remove listeners", () => {
      const removeListener = vi.fn();

      signals.onRemove(Position, removeListener);
      const testComponent = { x: 10, y: 20 };
      signals.emitRemove(Position, testEntity, testComponent);

      expect(removeListener).toHaveBeenCalledOnce();
      expect(removeListener).toHaveBeenCalledWith(testEntity, testComponent);
    });

    it("should support multiple remove listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      signals.onRemove(Position, listener1);
      signals.onRemove(Position, listener2);

      const testComponent = { x: 10, y: 20 };
      signals.emitRemove(Position, testEntity, testComponent);

      expect(listener1).toHaveBeenCalledWith(testEntity, testComponent);
      expect(listener2).toHaveBeenCalledWith(testEntity, testComponent);
    });

    it("should return working unsubscribe function", () => {
      const listener = vi.fn();

      const unsubscribe = signals.onRemove(Position, listener);

      const testComponent = { x: 10, y: 20 };
      signals.emitRemove(Position, testEntity, testComponent);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      signals.emitRemove(Position, testEntity, testComponent);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("onReplace listeners", () => {
    it("should register and call replace listeners", () => {
      const replaceListener = vi.fn();
      const newComponent = { x: 30, y: 40 };

      signals.onReplace(Position, replaceListener);
      signals.emitReplace(Position, testEntity, newComponent);

      expect(replaceListener).toHaveBeenCalledOnce();
      expect(replaceListener).toHaveBeenCalledWith(testEntity, newComponent);
    });

    it("should support multiple replace listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const newComponent = { x: 30, y: 40 };

      signals.onReplace(Position, listener1);
      signals.onReplace(Position, listener2);

      signals.emitReplace(Position, testEntity, newComponent);

      expect(listener1).toHaveBeenCalledWith(testEntity, newComponent);
      expect(listener2).toHaveBeenCalledWith(testEntity, newComponent);
    });

    it("should return working unsubscribe function", () => {
      const listener = vi.fn();
      const component = { x: 30, y: 40 };

      const unsubscribe = signals.onReplace(Position, listener);

      signals.emitReplace(Position, testEntity, component);
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      signals.emitReplace(Position, testEntity, component);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("onAny listeners", () => {
    it("should call onAnyComponentAdded for any component type", () => {
      const anyAddListener = vi.fn();

      signals.onAnyComponentAdded(anyAddListener);

      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      signals.emitAdd(Velocity, testEntity, { dx: 5, dy: -3 });
      signals.emitAdd(Health, testEntity, { hp: 100, maxHp: 100 });

      expect(anyAddListener).toHaveBeenCalledTimes(3);
      expect(anyAddListener).toHaveBeenNthCalledWith(1, Position, testEntity);
      expect(anyAddListener).toHaveBeenNthCalledWith(2, Velocity, testEntity);
      expect(anyAddListener).toHaveBeenNthCalledWith(3, Health, testEntity);
    });

    it("should call onAnyComponentRemoved for any component type", () => {
      const anyRemoveListener = vi.fn();

      signals.onAnyComponentRemoved(anyRemoveListener);

      signals.emitRemove(Position, testEntity, { x: 10, y: 20 });
      signals.emitRemove(Velocity, testEntity, { dx: 5, dy: 10 });

      expect(anyRemoveListener).toHaveBeenCalledTimes(2);
      expect(anyRemoveListener).toHaveBeenNthCalledWith(
        1,
        Position,
        testEntity
      );
      expect(anyRemoveListener).toHaveBeenNthCalledWith(
        2,
        Velocity,
        testEntity
      );
    });

    it("should call onAnyComponentReplaced for any component type", () => {
      const anyReplaceListener = vi.fn();

      signals.onAnyComponentReplaced(anyReplaceListener);

      signals.emitReplace(Position, testEntity, { x: 30, y: 40 });
      signals.emitReplace(Health, testEntity, { hp: 50, maxHp: 100 });

      expect(anyReplaceListener).toHaveBeenCalledTimes(2);
      expect(anyReplaceListener).toHaveBeenNthCalledWith(
        1,
        Position,
        testEntity
      );
      expect(anyReplaceListener).toHaveBeenNthCalledWith(2, Health, testEntity);
    });

    it("should return working unsubscribe functions for any listeners", () => {
      const anyAddListener = vi.fn();
      const anyRemoveListener = vi.fn();
      const anyReplaceListener = vi.fn();

      const unsubAdd = signals.onAnyComponentAdded(anyAddListener);
      const unsubRemove = signals.onAnyComponentRemoved(anyRemoveListener);
      const unsubReplace = signals.onAnyComponentReplaced(anyReplaceListener);

      // Test they work initially
      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      signals.emitRemove(Position, testEntity, { x: 10, y: 20 });
      signals.emitReplace(Position, testEntity, { x: 30, y: 40 });

      expect(anyAddListener).toHaveBeenCalledTimes(1);
      expect(anyRemoveListener).toHaveBeenCalledTimes(1);
      expect(anyReplaceListener).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubAdd();
      unsubRemove();
      unsubReplace();

      // Test they no longer work
      signals.emitAdd(Position, testEntity, { x: 50, y: 60 });
      signals.emitRemove(Position, testEntity, { x: 10, y: 20 });
      signals.emitReplace(Position, testEntity, { x: 70, y: 80 });

      expect(anyAddListener).toHaveBeenCalledTimes(1); // Still 1
      expect(anyRemoveListener).toHaveBeenCalledTimes(1); // Still 1
      expect(anyReplaceListener).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe("combined specific and any listeners", () => {
    it("should call both specific and any listeners", () => {
      const specificAddListener = vi.fn();
      const anyAddListener = vi.fn();
      const component = { x: 10, y: 20 };

      signals.onAdd(Position, specificAddListener);
      signals.onAnyComponentAdded(anyAddListener);

      signals.emitAdd(Position, testEntity, component);

      expect(specificAddListener).toHaveBeenCalledWith(testEntity, component);
      expect(anyAddListener).toHaveBeenCalledWith(Position, testEntity);
    });

    it("should call both specific and any remove listeners", () => {
      const specificRemoveListener = vi.fn();
      const anyRemoveListener = vi.fn();

      signals.onRemove(Position, specificRemoveListener);
      signals.onAnyComponentRemoved(anyRemoveListener);

      const testComponent = { x: 10, y: 20 };
      signals.emitRemove(Position, testEntity, testComponent);

      expect(specificRemoveListener).toHaveBeenCalledWith(
        testEntity,
        testComponent
      );
      expect(anyRemoveListener).toHaveBeenCalledWith(Position, testEntity);
    });

    it("should call both specific and any replace listeners", () => {
      const specificReplaceListener = vi.fn();
      const anyReplaceListener = vi.fn();
      const component = { x: 30, y: 40 };

      signals.onReplace(Position, specificReplaceListener);
      signals.onAnyComponentReplaced(anyReplaceListener);

      signals.emitReplace(Position, testEntity, component);

      expect(specificReplaceListener).toHaveBeenCalledWith(
        testEntity,
        component
      );
      expect(anyReplaceListener).toHaveBeenCalledWith(Position, testEntity);
    });
  });

  describe("multiple entities and components", () => {
    it("should handle multiple entities correctly", () => {
      const listener = vi.fn();
      const entity1 = 100;
      const entity2 = 200;
      const entity3 = 300;

      signals.onAdd(Position, listener);

      signals.emitAdd(Position, entity1, { x: 10, y: 20 });
      signals.emitAdd(Position, entity2, { x: 30, y: 40 });
      signals.emitAdd(Position, entity3, { x: 50, y: 60 });

      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenNthCalledWith(1, entity1, { x: 10, y: 20 });
      expect(listener).toHaveBeenNthCalledWith(2, entity2, { x: 30, y: 40 });
      expect(listener).toHaveBeenNthCalledWith(3, entity3, { x: 50, y: 60 });
    });

    it("should handle multiple component types for same entity", () => {
      const positionListener = vi.fn();
      const velocityListener = vi.fn();
      const healthListener = vi.fn();

      signals.onAdd(Position, positionListener);
      signals.onAdd(Velocity, velocityListener);
      signals.onAdd(Health, healthListener);

      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      signals.emitAdd(Velocity, testEntity, { dx: 5, dy: -3 });
      signals.emitAdd(Health, testEntity, { hp: 100, maxHp: 100 });

      expect(positionListener).toHaveBeenCalledWith(testEntity, {
        x: 10,
        y: 20,
      });
      expect(velocityListener).toHaveBeenCalledWith(testEntity, {
        dx: 5,
        dy: -3,
      });
      expect(healthListener).toHaveBeenCalledWith(testEntity, {
        hp: 100,
        maxHp: 100,
      });
    });
  });

  describe("listener lifecycle", () => {
    it("should handle adding and removing listeners dynamically", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      // Add first listener
      const unsub1 = signals.onAdd(Position, listener1);
      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      expect(listener1).toHaveBeenCalledTimes(1);

      // Add second listener
      const unsub2 = signals.onAdd(Position, listener2);
      signals.emitAdd(Position, testEntity, { x: 30, y: 40 });
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(1);

      // Remove first listener
      unsub1();
      signals.emitAdd(Position, testEntity, { x: 50, y: 60 });
      expect(listener1).toHaveBeenCalledTimes(2); // Still 2
      expect(listener2).toHaveBeenCalledTimes(2);

      // Remove second listener
      unsub2();
      signals.emitAdd(Position, testEntity, { x: 70, y: 80 });
      expect(listener1).toHaveBeenCalledTimes(2); // Still 2
      expect(listener2).toHaveBeenCalledTimes(2); // Still 2
    });

    it("should handle same listener added multiple times", () => {
      const listener = vi.fn();

      const unsub1 = signals.onAdd(Position, listener);
      const unsub2 = signals.onAdd(Position, listener); // Same listener, different subscription

      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      expect(listener).toHaveBeenCalledTimes(2); // Called twice since it's registered twice

      // Remove one subscription
      unsub1();
      signals.emitAdd(Position, testEntity, { x: 30, y: 40 });
      expect(listener).toHaveBeenCalledTimes(3); // Called once more

      // Remove second subscription
      unsub2();
      signals.emitAdd(Position, testEntity, { x: 50, y: 60 });
      expect(listener).toHaveBeenCalledTimes(3); // No more calls
    });
  });

  describe("edge cases", () => {
    it("should handle emitting with no listeners gracefully", () => {
      expect(() => {
        signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
        signals.emitRemove(Position, testEntity, { x: 10, y: 20 });
        signals.emitReplace(Position, testEntity, { x: 30, y: 40 });
      }).not.toThrow();
    });

    it("should handle listener that throws an error", () => {
      const errorListener = vi.fn(() => {
        throw new Error("Test error");
      });
      const normalListener = vi.fn();

      signals.onAdd(Position, errorListener);
      signals.onAdd(Position, normalListener);

      expect(() => {
        signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      }).toThrow("Test error");

      // The normal listener should not be called due to the error
      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).not.toHaveBeenCalled();
    });

    it("should handle component types created with same name", () => {
      const Position2 = defineComponent<Position>("Position"); // Same name, different symbol
      expect(Position2).toBe(Position); // Should be same symbol due to Symbol.for

      const listener = vi.fn();
      signals.onAdd(Position, listener);

      signals.emitAdd(Position2, testEntity, { x: 10, y: 20 });
      expect(listener).toHaveBeenCalledWith(testEntity, { x: 10, y: 20 });
    });

    it("should handle large numbers of listeners efficiently", () => {
      const listeners: Array<ReturnType<typeof vi.fn>> = [];
      const unsubscribeFns: Array<() => void> = [];

      // Add many listeners
      for (let i = 0; i < 100; i++) {
        const listener = vi.fn();
        listeners.push(listener);
        unsubscribeFns.push(signals.onAdd(Position, listener));
      }

      // Emit and verify all are called
      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });

      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledOnce();
      });

      // Remove all listeners
      unsubscribeFns.forEach((unsub) => unsub());

      // Emit again and verify none are called
      signals.emitAdd(Position, testEntity, { x: 30, y: 40 });

      listeners.forEach((listener) => {
        expect(listener).toHaveBeenCalledTimes(1); // Still only once
      });
    });
  });

  describe("integration scenarios", () => {
    it("should handle typical ECS component lifecycle", () => {
      const addListener = vi.fn();
      const removeListener = vi.fn();
      const replaceListener = vi.fn();
      const anyAddListener = vi.fn();
      const anyRemoveListener = vi.fn();

      signals.onAdd(Position, addListener);
      signals.onRemove(Position, removeListener);
      signals.onReplace(Position, replaceListener);
      signals.onAnyComponentAdded(anyAddListener);
      signals.onAnyComponentRemoved(anyRemoveListener);

      // Add component
      signals.emitAdd(Position, testEntity, { x: 10, y: 20 });
      expect(addListener).toHaveBeenCalledWith(testEntity, { x: 10, y: 20 });
      expect(anyAddListener).toHaveBeenCalledWith(Position, testEntity);

      // Replace component
      signals.emitReplace(Position, testEntity, { x: 30, y: 40 });
      expect(replaceListener).toHaveBeenCalledWith(testEntity, {
        x: 30,
        y: 40,
      });

      // Remove component
      const testComponent = { x: 10, y: 20 };
      signals.emitRemove(Position, testEntity, testComponent);
      expect(removeListener).toHaveBeenCalledWith(testEntity, testComponent);
      expect(anyRemoveListener).toHaveBeenCalledWith(Position, testEntity);
    });

    it("should handle system registration and cleanup pattern", () => {
      const systemListeners: Array<() => void> = [];

      // Simulate system registering listeners
      const trackingSystem = {
        onEntityMoved: vi.fn(),
        onEntityHealthChanged: vi.fn(),
        onAnyComponentChanged: vi.fn(),
      };

      systemListeners.push(
        signals.onReplace(Position, trackingSystem.onEntityMoved)
      );
      systemListeners.push(
        signals.onReplace(Health, trackingSystem.onEntityHealthChanged)
      );
      systemListeners.push(
        signals.onAnyComponentReplaced(trackingSystem.onAnyComponentChanged)
      );

      // Simulate game events
      signals.emitReplace(Position, testEntity, { x: 100, y: 200 });
      signals.emitReplace(Health, testEntity, { hp: 75, maxHp: 100 });

      expect(trackingSystem.onEntityMoved).toHaveBeenCalledWith(testEntity, {
        x: 100,
        y: 200,
      });
      expect(trackingSystem.onEntityHealthChanged).toHaveBeenCalledWith(
        testEntity,
        { hp: 75, maxHp: 100 }
      );
      expect(trackingSystem.onAnyComponentChanged).toHaveBeenCalledTimes(2);

      // Simulate system cleanup
      systemListeners.forEach((unsub) => unsub());

      // Events should no longer trigger callbacks
      signals.emitReplace(Position, testEntity, { x: 300, y: 400 });
      signals.emitReplace(Health, testEntity, { hp: 50, maxHp: 100 });

      expect(trackingSystem.onEntityMoved).toHaveBeenCalledTimes(1); // Still only 1
      expect(trackingSystem.onEntityHealthChanged).toHaveBeenCalledTimes(1); // Still only 1
      expect(trackingSystem.onAnyComponentChanged).toHaveBeenCalledTimes(2); // Still only 2
    });
  });

  describe("unsubscribe edge cases for coverage", () => {
    it("should handle unsubscribing callback that doesn't exist in anyAdd array", () => {
      const callback = vi.fn();
      const unsubscribe = signals.onAnyComponentAdded(callback);

      // Manually remove callback to simulate race condition
      const anyAddArray = (signals as any).onAnyAdd;
      const index = anyAddArray.indexOf(callback);
      anyAddArray.splice(index, 1);

      // Unsubscribe should handle missing callback gracefully (covers lines 32)
      expect(() => unsubscribe()).not.toThrow();
    });

    it("should handle unsubscribing callback that doesn't exist in anyRemove array", () => {
      const callback = vi.fn();
      const unsubscribe = signals.onAnyComponentRemoved(callback);

      // Manually remove callback
      const anyRemoveArray = (signals as any).onAnyRemove;
      const index = anyRemoveArray.indexOf(callback);
      anyRemoveArray.splice(index, 1);

      // Unsubscribe should handle missing callback gracefully (covers lines 41)
      expect(() => unsubscribe()).not.toThrow();
    });

    it("should handle unsubscribing callback that doesn't exist in anyReplace array", () => {
      const callback = vi.fn();
      const unsubscribe = signals.onAnyComponentReplaced(callback);

      // Manually remove callback
      const anyReplaceArray = (signals as any).onAnyReplace;
      const index = anyReplaceArray.indexOf(callback);
      anyReplaceArray.splice(index, 1);

      // Unsubscribe should handle missing callback gracefully (covers lines 50)
      expect(() => unsubscribe()).not.toThrow();
    });

    it("should handle unsubscribing specific component callback that doesn't exist", () => {
      const TestComponent = defineComponent<number>("TestComponent");
      const callback = vi.fn();
      const unsubscribe = signals.onAdd(TestComponent, callback);

      // Manually remove callback from map to simulate race condition
      const addMap = (signals as any).onAddMap;
      const callbacks = addMap.get(TestComponent);
      const index = callbacks.indexOf(callback);
      callbacks.splice(index, 1);

      // Unsubscribe should handle missing callback gracefully (covers lines 87-89)
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});

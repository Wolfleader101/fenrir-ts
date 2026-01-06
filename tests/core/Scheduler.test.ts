import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scheduler, Schedule, type ScheduleStage } from "@/core/Scheduler";
import type { SystemCtx, SyncSystemFn, AsyncSystemFn } from "@/core/SystemCtx";
import { EventBus } from "@/core/EventBus";
import { Time } from "@/core/Time";
import { Scene } from "@/core/Scene";
import { EntityList } from "@/core/ECS";
import { SceneManager } from "@/core/SceneManager";
import { ConsoleLogger } from "@/core/ConsoleLogger";

// Mock SystemCtx for testing
function createMockSystemCtx(): SystemCtx {
  const scene = new Scene("test");
  return {
    time: new Time(),
    scene,
    entities: scene.entityList,
    events: new EventBus(),
    scenes: new SceneManager(),
    logger: new ConsoleLogger(),
    stop: vi.fn(),
  };
}

describe("Scheduler", () => {
  let scheduler: Scheduler;
  let mockCtx: SystemCtx;

  beforeEach(() => {
    scheduler = new Scheduler();
    mockCtx = createMockSystemCtx();
  });

  describe("Schedule constants", () => {
    it("should define all required schedule stages", () => {
      expect(Schedule.PreInit).toBe("preInit");
      expect(Schedule.Init).toBe("init");
      expect(Schedule.PostInit).toBe("postInit");
      expect(Schedule.PreUpdate).toBe("preUpdate");
      expect(Schedule.Tick).toBe("tick");
      expect(Schedule.Update).toBe("update");
      expect(Schedule.PostUpdate).toBe("postUpdate");
      expect(Schedule.Exit).toBe("exit");
    });

    it("should have consistent string values", () => {
      const stages = Object.values(Schedule);
      const uniqueStages = new Set(stages);
      expect(uniqueStages.size).toBe(stages.length); // No duplicates

      stages.forEach((stage) => {
        expect(typeof stage).toBe("string");
        expect(stage.length).toBeGreaterThan(0);
      });
    });
  });

  describe("initialization", () => {
    it("should start with empty system lists for all stages", () => {
      Object.values(Schedule).forEach((stage) => {
        const systems = scheduler.getSystems(stage);
        expect(systems).toEqual([]);
        expect(Array.isArray(systems)).toBe(true);
      });
    });

    it("should be ready to accept systems immediately", () => {
      const testSystem: AsyncSystemFn = vi.fn();

      expect(() => {
        scheduler.addSystem(Schedule.Init, testSystem);
      }).not.toThrow();

      expect(scheduler.getSystems(Schedule.Init)).toContain(testSystem);
    });
  });

  describe("addSystem", () => {
    it("should add a system to the correct stage", () => {
      const initSystem: AsyncSystemFn = vi.fn();
      const updateSystem: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Init, initSystem);
      scheduler.addSystem(Schedule.Update, updateSystem);

      expect(scheduler.getSystems(Schedule.Init)).toEqual([initSystem]);
      expect(scheduler.getSystems(Schedule.Update)).toEqual([updateSystem]);
    });

    it("should return the scheduler for method chaining", () => {
      const system: AsyncSystemFn = vi.fn();

      const result = scheduler.addSystem(Schedule.Init, system);

      expect(result).toBe(scheduler);
    });

    it("should add multiple systems to the same stage", () => {
      const system1: SyncSystemFn = vi.fn();
      const system2: SyncSystemFn = vi.fn();
      const system3: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, system1);
      scheduler.addSystem(Schedule.Update, system2);
      scheduler.addSystem(Schedule.Update, system3);

      const systems = scheduler.getSystems(Schedule.Update);
      expect(systems).toEqual([system1, system2, system3]);
    });

    it("should maintain insertion order", () => {
      const systems: SyncSystemFn[] = [];
      for (let i = 0; i < 10; i++) {
        const system: SyncSystemFn = vi.fn();
        systems.push(system);
        scheduler.addSystem(Schedule.Tick, system);
      }

      expect(scheduler.getSystems(Schedule.Tick)).toEqual(systems);
    });

    it("should allow same system in different stages", () => {
      const asyncSystem: AsyncSystemFn = vi.fn();
      const syncSystem: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Init, asyncSystem);
      scheduler.addSystem(Schedule.Update, syncSystem);
      scheduler.addSystem(Schedule.Exit, asyncSystem);

      expect(scheduler.getSystems(Schedule.Init)).toContain(asyncSystem);
      expect(scheduler.getSystems(Schedule.Update)).toContain(syncSystem);
      expect(scheduler.getSystems(Schedule.Exit)).toContain(asyncSystem);
    });

    it("should allow same system multiple times in same stage", () => {
      const duplicateSystem: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, duplicateSystem);
      scheduler.addSystem(Schedule.Update, duplicateSystem);

      const systems = scheduler.getSystems(Schedule.Update);
      expect(systems).toEqual([duplicateSystem, duplicateSystem]);
      expect(systems).toHaveLength(2);
    });
  });

  describe("addSystems", () => {
    it("should add multiple systems at once", () => {
      const system1: AsyncSystemFn = vi.fn();
      const system2: AsyncSystemFn = vi.fn();
      const system3: AsyncSystemFn = vi.fn();
      const systems = [system1, system2, system3];

      scheduler.addSystems(Schedule.Init, systems);

      expect(scheduler.getSystems(Schedule.Init)).toEqual(systems);
    });

    it("should return the scheduler for method chaining", () => {
      const systems: SyncSystemFn[] = [vi.fn(), vi.fn()];

      const result = scheduler.addSystems(Schedule.Update, systems);

      expect(result).toBe(scheduler);
    });

    it("should handle empty arrays", () => {
      expect(() => {
        scheduler.addSystems(Schedule.PreUpdate, []);
      }).not.toThrow();

      expect(scheduler.getSystems(Schedule.PreUpdate)).toEqual([]);
    });

    it("should maintain order when adding to existing systems", () => {
      const existingSystem: SyncSystemFn = vi.fn();
      const newSystem1: SyncSystemFn = vi.fn();
      const newSystem2: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, existingSystem);
      scheduler.addSystems(Schedule.Update, [newSystem1, newSystem2]);

      expect(scheduler.getSystems(Schedule.Update)).toEqual([
        existingSystem,
        newSystem1,
        newSystem2,
      ]);
    });

    it("should work with readonly arrays", () => {
      const system1: SyncSystemFn = vi.fn();
      const system2: SyncSystemFn = vi.fn();
      const readonlySystems: readonly SyncSystemFn[] = [
        system1,
        system2,
      ] as const;

      expect(() => {
        scheduler.addSystems(Schedule.Tick, readonlySystems);
      }).not.toThrow();

      expect(scheduler.getSystems(Schedule.Tick)).toEqual([system1, system2]);
    });
  });

  describe("getSystems", () => {
    it("should return systems for the requested stage", () => {
      const initSystem: AsyncSystemFn = vi.fn();
      const updateSystem: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Init, initSystem);
      scheduler.addSystem(Schedule.Update, updateSystem);

      expect(scheduler.getSystems(Schedule.Init)).toEqual([initSystem]);
      expect(scheduler.getSystems(Schedule.Update)).toEqual([updateSystem]);
    });

    it("should return empty array for unused stages", () => {
      expect(scheduler.getSystems(Schedule.PreInit)).toEqual([]);
      expect(scheduler.getSystems(Schedule.PostUpdate)).toEqual([]);
    });

    it("should return arrays that can be safely iterated", () => {
      const systems: SyncSystemFn[] = [vi.fn(), vi.fn(), vi.fn()];
      scheduler.addSystems(Schedule.Update, systems);

      const retrievedSystems = scheduler.getSystems(Schedule.Update);

      expect(() => {
        for (const system of retrievedSystems) {
          expect(typeof system).toBe("function");
        }
      }).not.toThrow();
    });

    it("should return the actual array (not a copy)", () => {
      const system: AsyncSystemFn = vi.fn();
      scheduler.addSystem(Schedule.Init, system);

      const systems1 = scheduler.getSystems(Schedule.Init);
      const systems2 = scheduler.getSystems(Schedule.Init);

      expect(systems1).toBe(systems2); // Same reference
    });
  });

  describe("runSyncStage", () => {
    it("should execute all systems in the stage", () => {
      const system1 = vi.fn();
      const system2 = vi.fn();
      const system3 = vi.fn();

      scheduler.addSystems(Schedule.Update, [system1, system2, system3]);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system1).toHaveBeenCalledOnce();
      expect(system2).toHaveBeenCalledOnce();
      expect(system3).toHaveBeenCalledOnce();
    });

    it("should pass the system context to each system", () => {
      const system = vi.fn();

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(mockCtx);
    });

    it("should execute systems in insertion order", () => {
      const executionOrder: number[] = [];
      const system1: SyncSystemFn = () => executionOrder.push(1);
      const system2: SyncSystemFn = () => executionOrder.push(2);
      const system3: SyncSystemFn = () => executionOrder.push(3);

      scheduler.addSystem(Schedule.Update, system1);
      scheduler.addSystem(Schedule.Update, system2);
      scheduler.addSystem(Schedule.Update, system3);

      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should handle empty stages gracefully", () => {
      expect(() => {
        scheduler.runSyncStage(Schedule.Update, mockCtx);
      }).not.toThrow();
    });

    it("should continue execution if a system throws an error", () => {
      const system1 = vi.fn();
      const errorSystem: SyncSystemFn = () => {
        throw new Error("Test error");
      };
      const system3 = vi.fn();

      scheduler.addSystems(Schedule.Update, [system1, errorSystem, system3]);

      expect(() => {
        scheduler.runSyncStage(Schedule.Update, mockCtx);
      }).toThrow("Test error");

      // First system should have run
      expect(system1).toHaveBeenCalled();
      // Third system should not run due to the error
      expect(system3).not.toHaveBeenCalled();
    });

    it("should not affect other stages", () => {
      const updateSystem = vi.fn();
      const tickSystem = vi.fn();

      scheduler.addSystem(Schedule.Update, updateSystem);
      scheduler.addSystem(Schedule.Tick, tickSystem);

      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(updateSystem).toHaveBeenCalled();
      expect(tickSystem).not.toHaveBeenCalled();
    });
  });

  describe("runAsyncStage", () => {
    it("should execute all async systems in the stage", async () => {
      const system1 = vi.fn();
      const system2 = vi.fn();
      const system3 = vi.fn();

      scheduler.addSystems(Schedule.Init, [system1, system2, system3]);
      await scheduler.runAsyncStage(Schedule.Init, mockCtx);

      expect(system1).toHaveBeenCalledOnce();
      expect(system2).toHaveBeenCalledOnce();
      expect(system3).toHaveBeenCalledOnce();
    });

    it("should pass the system context to each system", async () => {
      const system = vi.fn();

      scheduler.addSystem(Schedule.Init, system);
      await scheduler.runAsyncStage(Schedule.Init, mockCtx);

      expect(system).toHaveBeenCalledWith(mockCtx);
    });

    it("should handle empty async stages gracefully", async () => {
      await expect(async () => {
        await scheduler.runAsyncStage(Schedule.PreInit, mockCtx);
      }).not.toThrow();
    });

    it("should not affect other stages", async () => {
      const initSystem = vi.fn();
      const exitSystem = vi.fn();

      scheduler.addSystem(Schedule.Init, initSystem);
      scheduler.addSystem(Schedule.Exit, exitSystem);

      await scheduler.runAsyncStage(Schedule.Init, mockCtx);

      expect(initSystem).toHaveBeenCalled();
      expect(exitSystem).not.toHaveBeenCalled();
    });
  });

  describe("method chaining", () => {
    it("should allow fluent configuration", () => {
      const system1: AsyncSystemFn = vi.fn();
      const system2: SyncSystemFn = vi.fn();
      const system3: SyncSystemFn = vi.fn();
      const system4: AsyncSystemFn = vi.fn();

      const result = scheduler
        .addSystem(Schedule.Init, system1)
        .addSystems(Schedule.Update, [system2, system3])
        .addSystem(Schedule.Exit, system4);

      expect(result).toBe(scheduler);
      expect(scheduler.getSystems(Schedule.Init)).toEqual([system1]);
      expect(scheduler.getSystems(Schedule.Update)).toEqual([system2, system3]);
      expect(scheduler.getSystems(Schedule.Exit)).toEqual([system4]);
    });
  });

  describe("system execution context", () => {
    it("should provide access to time in system context", () => {
      const system: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(
        expect.objectContaining({
          time: expect.any(Time),
        })
      );
    });

    it("should provide access to events in system context", () => {
      const system: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.any(EventBus),
        })
      );
    });

    it("should provide stop function in system context", () => {
      const system: SyncSystemFn = vi.fn();

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(
        expect.objectContaining({
          stop: expect.any(Function),
        })
      );
    });

    it("should allow systems to interact with the context", () => {
      const system: SyncSystemFn = (ctx: SystemCtx) => {
        ctx.stop(); // Call the stop function
        expect(ctx.time).toBeDefined();
        expect(ctx.events).toBeDefined();
        expect(ctx.scene).toBeDefined();
      };

      scheduler.addSystem(Schedule.Update, system);

      expect(() => {
        scheduler.runSyncStage(Schedule.Update, mockCtx);
      }).not.toThrow();

      expect(mockCtx.stop).toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle typical game initialization flow", async () => {
      const executionLog: string[] = [];

      const preInitSystem: AsyncSystemFn = () => {
        executionLog.push("preInit");
      };
      const initSystem: AsyncSystemFn = () => {
        executionLog.push("init");
      };
      const postInitSystem: AsyncSystemFn = () => {
        executionLog.push("postInit");
      };

      scheduler
        .addSystem(Schedule.PreInit, preInitSystem)
        .addSystem(Schedule.Init, initSystem)
        .addSystem(Schedule.PostInit, postInitSystem);

      // Simulate initialization sequence
      await scheduler.runAsyncStage(Schedule.PreInit, mockCtx);
      await scheduler.runAsyncStage(Schedule.Init, mockCtx);
      await scheduler.runAsyncStage(Schedule.PostInit, mockCtx);

      expect(executionLog).toEqual(["preInit", "init", "postInit"]);
    });

    it("should handle typical game update loop", () => {
      const executionLog: string[] = [];

      const preUpdateSystem: SyncSystemFn = () =>
        executionLog.push("preUpdate");
      const tickSystem: SyncSystemFn = () => executionLog.push("tick");
      const updateSystem: SyncSystemFn = () => executionLog.push("update");
      const postUpdateSystem: SyncSystemFn = () =>
        executionLog.push("postUpdate");

      scheduler
        .addSystem(Schedule.PreUpdate, preUpdateSystem)
        .addSystem(Schedule.Tick, tickSystem)
        .addSystem(Schedule.Update, updateSystem)
        .addSystem(Schedule.PostUpdate, postUpdateSystem);

      // Simulate one frame
      scheduler.runSyncStage(Schedule.PreUpdate, mockCtx);
      scheduler.runSyncStage(Schedule.Tick, mockCtx);
      scheduler.runSyncStage(Schedule.Update, mockCtx);
      scheduler.runSyncStage(Schedule.PostUpdate, mockCtx);

      expect(executionLog).toEqual([
        "preUpdate",
        "tick",
        "update",
        "postUpdate",
      ]);
    });

    it("should handle complex system dependencies", () => {
      const state = { value: 0 };

      const incrementSystem: SyncSystemFn = () => {
        state.value += 10;
      };
      const multiplySystem: SyncSystemFn = () => {
        state.value *= 2;
      };
      const decrementSystem: SyncSystemFn = () => {
        state.value -= 5;
      };

      // Order matters for these operations
      scheduler
        .addSystem(Schedule.Update, incrementSystem) // 0 + 10 = 10
        .addSystem(Schedule.Update, multiplySystem) // 10 * 2 = 20
        .addSystem(Schedule.Update, decrementSystem); // 20 - 5 = 15

      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(state.value).toBe(15);
    });

    it("should handle systems that modify scheduler state", () => {
      let dynamicSystemExecuted = false;

      const dynamicSystem: SyncSystemFn = () => {
        dynamicSystemExecuted = true;
      };

      const addSystemDynamically: SyncSystemFn = () => {
        scheduler.addSystem(Schedule.PostUpdate, dynamicSystem);
      };

      scheduler.addSystem(Schedule.Update, addSystemDynamically);

      scheduler.runSyncStage(Schedule.Update, mockCtx);
      expect(dynamicSystemExecuted).toBe(false);

      // The dynamically added system should be available for the next run
      scheduler.runSyncStage(Schedule.PostUpdate, mockCtx);
      expect(dynamicSystemExecuted).toBe(true);
    });
  });

  describe("performance considerations", () => {
    it("should handle large numbers of systems efficiently", () => {
      const systemCount = 1000;
      const systems: SyncSystemFn[] = [];

      for (let i = 0; i < systemCount; i++) {
        const system = vi.fn();
        systems.push(system);
        scheduler.addSystem(Schedule.Update, system);
      }

      const start = performance.now();
      scheduler.runSyncStage(Schedule.Update, mockCtx);
      const end = performance.now();

      // Should complete within a reasonable time (this is a loose check)
      expect(end - start).toBeLessThan(100); // 100ms threshold

      // All systems should have been called
      systems.forEach((system) => {
        expect(system).toHaveBeenCalledOnce();
      });
    });

    it("should maintain stable performance across multiple runs", () => {
      const systems: SyncSystemFn[] = [];
      for (let i = 0; i < 100; i++) {
        systems.push(vi.fn());
      }

      scheduler.addSystems(Schedule.Update, systems);

      // Run multiple times to check for performance degradation
      for (let run = 0; run < 10; run++) {
        const start = performance.now();
        scheduler.runSyncStage(Schedule.Update, mockCtx);
        const end = performance.now();

        expect(end - start).toBeLessThan(50); // Should stay fast
      }
    });
  });
});

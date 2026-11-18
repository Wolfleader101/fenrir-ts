import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scheduler, Schedule } from "@/core/Scheduler";
import type { SystemCtx, SyncSystemFn, AsyncSystemFn } from "@/core/SystemCtx";
import { EventBus } from "@/core/EventBus";
import { Time } from "@/core/Time";
import { Random } from "@/core/Random";
import { Scene } from "@/core/Scene";
import { SceneManager } from "@/core/SceneManager";
import { ConsoleLogger } from "@/core/ConsoleLogger";
import { Resources } from "@/core/Resource";
import { GameStates } from "@/core/State";
import { namedSpy } from "../utils/testHelpers";

// Mock SystemCtx for testing
function createMockSystemCtx(): SystemCtx {
  const scene = new Scene("test");
  return {
    time: new Time(),
    random: new Random(1),
    scene,
    entities: scene.entityList,
    events: new EventBus(),
    scenes: new SceneManager(),
    logger: new ConsoleLogger(),
    signal: new AbortController().signal,
    onCleanup: vi.fn(),
    stop: vi.fn(),
    resources: new Resources(),
    states: new GameStates(),
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
      const testSystem: AsyncSystemFn = namedSpy("testSystem");

      expect(() => {
        scheduler.addSystem(Schedule.Init, testSystem);
      }).not.toThrow();

      expect(scheduler.getSystems(Schedule.Init)).toContain(testSystem);
    });
  });

  describe("addSystem", () => {
    it("should add a system to the correct stage", () => {
      const initSystem: AsyncSystemFn = namedSpy("initSystem");
      const updateSystem: SyncSystemFn = namedSpy("updateSystem");

      scheduler.addSystem(Schedule.Init, initSystem);
      scheduler.addSystem(Schedule.Update, updateSystem);

      expect(scheduler.getSystems(Schedule.Init)).toEqual([initSystem]);
      expect(scheduler.getSystems(Schedule.Update)).toEqual([updateSystem]);
    });

    it("should return the scheduler for method chaining", () => {
      const system: AsyncSystemFn = namedSpy("system");

      const result = scheduler.addSystem(Schedule.Init, system);

      expect(result).toBe(scheduler);
    });

    it("should add multiple systems to the same stage", () => {
      const system1: SyncSystemFn = namedSpy("system1");
      const system2: SyncSystemFn = namedSpy("system2");
      const system3: SyncSystemFn = namedSpy("system3");

      scheduler.addSystem(Schedule.Update, system1);
      scheduler.addSystem(Schedule.Update, system2);
      scheduler.addSystem(Schedule.Update, system3);

      const systems = scheduler.getSystems(Schedule.Update);
      expect(systems).toEqual([system1, system2, system3]);
    });

    it("should maintain insertion order", () => {
      const systems: SyncSystemFn[] = [];
      for (let i = 0; i < 10; i++) {
        const system: SyncSystemFn = namedSpy(`system${i}`);
        systems.push(system);
        scheduler.addSystem(Schedule.Tick, system);
      }

      expect(scheduler.getSystems(Schedule.Tick)).toEqual(systems);
    });

    it("should allow same system in different stages", () => {
      const asyncSystem: AsyncSystemFn = namedSpy("asyncSystem");
      const syncSystem: SyncSystemFn = namedSpy("syncSystem");

      scheduler.addSystem(Schedule.Init, asyncSystem);
      scheduler.addSystem(Schedule.Update, syncSystem);
      scheduler.addSystem(Schedule.Exit, asyncSystem);

      expect(scheduler.getSystems(Schedule.Init)).toContain(asyncSystem);
      expect(scheduler.getSystems(Schedule.Update)).toContain(syncSystem);
      expect(scheduler.getSystems(Schedule.Exit)).toContain(asyncSystem);
    });

    it("allows the same system twice in a stage only under a second name", () => {
      const duplicateSystem: SyncSystemFn = namedSpy("duplicateSystem");

      scheduler.addSystem(Schedule.Update, duplicateSystem);
      expect(() => scheduler.addSystem(Schedule.Update, duplicateSystem)).toThrow(
        'Stage "update" already has a system named "duplicateSystem". Pass a different { name }',
      );
      scheduler.addSystem(Schedule.Update, duplicateSystem, { name: "duplicateSystemAgain" });

      const systems = scheduler.getSystems(Schedule.Update);
      expect(systems).toEqual([duplicateSystem, duplicateSystem]);
      expect(systems).toHaveLength(2);
    });
  });

  describe("addSystems", () => {
    it("should add multiple systems at once", () => {
      const system1: AsyncSystemFn = namedSpy("system1");
      const system2: AsyncSystemFn = namedSpy("system2");
      const system3: AsyncSystemFn = namedSpy("system3");
      const systems = [system1, system2, system3];

      scheduler.addSystems(Schedule.Init, systems);

      expect(scheduler.getSystems(Schedule.Init)).toEqual(systems);
    });

    it("should return the scheduler for method chaining", () => {
      const systems: SyncSystemFn[] = [namedSpy("a"), namedSpy("b")];

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
      const existingSystem: SyncSystemFn = namedSpy("existingSystem");
      const newSystem1: SyncSystemFn = namedSpy("newSystem1");
      const newSystem2: SyncSystemFn = namedSpy("newSystem2");

      scheduler.addSystem(Schedule.Update, existingSystem);
      scheduler.addSystems(Schedule.Update, [newSystem1, newSystem2]);

      expect(scheduler.getSystems(Schedule.Update)).toEqual([
        existingSystem,
        newSystem1,
        newSystem2,
      ]);
    });

    it("should work with readonly arrays", () => {
      const system1: SyncSystemFn = namedSpy("system1");
      const system2: SyncSystemFn = namedSpy("system2");
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
      const initSystem: AsyncSystemFn = namedSpy("initSystem");
      const updateSystem: SyncSystemFn = namedSpy("updateSystem");

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
      const systems: SyncSystemFn[] = [namedSpy("a"), namedSpy("b"), namedSpy("c")];
      scheduler.addSystems(Schedule.Update, systems);

      const retrievedSystems = scheduler.getSystems(Schedule.Update);

      expect(() => {
        for (const system of retrievedSystems) {
          expect(typeof system).toBe("function");
        }
      }).not.toThrow();
    });

    it("should return the actual array (not a copy)", () => {
      const system: AsyncSystemFn = namedSpy("system");
      scheduler.addSystem(Schedule.Init, system);

      const systems1 = scheduler.getSystems(Schedule.Init);
      const systems2 = scheduler.getSystems(Schedule.Init);

      expect(systems1).toBe(systems2); // Same reference
    });
  });

  describe("runSyncStage", () => {
    it("should execute all systems in the stage", () => {
      const system1 = namedSpy("system1");
      const system2 = namedSpy("system2");
      const system3 = namedSpy("system3");

      scheduler.addSystems(Schedule.Update, [system1, system2, system3]);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system1).toHaveBeenCalledOnce();
      expect(system2).toHaveBeenCalledOnce();
      expect(system3).toHaveBeenCalledOnce();
    });

    it("should pass the system context to each system", () => {
      const system = namedSpy("system");

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
      const system1 = namedSpy("system1");
      const errorSystem: SyncSystemFn = () => {
        throw new Error("Test error");
      };
      const system3 = namedSpy("system3");

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
      const updateSystem = namedSpy("updateSystem");
      const tickSystem = namedSpy("tickSystem");

      scheduler.addSystem(Schedule.Update, updateSystem);
      scheduler.addSystem(Schedule.Tick, tickSystem);

      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(updateSystem).toHaveBeenCalled();
      expect(tickSystem).not.toHaveBeenCalled();
    });
  });

  describe("runAsyncStage", () => {
    it("stops before the next system once ctx.signal aborts", async () => {
      const controller = new AbortController();
      const ctx = { ...mockCtx, signal: controller.signal };
      const first = namedSpy("first", () => controller.abort());
      const second = namedSpy("second");
      scheduler.addSystems(Schedule.Init, [first, second]);
      await scheduler.runAsyncStage(Schedule.Init, ctx);
      expect(first).toHaveBeenCalledOnce();
      expect(second).not.toHaveBeenCalled();

      await scheduler.runAsyncStage(Schedule.Init, ctx);
      expect(first).toHaveBeenCalledOnce();
    });

    it("should execute all async systems in the stage", async () => {
      const system1 = namedSpy("system1");
      const system2 = namedSpy("system2");
      const system3 = namedSpy("system3");

      scheduler.addSystems(Schedule.Init, [system1, system2, system3]);
      await scheduler.runAsyncStage(Schedule.Init, mockCtx);

      expect(system1).toHaveBeenCalledOnce();
      expect(system2).toHaveBeenCalledOnce();
      expect(system3).toHaveBeenCalledOnce();
    });

    it("should pass the system context to each system", async () => {
      const system = namedSpy("system");

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
      const initSystem = namedSpy("initSystem");
      const exitSystem = namedSpy("exitSystem");

      scheduler.addSystem(Schedule.Init, initSystem);
      scheduler.addSystem(Schedule.Exit, exitSystem);

      await scheduler.runAsyncStage(Schedule.Init, mockCtx);

      expect(initSystem).toHaveBeenCalled();
      expect(exitSystem).not.toHaveBeenCalled();
    });
  });

  describe("method chaining", () => {
    it("should allow fluent configuration", () => {
      const system1: AsyncSystemFn = namedSpy("system1");
      const system2: SyncSystemFn = namedSpy("system2");
      const system3: SyncSystemFn = namedSpy("system3");
      const system4: AsyncSystemFn = namedSpy("system4");

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
      const system: SyncSystemFn = namedSpy("system");

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(
        expect.objectContaining({
          time: expect.any(Time),
        })
      );
    });

    it("should provide access to events in system context", () => {
      const system: SyncSystemFn = namedSpy("system");

      scheduler.addSystem(Schedule.Update, system);
      scheduler.runSyncStage(Schedule.Update, mockCtx);

      expect(system).toHaveBeenCalledWith(
        expect.objectContaining({
          events: expect.any(EventBus),
        })
      );
    });

    it("should provide stop function in system context", () => {
      const system: SyncSystemFn = namedSpy("system");

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
    it("should run a large number of systems once each, in registration order", () => {
      const systemCount = 1000;
      const systems: ReturnType<typeof namedSpy>[] = [];

      for (let i = 0; i < systemCount; i++) {
        const system = namedSpy(`system${i}`);
        systems.push(system);
        scheduler.addSystem(Schedule.Update, system);
      }

      scheduler.runSyncStage(Schedule.Update, mockCtx);

      // All systems should have been called, in the order they were added
      systems.forEach((system) => {
        expect(system).toHaveBeenCalledOnce();
      });
      const callOrder = systems.map((system) => system.mock.invocationCallOrder[0]!);
      expect(callOrder).toEqual([...callOrder].sort((a, b) => a - b));
    });

    it("should resolve the order once and reuse it across runs", () => {
      const systems: ReturnType<typeof namedSpy>[] = [];
      for (let i = 0; i < 100; i++) {
        systems.push(namedSpy(`system${i}`));
      }

      scheduler.addSystems(Schedule.Update, systems);
      const order = scheduler.getSchedule(Schedule.Update);

      // Running the stage repeatedly must not re-sort it: the cached order is
      // the same array after every run.
      for (let run = 0; run < 10; run++) {
        scheduler.runSyncStage(Schedule.Update, mockCtx);
        expect(scheduler.getSchedule(Schedule.Update)).toBe(order);
      }

      systems.forEach((system) => {
        expect(system).toHaveBeenCalledTimes(10);
      });
    });
  });
});

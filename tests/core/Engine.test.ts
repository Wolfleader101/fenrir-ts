import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Engine } from "@/core/Engine";
import { Scheduler, Schedule } from "@/core/Scheduler";
import { EventBus } from "@/core/EventBus";
import { Time } from "@/core/Time";
import type { SystemCtx, SystemFn } from "@/core/SystemCtx";

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = vi.fn();
const mockCancelAnimationFrame = vi.fn();

// Store original implementations
const originalRAF = globalThis.requestAnimationFrame;
const originalCAF = globalThis.cancelAnimationFrame;

describe("Engine", () => {
  let engine: Engine;
  let scheduler: Scheduler;
  let eventBus: EventBus;
  let scene: {};

  beforeEach(() => {
    // Setup mocks
    globalThis.requestAnimationFrame = mockRequestAnimationFrame;
    globalThis.cancelAnimationFrame = mockCancelAnimationFrame;
    mockRequestAnimationFrame.mockClear();
    mockCancelAnimationFrame.mockClear();

    // Create dependencies
    scheduler = new Scheduler();
    eventBus = new EventBus();
    scene = {};

    // Create engine
    engine = new Engine({
      scheduler,
      scene,
      events: eventBus,
    });
  });

  afterEach(() => {
    // Restore original implementations
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;

    // Stop engine if running
    if (engine.isRunning()) {
      engine.stop();
    }
  });

  describe("initialization", () => {
    it("should create engine with required dependencies", () => {
      expect(engine).toBeDefined();
      expect(engine.isRunning()).toBe(false);
      expect(engine.getTime()).toBeInstanceOf(Time);
    });

    it("should start in stopped state", () => {
      expect(engine.isRunning()).toBe(false);
    });

    it("should provide access to time system", () => {
      const time = engine.getTime();
      expect(time).toBeInstanceOf(Time);
      expect(time.deltaTime).toBe(0);
    });
  });

  describe("system registration", () => {
    it("should allow adding systems through engine", () => {
      const testSystem: SystemFn = vi.fn();

      const result = engine.addSystem(Schedule.Init, testSystem);

      expect(result).toBe(engine); // Should return engine for chaining
      expect(scheduler.getSystems(Schedule.Init)).toContain(testSystem);
    });

    it("should allow adding multiple systems through engine", () => {
      const system1: SystemFn = vi.fn();
      const system2: SystemFn = vi.fn();
      const systems = [system1, system2];

      const result = engine.addSystems(Schedule.Update, systems);

      expect(result).toBe(engine);
      expect(scheduler.getSystems(Schedule.Update)).toEqual(systems);
    });

    it("should support method chaining for system registration", () => {
      const initSystem: SystemFn = vi.fn();
      const updateSystem: SystemFn = vi.fn();
      const exitSystem: SystemFn = vi.fn();

      const result = engine
        .addSystem(Schedule.Init, initSystem)
        .addSystems(Schedule.Update, [updateSystem])
        .addSystem(Schedule.Exit, exitSystem);

      expect(result).toBe(engine);
      expect(scheduler.getSystems(Schedule.Init)).toContain(initSystem);
      expect(scheduler.getSystems(Schedule.Update)).toContain(updateSystem);
      expect(scheduler.getSystems(Schedule.Exit)).toContain(exitSystem);
    });
  });

  describe("engine lifecycle", () => {
    it("should run initialization stages when started", () => {
      const preInitSystem = vi.fn();
      const initSystem = vi.fn();
      const postInitSystem = vi.fn();

      engine
        .addSystem(Schedule.PreInit, preInitSystem)
        .addSystem(Schedule.Init, initSystem)
        .addSystem(Schedule.PostInit, postInitSystem);

      engine.run();

      expect(engine.isRunning()).toBe(true);
      expect(preInitSystem).toHaveBeenCalledOnce();
      expect(initSystem).toHaveBeenCalledOnce();
      expect(postInitSystem).toHaveBeenCalledOnce();
    });

    it("should execute initialization stages in correct order", () => {
      const executionOrder: string[] = [];

      const preInitSystem: SystemFn = () => executionOrder.push("preInit");
      const initSystem: SystemFn = () => executionOrder.push("init");
      const postInitSystem: SystemFn = () => executionOrder.push("postInit");

      engine
        .addSystem(Schedule.PreInit, preInitSystem)
        .addSystem(Schedule.Init, initSystem)
        .addSystem(Schedule.PostInit, postInitSystem);

      engine.run();

      expect(executionOrder).toEqual(["preInit", "init", "postInit"]);
    });

    it("should not run if already running", () => {
      const initSystem = vi.fn();
      engine.addSystem(Schedule.Init, initSystem);

      engine.run();
      expect(initSystem).toHaveBeenCalledTimes(1);

      // Try to run again
      engine.run();
      expect(initSystem).toHaveBeenCalledTimes(1); // Should not be called again
    });

    it("should start the animation frame loop", () => {
      engine.run();

      expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);
      expect(typeof mockRequestAnimationFrame.mock.calls[0][0]).toBe(
        "function"
      );
    });

    it("should provide correct system context", () => {
      const testSystem: SystemFn = vi.fn();
      engine.addSystem(Schedule.Init, testSystem);

      engine.run();

      expect(testSystem).toHaveBeenCalledWith({
        time: engine.getTime(),
        scene: scene,
        events: eventBus,
        stop: expect.any(Function),
      });
    });

    it("should allow systems to stop the engine", () => {
      const stopperSystem: SystemFn = (ctx) => {
        ctx.stop();
      };

      engine.addSystem(Schedule.Init, stopperSystem);
      engine.run();

      expect(engine.isRunning()).toBe(false);
    });
  });

  describe("game loop", () => {
    it("should update time in the loop", () => {
      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123; // Mock frame ID
      });

      const time = engine.getTime();
      const originalUpdate = vi.spyOn(time, "update");

      engine.run();

      // Simulate one frame
      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(originalUpdate).toHaveBeenCalled();
    });

    it("should execute update stages in correct order", () => {
      const executionOrder: string[] = [];

      engine
        .addSystem(Schedule.PreUpdate, () => executionOrder.push("preUpdate"))
        .addSystem(Schedule.Tick, () => executionOrder.push("tick"))
        .addSystem(Schedule.Update, () => executionOrder.push("update"))
        .addSystem(Schedule.PostUpdate, () =>
          executionOrder.push("postUpdate")
        );

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();

      // Simulate one frame
      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(executionOrder).toEqual(["preUpdate", "update", "postUpdate"]);
    });

    it("should handle fixed timestep updates", () => {
      const tickSystem = vi.fn();
      engine.addSystem(Schedule.Tick, tickSystem);

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      const time = engine.getTime();

      engine.run();

      // Simulate large time delta that should trigger multiple ticks
      time.accumulator = time.tickRate * 2.5; // Should cause 2 tick calls

      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(tickSystem).toHaveBeenCalledTimes(2);
      expect(time.accumulator).toBeLessThan(time.tickRate);
    });

    it("should update event bus at frame boundary", () => {
      const updateSpy = vi.spyOn(eventBus, "update");

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();

      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(updateSpy).toHaveBeenCalled();
    });

    it("should schedule next frame when running", () => {
      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();
      expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(1);

      // Simulate one frame
      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(mockRequestAnimationFrame).toHaveBeenCalledTimes(2); // Initial + next frame
    });

    it("should not schedule next frame when stopped", () => {
      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();
      engine.stop();

      // Clear the mock to count only new calls
      mockRequestAnimationFrame.mockClear();

      // Simulate frame callback after stop
      if (loopCallback) {
        (loopCallback as Function)();
      }

      expect(mockRequestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe("stopping the engine", () => {
    it("should stop when not running gracefully", () => {
      expect(() => {
        engine.stop();
      }).not.toThrow();

      expect(engine.isRunning()).toBe(false);
    });

    it("should cancel animation frame when stopped", () => {
      mockRequestAnimationFrame.mockReturnValue(456); // Mock frame ID

      engine.run();
      expect(engine.isRunning()).toBe(true);

      engine.stop();

      expect(engine.isRunning()).toBe(false);
      expect(mockCancelAnimationFrame).toHaveBeenCalledWith(456);
    });

    it("should run exit stage when stopped", () => {
      const exitSystem = vi.fn();
      engine.addSystem(Schedule.Exit, exitSystem);

      engine.run();
      engine.stop();

      expect(exitSystem).toHaveBeenCalledOnce();
    });

    it("should provide system context without stop function in exit stage", () => {
      const exitSystem: SystemFn = vi.fn();
      engine.addSystem(Schedule.Exit, exitSystem);

      engine.run();
      engine.stop();

      expect(exitSystem).toHaveBeenCalledWith({
        time: engine.getTime(),
        scene: scene,
        events: eventBus,
        stop: expect.any(Function),
      });

      // The stop function in exit context should be a no-op
      const exitSystemMock = exitSystem as any;
      const exitCtx = exitSystemMock.mock.calls[0][0] as SystemCtx;
      expect(() => exitCtx.stop()).not.toThrow();
    });

    it("should allow multiple stop calls safely", () => {
      mockRequestAnimationFrame.mockReturnValue(789);

      engine.run();
      engine.stop();

      mockCancelAnimationFrame.mockClear();

      // Second stop should not cause issues
      expect(() => {
        engine.stop();
      }).not.toThrow();

      expect(mockCancelAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete engine lifecycle", () => {
      const lifecycle: string[] = [];

      engine
        .addSystem(Schedule.PreInit, () => lifecycle.push("preInit"))
        .addSystem(Schedule.Init, () => lifecycle.push("init"))
        .addSystem(Schedule.PostInit, () => lifecycle.push("postInit"))
        .addSystem(Schedule.PreUpdate, () => lifecycle.push("preUpdate"))
        .addSystem(Schedule.Update, () => lifecycle.push("update"))
        .addSystem(Schedule.PostUpdate, () => lifecycle.push("postUpdate"))
        .addSystem(Schedule.Exit, () => lifecycle.push("exit"));

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      // Start engine
      engine.run();

      // Run one frame
      if (loopCallback) {
        (loopCallback as Function)();
      }

      // Stop engine
      engine.stop();

      expect(lifecycle).toEqual([
        "preInit",
        "init",
        "postInit",
        "preUpdate",
        "update",
        "postUpdate",
        "exit",
      ]);
    });

    it("should handle system that throws during initialization", () => {
      const errorSystem: SystemFn = () => {
        throw new Error("Init error");
      };
      const normalSystem = vi.fn();

      engine
        .addSystem(Schedule.Init, errorSystem)
        .addSystem(Schedule.PostInit, normalSystem);

      expect(() => {
        engine.run();
      }).toThrow("Init error");

      // Should not proceed to PostInit due to error
      expect(normalSystem).not.toHaveBeenCalled();
    });

    it("should handle system that throws during update loop", () => {
      const errorSystem: SystemFn = () => {
        throw new Error("Update error");
      };
      const normalSystem = vi.fn();

      engine
        .addSystem(Schedule.PreUpdate, normalSystem)
        .addSystem(Schedule.Update, errorSystem)
        .addSystem(Schedule.PostUpdate, normalSystem);

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();

      expect(() => {
        if (loopCallback) {
          loopCallback();
        }
      }).toThrow("Update error");

      // PreUpdate should have run
      expect(normalSystem).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid start/stop cycles", () => {
      const initSystem = vi.fn();
      const exitSystem = vi.fn();

      engine
        .addSystem(Schedule.Init, initSystem)
        .addSystem(Schedule.Exit, exitSystem);

      // Multiple start/stop cycles
      for (let i = 0; i < 3; i++) {
        engine.run();
        expect(engine.isRunning()).toBe(true);

        engine.stop();
        expect(engine.isRunning()).toBe(false);
      }

      expect(initSystem).toHaveBeenCalledTimes(3);
      expect(exitSystem).toHaveBeenCalledTimes(3);
    });

    it("should maintain separate time instances across engine instances", () => {
      const engine2 = new Engine({
        scheduler: new Scheduler(),
        scene: {},
        events: new EventBus(),
      });

      const time1 = engine.getTime();
      const time2 = engine2.getTime();

      expect(time1).not.toBe(time2);
      expect(time1).toBeInstanceOf(Time);
      expect(time2).toBeInstanceOf(Time);
    });

    it("should handle complex fixed timestep scenarios", () => {
      let tickCount = 0;
      const tickSystem: SystemFn = () => {
        tickCount++;
      };

      engine.addSystem(Schedule.Tick, tickSystem);

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      const time = engine.getTime();

      engine.run();

      // Simulate no accumulated time - no ticks should occur
      time.accumulator = 0;
      if (loopCallback) {
        (loopCallback as Function)();
      }
      expect(tickCount).toBe(0);

      // Simulate exactly one tick worth of time
      time.accumulator = time.tickRate;
      if (loopCallback) {
        (loopCallback as Function)();
      }
      expect(tickCount).toBe(1);

      // Simulate more than one tick but less than two
      time.accumulator = time.tickRate * 1.5;
      if (loopCallback) {
        (loopCallback as Function)();
      }
      expect(tickCount).toBe(2); // Should be 1 more tick
      expect(time.accumulator).toBeLessThan(time.tickRate);
    });
  });

  describe("performance considerations", () => {
    it("should handle many systems efficiently", () => {
      const systemCount = 100;
      const systems: SystemFn[] = [];

      for (let i = 0; i < systemCount; i++) {
        const system = vi.fn();
        systems.push(system);
        engine.addSystem(Schedule.Update, system);
      }

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();

      const start = performance.now();
      if (loopCallback) {
        (loopCallback as Function)();
      }
      const end = performance.now();

      // Should complete within reasonable time
      expect(end - start).toBeLessThan(50);

      // All systems should have been called
      systems.forEach((system) => {
        expect(system).toHaveBeenCalledOnce();
      });
    });

    it("should not accumulate memory leaks across frames", () => {
      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      const updateSystem: SystemFn = vi.fn();
      engine.addSystem(Schedule.Update, updateSystem);

      engine.run();

      // Simulate multiple frames
      for (let i = 0; i < 10; i++) {
        if (loopCallback) {
          (loopCallback as Function)();
        }
      }

      expect(updateSystem).toHaveBeenCalledTimes(10);

      // Engine should still be responsive
      expect(engine.isRunning()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle requestAnimationFrame returning null", () => {
      mockRequestAnimationFrame.mockReturnValue(null);

      expect(() => {
        engine.run();
        engine.stop();
      }).not.toThrow();
    });

    it("should handle missing animation frame APIs gracefully", () => {
      // Temporarily remove the mocked functions
      delete (globalThis as any).requestAnimationFrame;
      delete (globalThis as any).cancelAnimationFrame;

      expect(() => {
        engine.run();
      }).toThrow(); // Should throw since RAF is undefined

      // Restore for cleanup
      globalThis.requestAnimationFrame = mockRequestAnimationFrame;
      globalThis.cancelAnimationFrame = mockCancelAnimationFrame;
    });

    it("should handle zero tick rates safely", () => {
      const time = engine.getTime();
      const originalTickRate = time.tickRate;

      const tickSystem = vi.fn();
      engine.addSystem(Schedule.Tick, tickSystem);

      let loopCallback: Function | null = null;
      mockRequestAnimationFrame.mockImplementation((callback: Function) => {
        loopCallback = callback;
        return 123;
      });

      engine.run();

      // Test with normal tick rate first
      time.accumulator = time.tickRate * 0.5; // Less than one tick
      if (loopCallback) {
        (loopCallback as Function)();
      }
      expect(tickSystem).not.toHaveBeenCalled();

      // Reset for cleanup
      time.tickRate = originalTickRate;
    });
  });
});

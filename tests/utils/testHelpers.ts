import { vi, expect } from "vitest";
import { Engine } from "@/core/Engine";
import { Scheduler } from "@/core/Scheduler";
import { EventBus } from "@/core/EventBus";
import { Time } from "@/core/Time";
import { EntityList } from "@/core/ECS/EntityList";
import type { SystemCtx } from "@/core/SystemCtx";
import type { Entity } from "@/core/ECS/EntityList";
import { SceneManager } from "@/core/SceneManager";
import { NullLogger } from "@/core/NullLogger";

/**
 * Creates a mock SystemCtx for testing systems
 */
export function createMockSystemCtx(
  overrides: Partial<SystemCtx> = {}
): SystemCtx {
  return {
    time: new Time(),
    events: new EventBus(),
    logger: new NullLogger(),
    scenes: new SceneManager(),
    scene: new SceneManager().getActiveScene(),
    entities: new EntityList(),
    stop: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a minimal engine setup for testing
 */
export function createTestEngine(): Engine {
  return new Engine({
    scheduler: new Scheduler(),
    events: new EventBus(),
    sceneManager: new SceneManager(),
    logger: new NullLogger(),
  });
}

/**
 * Creates a test entity list with some pre-defined entities for testing
 */
export function createTestEntityList(entityCount: number = 5): {
  entities: EntityList;
  createdEntities: Entity[];
} {
  const entities = new EntityList();
  const createdEntities: Entity[] = [];

  for (let i = 0; i < entityCount; i++) {
    createdEntities.push(entities.createEntity());
  }

  return { entities, createdEntities };
}

/**
 * Mock animation frame utilities for testing browser APIs
 */
export class MockAnimationFrame {
  private callbacks: Map<number, Function> = new Map();
  private nextId = 1;

  constructor() {
    this.setup();
  }

  setup() {
    globalThis.requestAnimationFrame = vi.fn((callback: Function) => {
      const id = this.nextId++;
      this.callbacks.set(id, callback);
      return id;
    });

    globalThis.cancelAnimationFrame = vi.fn((id: number) => {
      this.callbacks.delete(id);
    });
  }

  tick() {
    const callbacks = Array.from(this.callbacks.values());
    this.callbacks.clear();
    callbacks.forEach((callback) => callback());
  }

  tickAll() {
    while (this.callbacks.size > 0) {
      this.tick();
    }
  }

  getCallbacks() {
    return Array.from(this.callbacks.values());
  }

  cleanup() {
    this.callbacks.clear();
  }
}

/**
 * Creates a spy system that tracks when it's called
 */
export function createSpySystem(_name: string = "spy") {
  const calls: SystemCtx[] = [];

  const system = vi.fn((ctx: SystemCtx) => {
    calls.push(ctx);
  });

  return { system, calls };
}

/**
 * Creates a system that modifies a shared state for testing
 */
export function createStatefulSystem<T extends Record<string, any>>(
  state: T,
  modifier: (state: T, ctx: SystemCtx) => Partial<T>
) {
  return (ctx: SystemCtx) => {
    const updates = modifier(state, ctx);
    Object.assign(state, updates);
  };
}

/**
 * Time manipulation utilities for testing
 */
export class TimeController {
  private time: Time;

  constructor(time: Time) {
    this.time = time;
  }

  advance(deltaMs: number) {
    // Simulate time passage
    const now = performance.now() + deltaMs;
    Object.defineProperty(this.time, "lastTime", {
      value: now - deltaMs,
      writable: true,
    });
    this.time.update();
  }

  setTickRate(tickRateMs: number) {
    this.time.tickRate = tickRateMs / 1000;
  }

  addAccumulator(deltaMs: number) {
    this.time.accumulator += deltaMs / 1000;
  }

  reset() {
    this.time.accumulator = 0;
    Object.defineProperty(this.time, "lastTime", {
      value: performance.now(),
      writable: true,
    });
  }
}

/**
 * Event testing utilities
 */
export class EventTester {
  private events: EventBus;

  constructor(events: EventBus) {
    this.events = events;
  }

  sendMultiple<T>(eventType: symbol, events: T[]) {
    events.forEach((event) => {
      this.events.send(eventType, event);
    });
  }

  expectEvents<T>(eventType: symbol, expected: T[]) {
    const actual = this.events.read(eventType);
    expect(actual).toEqual(expected);
  }

  expectEventCount(eventType: symbol, count: number) {
    const actual = this.events.read(eventType);
    expect(actual).toHaveLength(count);
  }

  clear() {
    this.events.clear();
  }
}

/**
 * Test data generators
 */
export const testDataGenerators = {
  /**
   * Generates test entities with random components
   */
  generateTestEntities(count: number, componentTypes: symbol[] = []) {
    const entities = new EntityList();
    const createdEntities = [];

    for (let i = 0; i < count; i++) {
      const entity = entities.createEntity();
      createdEntities.push(entity);

      // Add random components
      componentTypes.forEach((componentType) => {
        if (Math.random() > 0.5) {
          entities.set(entity, componentType, { value: i });
        }
      });
    }

    return { entities, createdEntities };
  },

  /**
   * Generates test events of different types
   */
  generateTestEvents<T>(count: number, generator: (index: number) => T): T[] {
    return Array.from({ length: count }, (_, i) => generator(i));
  },

  /**
   * Generates performance test data
   */
  generatePerformanceTestData(entityCount: number, componentCount: number) {
    const entities = new EntityList();
    const componentTypes = Array.from({ length: componentCount }, (_, i) =>
      Symbol(`TestComponent${i}`)
    );

    const createdEntities = [];
    for (let i = 0; i < entityCount; i++) {
      const entity = entities.createEntity();
      createdEntities.push(entity);

      // Add all components to each entity
      componentTypes.forEach((componentType) => {
        entities.set(entity, componentType, {
          id: i,
          value: Math.random(),
          data: `entity_${i}`,
        });
      });
    }

    return { entities, createdEntities, componentTypes };
  },
};

/**
 * Performance testing utilities
 */
export class PerformanceTester {
  static time<T>(
    operation: () => T,
    name?: string
  ): { result: T; duration: number } {
    const start = performance.now();
    const result = operation();
    const end = performance.now();
    const duration = end - start;

    if (name) {
      console.log(`${name}: ${duration.toFixed(2)}ms`);
    }

    return { result, duration };
  }

  static expectFasterThan<T>(
    operation: () => T,
    maxDurationMs: number,
    name?: string
  ): T {
    const { result, duration } = this.time(operation, name);
    expect(duration).toBeLessThan(maxDurationMs);
    return result;
  }

  static benchmark<T>(
    operation: () => T,
    iterations: number = 100
  ): { averageDuration: number; minDuration: number; maxDuration: number } {
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const { duration } = this.time(operation);
      durations.push(duration);
    }

    return {
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
    };
  }
}

/**
 * Assertion helpers for common test patterns
 */
export const testAssertions = {
  /**
   * Asserts that a function throws with a specific message
   */
  expectThrowsWithMessage(fn: () => void, expectedMessage: string) {
    let thrownError: Error | null = null;

    try {
      fn();
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError).not.toBeNull();
    expect(thrownError?.message).toBe(expectedMessage);
  },

  /**
   * Asserts that arrays are equal but order doesn't matter
   */
  expectArraysEqualUnordered<T>(actual: T[], expected: T[]) {
    expect(actual.sort()).toEqual(expected.sort());
  },

  /**
   * Asserts that an object has specific properties
   */
  expectObjectHasProperties<T extends Record<string, any>>(
    obj: T,
    properties: (keyof T)[]
  ) {
    properties.forEach((prop) => {
      expect(obj).toHaveProperty(String(prop));
    });
  },

  /**
   * Asserts floating point equality with tolerance
   */
  expectFloatEqual(
    actual: number,
    expected: number,
    tolerance: number = 0.001
  ) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
  },
};

/**
 * Test cleanup utilities
 */
export class TestCleanup {
  private cleanupFunctions: (() => void)[] = [];

  add(cleanup: () => void) {
    this.cleanupFunctions.push(cleanup);
  }

  addEngine(engine: Engine) {
    this.add(() => {
      if (engine.isRunning()) {
        engine.stop();
      }
    });
  }

  addMockAnimationFrame(mockFrame: MockAnimationFrame) {
    this.add(() => mockFrame.cleanup());
  }

  cleanup() {
    this.cleanupFunctions.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn("Cleanup function threw error:", error);
      }
    });
    this.cleanupFunctions.length = 0;
  }
}

/**
 * Common test scenarios and patterns
 */
export const testScenarios = {
  /**
   * Creates a complete game engine test setup
   */
  createGameEngineSetup() {
    const engine = createTestEngine();
    const cleanup = new TestCleanup();
    const mockFrame = new MockAnimationFrame();

    cleanup.addEngine(engine);
    cleanup.addMockAnimationFrame(mockFrame);

    return {
      engine,
      scheduler: engine["scheduler"] as Scheduler,
      time: engine.getTime(),
      cleanup,
      mockFrame,
    };
  },

  /**
   * Creates an ECS test setup with entities and components
   */
  createECSSetup(entityCount: number = 5) {
    const { entities, createdEntities } = createTestEntityList(entityCount);

    return {
      entities,
      createdEntities,
      createComponent: <T>(_data: T) => Symbol("TestComponent"),
      addComponent: <T>(entity: Entity, type: symbol, data: T) => {
        return entities.set(entity, type, data);
      },
      hasComponent: (entity: Entity, type: symbol) => {
        return entities.has(entity, type);
      },
      getComponent: <T>(entity: Entity, type: symbol): T => {
        return entities.get(entity, type);
      },
    };
  },
};

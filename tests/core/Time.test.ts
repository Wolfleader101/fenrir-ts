import { describe, it, expect, beforeEach, vi } from "vitest";
import { Time } from "@/core/Time";

describe("Time", () => {
  let time: Time;

  beforeEach(() => {
    // Reset time-related mocks before each test
    vi.clearAllMocks();
    time = new Time();
  });

  describe("initialization", () => {
    it("should initialize with correct default values", () => {
      expect(time.deltaTime).toBe(0);
      expect(time.tickRate).toBe(1.0 / 60.0); // 60 FPS
      expect(time.accumulator).toBe(0);
    });

    it("should set start time to current performance time", () => {
      const mockPerformanceNow = vi
        .spyOn(performance, "now")
        .mockReturnValue(1000);

      const newTime = new Time();

      expect(mockPerformanceNow).toHaveBeenCalled();
      mockPerformanceNow.mockRestore();
    });
  });

  describe("update method", () => {
    it("should calculate deltaTime correctly", () => {
      const mockTimes = [1000, 1050]; // 50ms difference
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      // Create time instance (uses first mock value)
      const testTime = new Time();

      // Call update (uses second mock value)
      testTime.update();

      expect(testTime.deltaTime).toBe(0.05); // 50ms = 0.05 seconds

      vi.restoreAllMocks();
    });

    it("should update accumulator correctly", () => {
      const mockTimes = [1000, 1016.67]; // ~16.67ms (60 FPS frame)
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      const initialAccumulator = testTime.accumulator;

      testTime.update();

      expect(testTime.accumulator).toBeGreaterThan(initialAccumulator);
      expect(testTime.accumulator).toBeCloseTo(0.01667, 4); // ~16.67ms

      vi.restoreAllMocks();
    });

    it("should accumulate time across multiple updates", () => {
      const mockTimes = [1000, 1016.67, 1033.34]; // Two 16.67ms frames
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();

      testTime.update(); // First frame
      const firstAccumulator = testTime.accumulator;

      testTime.update(); // Second frame

      expect(testTime.accumulator).toBeGreaterThan(firstAccumulator);
      expect(testTime.accumulator).toBeCloseTo(0.03334, 4); // ~33.34ms total

      vi.restoreAllMocks();
    });

    it("should handle very small time differences", () => {
      const mockTimes = [1000, 1000.1]; // 0.1ms difference
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBeCloseTo(0.0001, 6); // 0.1ms = 0.0001 seconds
      expect(testTime.accumulator).toBeCloseTo(0.0001, 6);

      vi.restoreAllMocks();
    });

    it("should handle large time differences", () => {
      const mockTimes = [1000, 2000]; // 1000ms (1 second)
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBe(1.0); // 1000ms = 1.0 seconds
      expect(testTime.accumulator).toBe(1.0);

      vi.restoreAllMocks();
    });
  });

  describe("tick rate", () => {
    it("should have correct default tick rate for 60 FPS", () => {
      expect(time.tickRate).toBeCloseTo(0.01667, 4); // 1/60 ≈ 0.01667
    });

    it("should allow modification of tick rate", () => {
      time.tickRate = 1.0 / 30.0; // 30 FPS

      expect(time.tickRate).toBeCloseTo(0.03333, 4); // 1/30 ≈ 0.03333
    });

    it("should work with custom tick rates", () => {
      time.tickRate = 0.1; // 10 Hz

      expect(time.tickRate).toBe(0.1);
    });
  });

  describe("accumulator behavior", () => {
    it("should allow direct accumulator manipulation", () => {
      time.accumulator = 0.5;

      expect(time.accumulator).toBe(0.5);
    });

    it("should support accumulator reduction (for fixed timestep)", () => {
      time.accumulator = 0.1;
      time.accumulator -= time.tickRate;

      expect(time.accumulator).toBeCloseTo(0.1 - 1.0 / 60.0, 5);
    });

    it("should handle accumulator reset", () => {
      time.accumulator = 1.0;
      time.accumulator = 0;

      expect(time.accumulator).toBe(0);
    });
  });

  describe("real-time behavior simulation", () => {
    it("should simulate a typical game loop frame", () => {
      const targetFPS = 60;
      const frameTimeMs = 1000 / targetFPS;

      const mockTimes = [1000, 1000 + frameTimeMs];
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBeCloseTo(frameTimeMs / 1000, 4);
      expect(testTime.accumulator).toBeCloseTo(frameTimeMs / 1000, 4);

      vi.restoreAllMocks();
    });

    it("should simulate frame rate drops", () => {
      const normalFrameTime = 16.67; // 60 FPS
      const droppedFrameTime = 50; // 20 FPS

      const mockTimes = [
        1000,
        1000 + normalFrameTime,
        1000 + normalFrameTime + droppedFrameTime,
      ];
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();

      // Normal frame
      testTime.update();
      const normalDelta = testTime.deltaTime;

      // Dropped frame
      testTime.update();
      const droppedDelta = testTime.deltaTime;

      expect(normalDelta).toBeCloseTo(0.01667, 4);
      expect(droppedDelta).toBeCloseTo(0.05, 4);
      expect(droppedDelta).toBeGreaterThan(normalDelta);

      vi.restoreAllMocks();
    });

    it("should simulate fixed timestep logic", () => {
      // Simulate a scenario where accumulator builds up and gets consumed
      const testTime = new Time();
      testTime.accumulator = 0.05; // 50ms accumulated

      const tickRate = testTime.tickRate; // ~16.67ms
      let tickCount = 0;

      // Simulate consuming fixed timesteps
      while (testTime.accumulator >= tickRate) {
        testTime.accumulator -= tickRate;
        tickCount++;
      }

      expect(tickCount).toBe(3); // Should consume 3 ticks (3 * 16.67 ≈ 50ms)
      expect(testTime.accumulator).toBeCloseTo(0.05 - 3 * tickRate, 5);
    });
  });

  describe("edge cases", () => {
    it("should handle zero time difference", () => {
      const mockTime = 1000;
      vi.spyOn(performance, "now").mockReturnValue(mockTime);

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBe(0);
      expect(testTime.accumulator).toBe(0);

      vi.restoreAllMocks();
    });

    it("should handle negative time differences gracefully", () => {
      // This shouldn't happen in practice, but let's test robustness
      const mockTimes = [1000, 999]; // Time going backwards
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBe(-0.001); // -1ms
      expect(testTime.accumulator).toBe(-0.001);

      vi.restoreAllMocks();
    });

    it("should handle very high precision time values", () => {
      const mockTimes = [1000.123456789, 1000.12345679]; // 0.001ms difference
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();
      testTime.update();

      expect(testTime.deltaTime).toBeCloseTo(0.000000001, 6); // 0.001ms

      vi.restoreAllMocks();
    });
  });

  describe("performance characteristics", () => {
    it("should complete update operations quickly", () => {
      const iterations = 1000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        time.update();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 1000 updates in reasonable time (less than 10ms)
      expect(totalTime).toBeLessThan(10);
    });

    it("should maintain precision over many updates", () => {
      const mockStartTime = 1000;
      let currentMockTime = mockStartTime;

      vi.spyOn(performance, "now").mockImplementation(() => {
        const time = currentMockTime;
        currentMockTime += 16.67; // Add 16.67ms each call
        return time;
      });

      const testTime = new Time();
      let totalAccumulated = 0;

      // Perform 100 updates
      for (let i = 0; i < 100; i++) {
        testTime.update();
        totalAccumulated += testTime.deltaTime;
      }

      // Should accumulate ~1.667 seconds (100 * 16.67ms)
      expect(totalAccumulated).toBeCloseTo(1.667, 2);

      vi.restoreAllMocks();
    });
  });

  describe("integration scenarios", () => {
    it("should work correctly in a typical game loop pattern", () => {
      const mockFrameTimes = [1000, 1016.67, 1033.34, 1050.01]; // 60 FPS frames
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return (
          mockFrameTimes[callCount++] ||
          mockFrameTimes[mockFrameTimes.length - 1]
        );
      });

      const testTime = new Time();
      const frameDeltas: number[] = [];

      // Simulate 3 frame updates
      for (let i = 0; i < 3; i++) {
        testTime.update();
        frameDeltas.push(testTime.deltaTime);
      }

      // All frames should be ~16.67ms
      frameDeltas.forEach((delta) => {
        expect(delta).toBeCloseTo(0.01667, 4);
      });

      vi.restoreAllMocks();
    });

    it("should support pause/resume scenarios", () => {
      const mockTimes = [1000, 1016.67, 5000, 5016.67]; // Long pause then resume
      let callCount = 0;

      vi.spyOn(performance, "now").mockImplementation(() => {
        return mockTimes[callCount++] || mockTimes[mockTimes.length - 1];
      });

      const testTime = new Time();

      // Normal frame
      testTime.update();
      const normalDelta = testTime.deltaTime;

      // After pause (large delta time)
      testTime.update();
      const pauseDelta = testTime.deltaTime;

      // Resume normal
      testTime.update();
      const resumeDelta = testTime.deltaTime;

      expect(normalDelta).toBeCloseTo(0.01667, 4);
      expect(pauseDelta).toBeCloseTo(3.98333, 4); // ~4 seconds
      expect(resumeDelta).toBeCloseTo(0.01667, 4);

      vi.restoreAllMocks();
    });
  });
});

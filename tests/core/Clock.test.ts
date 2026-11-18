import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualClock, realClock } from "@/core/Clock";
import { createManualTime } from "../utils/testHelpers";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("realClock", () => {
  it("reads performance.now for monotonic time and Date.now for wall time", () => {
    vi.spyOn(performance, "now").mockReturnValue(12.5);
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    expect(realClock.monotonic()).toBe(12.5);
    expect(realClock.now()).toBe(1_700_000_000_000);
  });
});

describe("ManualClock", () => {
  it("starts at the given wall time and moves both readings together", () => {
    const clock = new ManualClock(1_700_000_000_000);
    expect(clock.monotonic()).toBe(0);
    expect(clock.now()).toBe(1_700_000_000_000);
    clock.advance(250);
    clock.advance(0);
    expect(clock.monotonic()).toBe(250);
    expect(clock.now()).toBe(1_700_000_000_250);
  });

  it("rejects going backwards and non-finite values", () => {
    const clock = new ManualClock();
    expect(() => clock.advance(-1)).toThrow(/at least 0, got -1/);
    expect(() => clock.advance(Number.NaN)).toThrow(RangeError);
    expect(() => clock.advance(Infinity)).toThrow(RangeError);
    expect(() => new ManualClock(Number.NaN)).toThrow(/finite epoch milliseconds/);
    expect(clock.monotonic()).toBe(0);
  });
});

describe("Time on a manual clock", () => {
  it("measures delta in seconds and clamps it", () => {
    const { time, clock } = createManualTime();
    clock.advance(50);
    time.update();
    expect(time.delta).toBe(0.05);
    expect(time.accumulator).toBe(0.05);

    clock.advance(1_000);
    time.update(0.25);
    expect(time.delta).toBe(0.25);
    expect(time.accumulator).toBe(0.3);
  });

  it("does not count pauses toward elapsed or the next delta", () => {
    const { time, clock } = createManualTime();
    clock.advance(1_000);
    time.update();
    time.pause();
    clock.advance(5_000);
    expect(time.elapsed).toBe(1);
    time.resume();
    expect(time.elapsed).toBe(1);
    clock.advance(500);
    time.update();
    expect(time.delta).toBe(0.5);
    expect(time.elapsed).toBe(1.5);
  });

  it("restarts delta, elapsed and the accumulator on reset", () => {
    const { time, clock } = createManualTime();
    clock.advance(2_000);
    time.update();
    time.pause();
    time.reset();
    expect(time.delta).toBe(0);
    expect(time.accumulator).toBe(0);
    expect(time.elapsed).toBe(0);
    clock.advance(100);
    expect(time.elapsed).toBe(0.1);
  });

  it("reads wall-clock milliseconds from the clock, also while paused", () => {
    const { time, clock } = createManualTime(1_700_000_000_000);
    expect(time.now()).toBe(1_700_000_000_000);
    time.pause();
    clock.advance(1_500);
    expect(time.now()).toBe(1_700_000_001_500);
  });

  it("never reads performance.now or Date.now", () => {
    const perf = vi.spyOn(performance, "now");
    const date = vi.spyOn(Date, "now");
    const { time, clock } = createManualTime(5);
    clock.advance(16);
    time.update(0.25);
    time.pause();
    time.resume();
    void time.elapsed;
    time.now();
    time.reset();
    expect(perf).not.toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
  });
});

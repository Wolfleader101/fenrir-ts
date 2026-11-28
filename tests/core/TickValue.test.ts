import { describe, expect, it } from "vitest";
import { createTestGame } from "@/core/TestGame";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { tickValue } from "@/core/TickValue";

const logger = new NullLogger();

/**
 * A test game whose Tick moves a value by one per tick, drawn in Update. Returns, per frame, the
 * frame's end time, ticks, tick fraction and drawn value.
 */
async function drawRamp(fixedDelta: number, dt: number, frames: number, maxTicksPerFrame = 8) {
  const game = await createTestGame({ seed: 1, logger, fixedDelta, maxTicksPerFrame });
  const ramp = tickValue(0);
  const drawn: Array<{ t: number; ticks: number; fraction: number; value: number }> = [];
  let frame = 0;
  game
    .addSystem(Schedule.Tick, function move({ time }) { ramp.set(time, ramp.current + 1); })
    .addSystem(Schedule.Update, function draw({ time }) {
      frame++;
      drawn.push({ t: frame * dt, ticks: time.ticks, fraction: time.tickFraction, value: ramp.blend(time) });
    });
  await game.start();
  game.step(dt, frames);
  await game.stop();
  return drawn;
}

describe("time.ticks and time.tickFraction", () => {
  it("counts ticks begun, numbering the running tick inside Tick, and resets each run", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const inTick: number[] = [];
    let inUpdate = -1;
    game
      .addSystem(Schedule.Tick, function count({ time }) { inTick.push(time.ticks); })
      .addSystem(Schedule.Update, function read({ time }) { inUpdate = time.ticks; });
    await game.start();
    game.step(1 / 20);
    expect(inTick).toEqual([1, 2, 3]);
    expect(inUpdate).toBe(3);
    game.step(1 / 120);
    expect(inUpdate).toBe(3);
    await game.stop();
    await game.start();
    game.step(1 / 60);
    expect(inUpdate).toBe(1);
    await game.stop();
  });

  it("is accumulator / fixedDelta after the frame's ticks, in [0, 1)", async () => {
    const drawn = await drawRamp(1 / 120, 1 / 144, 144);
    for (const { t, ticks, fraction } of drawn) {
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThan(1);
      expect(ticks + fraction).toBeCloseTo(t * 120, 9);
    }
  });
});

describe("tickValue", () => {
  it("moves every frame at 144 Hz against a 120 Hz tick, on the exact linear blend", async () => {
    const drawn = await drawRamp(1 / 120, 1 / 144, 144);
    // Before the first tick nothing was set: the initial value. After it, the ramp drawn between
    // ticks n - 1 and n at fraction f is n - 1 + f, which is t * 120 - 1.
    expect(drawn[0]).toMatchObject({ ticks: 0, value: 0 });
    const ticked = drawn.filter(({ ticks }) => ticks > 0);
    expect(ticked.length).toBe(143);
    for (const { t, ticks, fraction, value } of ticked) {
      expect(value).toBeCloseTo(ticks - 1 + fraction, 9);
      expect(value).toBeCloseTo(t * 120 - 1, 9);
    }
    // Every frame draws a new value, including the frames that run no tick.
    const tickless = ticked.filter((frame, i) => i > 0 && frame.ticks === ticked[i - 1]!.ticks);
    expect(tickless.length).toBeGreaterThan(20);
    for (let i = 1; i < ticked.length; i++) expect(ticked[i]!.value).toBeGreaterThan(ticked[i - 1]!.value);
  });

  it("blends from the second-to-last tick in a frame that runs several", async () => {
    // Frames of 4.25 ticks against a 1/120 tick: four or five ticks a frame. The drawn value is
    // between the frame's last two ticks, not between its first and its last.
    const drawn = await drawRamp(1 / 120, 1 / 30 + 1 / 480, 10);
    for (const { ticks, fraction, value } of drawn) {
      expect(value).toBeCloseTo(ticks - 1 + fraction, 9);
    }
    expect(drawn.at(-1)!.ticks).toBeGreaterThanOrEqual(40);
  });

  it("stops moving when the latest tick left it alone, and holds a set value through tickless frames", async () => {
    const game = await createTestGame({ seed: 1, logger, fixedDelta: 1 / 60 });
    const level = tickValue(0);
    const drawn: number[] = [];
    game
      .addSystem(Schedule.Tick, function fill({ time }) { if (time.ticks <= 2) level.set(time, time.ticks * 10); })
      .addSystem(Schedule.Update, function draw({ time }) { drawn.push(level.blend(time)); });
    await game.start();
    game.step(1 / 60);       // tick 1 sets 10: fraction 0, draws 0
    game.step(1 / 240);      // no tick: a quarter of the way from 0 to 10
    game.step(1 / 240);
    game.step(1 / 120);      // tick 2 sets 20: fraction 0, draws 10
    game.step(1 / 60);       // tick 3 leaves it: draws 20
    game.step(1 / 120);      // no tick: still 20
    await game.stop();
    expect(drawn.map((value) => Number(value.toFixed(9)))).toEqual([0, 2.5, 5, 10, 20, 20]);
  });

  it("blends from the value before a tick's first set when it sets several times", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const sag = tickValue(1);
    let drawn = 0;
    game
      .addSystem(Schedule.Tick, function settle({ time }) { sag.set(time, 2); sag.set(time, 3); })
      .addSystem(Schedule.Update, function draw({ time }) { drawn = sag.blend(time); });
    await game.start();
    game.step(1 / 60 + 1 / 120);
    expect(drawn).toBeCloseTo(2, 9); // halfway from 1 to 3
    await game.stop();
  });

  it("jumps with snap from any stage, with no blend from the old value", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const offset = tickValue(0);
    const drawn: number[] = [];
    let teleport = false;
    game
      .addSystem(Schedule.PreUpdate, function reset() { if (teleport) offset.snap(100); })
      .addSystem(Schedule.Tick, function drift({ time }) { offset.set(time, offset.current + 1); })
      .addSystem(Schedule.Update, function draw({ time }) { drawn.push(offset.blend(time)); });
    await game.start();
    game.step(1 / 60 + 1 / 120);  // tick 1: 0 to 1, halfway
    teleport = true;
    game.step(1 / 240);           // snapped in PreUpdate, no tick: 100
    game.step(1 / 240);           // snapped again, a tick: 100 to 101 at fraction 0
    await game.stop();
    expect(drawn.map((value) => Number(value.toFixed(9)))).toEqual([0.5, 100, 100]);
    expect(offset.current).toBe(101);
  });

  it("starts at its initial value, 0 by default", () => {
    expect(tickValue().current).toBe(0);
    expect(tickValue(3).blend({ ticks: 0, tickFraction: 0.5 })).toBe(3);
  });
});

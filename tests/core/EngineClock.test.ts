import { AssetStore } from "@/core/Assets/AssetStore";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Engine } from "@/core/Engine";
import { EventBus } from "@/core/EventBus";
import { SceneManager } from "@/core/SceneManager";
import { Schedule, Scheduler } from "@/core/Scheduler";
import { ManualClock } from "@/core/Clock";
import { Random } from "@/core/Random";
import { Resources } from "@/core/Resource";
import { GameStates } from "@/core/State";
import { InputImpl } from "@/core/Input/Input";
import { NullLogger } from "@/core/NullLogger";
import type { SystemCtx } from "@/core/SystemCtx";

function stubFrames() {
  let callback: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", vi.fn((next: FrameRequestCallback) => ((callback = next), 1)));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  return () => callback!(0);
}

function engineOn(clock: ManualClock, seed: number) {
  return new Engine({
    scheduler: new Scheduler(),
    events: new EventBus(),
    sceneManager: new SceneManager(new NullLogger()),
    logger: new NullLogger(),
    clock,
    services: { resources: new Resources(), random: new Random(seed), states: new GameStates(), input: new InputImpl(new Resources()), assets: new AssetStore() },
  });
}

type FrameRecord = { delta: number; elapsed: number; now: number; ticks: number; roll: number; pick: string };

/** Runs `frames` frames of varying length and records what systems saw in each. */
async function record(seed: number, frames: number): Promise<FrameRecord[]> {
  const frame = stubFrames();
  const clock = new ManualClock(1_700_000_000_000);
  const engine = engineOn(clock, seed);
  const records: FrameRecord[] = [];
  let ticks = 0;
  engine
    .addSystem(Schedule.Tick, function countTick() { ticks++; })
    .addSystem(Schedule.Update, function recordFrame({ time, random }: SystemCtx) {
      records.push({
        delta: time.delta,
        elapsed: time.elapsed,
        now: time.now(),
        ticks,
        roll: random.int(1, 6),
        pick: random.pick(["slime", "bat", "ghost"]),
      });
    });

  await engine.run();
  for (let i = 0; i < frames; i++) {
    clock.advance(10 + (i % 3) * 7);
    frame();
  }
  await engine.stop();
  return records;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Engine with an injected clock and seed", () => {
  it("reads neither performance.now nor Date.now across a run of several frames", async () => {
    const perf = vi.spyOn(performance, "now");
    const date = vi.spyOn(Date, "now");
    const records = await record(1, 12);
    expect(records).toHaveLength(12);
    expect(perf).not.toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
  });

  it("produces identical frames on two runs with the same clock and seed", async () => {
    const first = await record(99, 30);
    const second = await record(99, 30);
    expect(second).toEqual(first);
    expect(first[0]).toMatchObject({ delta: 0.01, now: 1_700_000_000_010 });
    expect(first.at(-1)!.ticks).toBeGreaterThan(0);
  });

  it("draws different values with a different seed", async () => {
    const rolls = (records: FrameRecord[]) => records.map((r) => `${r.roll}${r.pick}`);
    expect(rolls(await record(1, 30))).not.toEqual(rolls(await record(2, 30)));
  });

  it("seeds its own random from the clock when given no services", async () => {
    const engine = new Engine({
      scheduler: new Scheduler(),
      events: new EventBus(),
      sceneManager: new SceneManager(new NullLogger()),
      clock: new ManualClock(2 ** 32 + 77),
    });
    stubFrames();
    let seed = -1;
    engine.addSystem(Schedule.Init, function readSeed({ random }: SystemCtx) { seed = random.seed; });
    await engine.run();
    await engine.stop();
    expect(seed).toBe(77);
  });
});

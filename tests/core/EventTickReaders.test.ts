import { describe, expect, it } from "vitest";
import { createTestGame } from "@/core/TestGame";
import { defineEvent } from "@/core/EventQueue";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";

const logger = new NullLogger();
const Launched = defineEvent<number>("test.tickReaders.launched");

/** Sends one event in PreUpdate on the first frame, reads it in Tick, steps `frames` frames of `dt`. */
async function readInTick(dt: number, frames = 12, fixedDelta = 1 / 60) {
  const game = await createTestGame({ seed: 1, logger });
  const reader = game.events.createReader(Launched);
  const seen: Array<{ frame: number; value: number }> = [];
  let frame = 0;
  game
    .addSystem(Schedule.Init, function rate({ time }) { time.fixedDelta = fixedDelta; })
    .addSystem(Schedule.PreUpdate, function send({ events }) {
      frame++;
      if (frame === 1) events.send(Launched, 7);
    })
    .addSystem(Schedule.Tick, function read() {
      for (const value of reader.read()) seen.push({ frame, value });
    });
  await game.start();
  game.step(dt, frames);
  await game.stop();
  return seen;
}

describe("event readers in Tick", () => {
  // dt = fixedDelta / (n + 1) runs n tickless frames before the first tick.
  it.each([
    [0, 1 / 60],
    [1, 1 / 120],
    [2, 1 / 180],
    [3, 1 / 240],
    [5, 1 / 360],
  ])("reads an event sent in PreUpdate once after %i tickless frames", async (tickless, dt) => {
    const seen = await readInTick(dt);
    expect(seen).toEqual([{ frame: tickless + 1, value: 7 }]);
  });

  it("reads an event once in a frame that runs several ticks", async () => {
    const seen = await readInTick(1 / 20, 3);
    expect(seen).toEqual([{ frame: 1, value: 7 }]);
  });

  it("keeps an event sent in Update or in the last Tick of a frame for the next frame's first tick", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const reader = game.events.createReader(Launched);
    const seen: Array<[number, number]> = [];
    let frame = 0;
    let ticksThisFrame = 0;
    game
      .addSystem(Schedule.PreUpdate, function count() { frame++; ticksThisFrame = 0; })
      .addSystem(Schedule.Tick, function read() {
        ticksThisFrame++;
        for (const value of reader.read()) seen.push([frame, value]);
      })
      .addSystem(Schedule.Tick, function sendFromTick({ events }) {
        if (frame === 1) events.send(Launched, 1);
      }, { after: "read" })
      .addSystem(Schedule.Update, function sendFromUpdate({ events }) {
        if (frame === 1) events.send(Launched, 2);
      });
    await game.start();
    game.step(1 / 60);       // tick 1: reads nothing, sends 1; Update sends 2
    game.step(1 / 240, 3);   // three tickless frames
    game.step(1 / 240);      // the next tick reads both
    await game.stop();
    expect(seen).toEqual([[5, 1], [5, 2]]);
    expect(ticksThisFrame).toBe(1);
  });

  it("leaves per-frame readers and events.read with two frames of events", async () => {
    const game = await createTestGame({ seed: 1, logger });
    const late = game.events.createReader(Launched);
    let frame = 0;
    let buffered: readonly number[] = [];
    let lateRead: readonly number[] = [];
    game
      .addSystem(Schedule.PreUpdate, function send({ events }) {
        frame++;
        if (frame === 1) events.send(Launched, 7);
      })
      .addSystem(Schedule.Update, function look({ events }) {
        buffered = [...events.read(Launched)];
        // A per-frame reader that waits three frames finds the event gone, as before.
        if (frame === 3) lateRead = [...late.read()];
      });
    await game.start();
    game.step(1 / 240, 2);
    expect(buffered).toEqual([7]);
    game.step(1 / 240);
    expect(buffered).toEqual([]);
    expect(lateRead).toEqual([]);
    await game.stop();
  });

  it("drops events once a tick has run after them and two frames have passed", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let frame = 0;
    game.addSystem(Schedule.PreUpdate, function send({ events }) {
      frame++;
      events.send(Launched, frame);
    });
    await game.start();
    game.step(1 / 240, 400);
    // 400 frames at 240 Hz against a 60 Hz tick: never more than a tick period plus two frames kept.
    const queue = (game.events as unknown as { queues: Map<symbol, { events: number[] }> }).queues.get(Launched)!;
    expect(queue.events.length).toBeLessThanOrEqual(6);
    await game.stop();
  });
});

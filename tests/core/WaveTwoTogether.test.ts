import { afterEach, expect, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import { defineEvent } from "@/core/EventQueue";
import { NullLogger } from "@/core/NullLogger";
import { Random } from "@/core/Random";
import { defineResource } from "@/core/Resource";
import { Schedule } from "@/core/Scheduler";
import { defineState } from "@/core/State";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Resources, states, clock and random, and immediate events in one game.
it("an enter hook reads a resource, rolls ctx.random, reads ctx.time and sends an event a listener handles", async () => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000); // what the real clock's time.now() reads
  const Level = defineResource("test.together.Level", () => ({ number: 3 }));
  const Phase = defineState("test.together.Phase", { values: ["menu", "playing"], initial: "menu" });
  const Started = defineEvent<{ level: number; roll: number; now: number }>("test.together.started");

  const game = await createGame({ canvas: document.createElement("canvas"), logger: new NullLogger(), seed: 7 });
  const heard: Array<{ level: number; roll: number; now: number; phase: string }> = [];
  game.on(Started, (payload, ctx) => void heard.push({ ...payload, phase: ctx.states.get(Phase) }));
  game.onEnter(Phase, "playing", ({ resources, random, time, events }) => {
    events.send(Started, { level: resources.get(Level).number, roll: random.int(1, 6), now: time.now() });
  });
  game.addSystem(Schedule.Init, function startPlaying({ states }) {
    states.set(Phase, "playing");
  });

  await game.run();
  await game.stop();

  expect(heard).toEqual([{ level: 3, roll: new Random(7).int(1, 6), now: 1_700_000_000_000, phase: "playing" }]);
});

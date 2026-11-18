import { expect, it } from "vitest";
import { createTestGame } from "@/core/TestGame";
import { defineEvent } from "@/core/EventQueue";
import { NullLogger } from "@/core/NullLogger";
import { Random } from "@/core/Random";
import { defineResource } from "@/core/Resource";
import { Schedule } from "@/core/Scheduler";
import { defineState } from "@/core/State";

// Resources, states, clock and random, and immediate events in one game.
it("an enter hook reads a resource, rolls ctx.random, reads ctx.time and sends an event a listener handles", async () => {
  const Level = defineResource("test.together.Level", () => ({ number: 3 }));
  const Phase = defineState("test.together.Phase", { values: ["menu", "playing"], initial: "menu" });
  const Started = defineEvent<{ level: number; roll: number; now: number }>("test.together.started");

  const game = await createTestGame({ seed: 7, now: 1_700_000_000_000, logger: new NullLogger() });
  const heard: Array<{ level: number; roll: number; now: number; phase: string }> = [];
  game.on(Started, (payload, ctx) => void heard.push({ ...payload, phase: ctx.states.get(Phase) }));
  game.onEnter(Phase, "playing", ({ resources, random, time, events }) => {
    events.send(Started, { level: resources.get(Level).number, roll: random.int(1, 6), now: time.now() });
  });
  game.addSystem(Schedule.Init, function startPlaying({ states }) {
    states.set(Phase, "playing");
  });

  await game.start();
  await game.stop();

  expect(heard).toEqual([{ level: 3, roll: new Random(7).int(1, 6), now: 1_700_000_000_000, phase: "playing" }]);
});

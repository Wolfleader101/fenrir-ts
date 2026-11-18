import { describe, expect, it } from "vitest";
import { createTestGame } from "@/core/TestGame";
import type { TestGame } from "@/core/TestGame";
import { defineComponent } from "@/core/ECS/Component";
import { defineEvent } from "@/core/EventQueue";
import { NullLogger } from "@/core/NullLogger";
import { Random } from "@/core/Random";
import { defineResource } from "@/core/Resource";
import { Schedule } from "@/core/Scheduler";
import { defineState, inState } from "@/core/State";
import type { SystemCtx } from "@/core/SystemCtx";

// A small fishing game written as it would be for the browser: states, a resource, a
// component, an event with a reader and a listener, random draws and fixed ticks.
const FISH = ["trout", "pike", "carp", "eel"] as const;
type Fish = (typeof FISH)[number];

const Phase = defineState("accept.Phase", { values: ["waiting", "casting", "over"], initial: "waiting" });
const Round = defineResource("accept.Round", () => ({ ticksInCast: 0, ticks: 0, frames: 0, catches: [] as Fish[], endedAt: 0, tension: 0 }));
const Line = defineComponent<{ tension: number }>("accept.Line");
const Caught = defineEvent<{ fish: Fish; weight: number }>("accept.caught");
const LINE_QUERY = [Line] as const;
const CATCHES_TO_WIN = 5;

async function fishingGame(seed: number): Promise<{ game: TestGame; heard: string[] }> {
  const game = await createTestGame({ seed, now: 1_700_000_000_000, logger: new NullLogger() });
  const caught = game.events.createReader(Caught);
  const heard: string[] = [];
  game.on(Caught, ({ fish }) => void heard.push(fish));

  function castLine({ entities, states }: SystemCtx): void {
    entities.set(entities.createEntity(), Line, { tension: 0 });
    states.set(Phase, "casting");
  }
  // One second of ticks per cast, then a bite.
  function reel({ resources, random, events, entities }: SystemCtx): void {
    const round = resources.get(Round);
    round.ticks++;
    entities.each(LINE_QUERY, (_entity, line) => { line.tension++; });
    if (++round.ticksInCast < 60) return;
    round.ticksInCast = 0;
    events.send(Caught, { fish: random.pick(FISH), weight: random.int(1, 10) });
  }
  function land({ resources, states, entities }: SystemCtx): void {
    const round = resources.get(Round);
    round.frames++;
    entities.each(LINE_QUERY, (_entity, line) => { round.tension = line.tension; });
    for (const { fish } of caught.read()) round.catches.push(fish);
    if (round.catches.length >= CATCHES_TO_WIN) states.set(Phase, "over");
  }

  game
    .onEnter(Phase, "over", ({ resources, time }) => { resources.get(Round).endedAt = time.now(); })
    .addSystem(Schedule.PostInit, castLine)
    .addSystem(Schedule.Tick, reel, { runIf: inState(Phase, "casting") })
    .addSystem(Schedule.Update, land);
  return { game, heard };
}

describe("a full game under createTestGame", () => {
  it("runs 600 frames with no canvas and ends in the expected state", async () => {
    const { game, heard } = await fishingGame(7);
    await game.start();
    expect(game.states.get(Phase)).toBe("casting");

    game.step(1 / 60, 600);

    // Five bites, one every 60 ticks: the fifth lands in frame 300, and ticking stops there.
    const replay = new Random(7);
    const expected = Array.from({ length: CATCHES_TO_WIN }, () => {
      const fish = replay.pick(FISH);
      replay.int(1, 10);
      return fish;
    });
    const round = game.resources.get(Round);
    expect(round.catches).toEqual(expected);
    expect(heard).toEqual(expected);
    expect(round).toMatchObject({ ticks: 300, frames: 600, tension: 300 });
    expect(round.endedAt).toBeCloseTo(1_700_000_000_000 + 5_000, 6);
    expect(game.states.get(Phase)).toBe("over");
    expect(game.states.timeIn(Phase)).toBeCloseTo(5, 9);

    await game.stop();
  });

  it("ends identically for the same seed and steps, and differently for another seed", async () => {
    const play = async (seed: number) => {
      const { game } = await fishingGame(seed);
      await game.start();
      for (const dt of [1 / 60, 1 / 30, 0.01, 0.2]) game.step(dt, 150);
      const end = { ...game.resources.get(Round), phase: game.states.get(Phase), next: game.random.next() };
      await game.stop();
      return end;
    };
    const first = await play(42);
    expect(await play(42)).toEqual(first);
    expect(await play(43)).not.toEqual(first);
  });
});

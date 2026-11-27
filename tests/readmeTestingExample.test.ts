// The "Testing a game" example from skills/fenrir/references/testing.md, run as written. Change both together.
import { Schedule, createTestGame, defineResource, defineState, inState } from "@/index";
import type { SystemCtx } from "@/index";
import { expect, it } from "vitest";

const Phase = defineState("myGame.Phase", { values: ["waiting", "casting", "landed"], initial: "waiting" });
const Line = defineResource("myGame.Line", () => ({ ticks: 0 }));

// The same system the browser game registers: one second of fixed ticks lands the fish.
function reel({ resources, states }: SystemCtx): void {
  if (++resources.get(Line).ticks >= 60) states.set(Phase, "landed");
}

it("lands the fish after one second of casting", async () => {
  const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
  game.addSystem(Schedule.Tick, reel, { runIf: inState(Phase, "casting") });
  await game.start(); // runs PreInit, Init and PostInit; schedules no frame

  game.states.set(Phase, "casting");
  game.step(1 / 60, 59); // fifty-nine frames, one tick each
  expect(game.states.get(Phase)).toBe("casting");
  game.step(1 / 60); // one more frame
  expect(game.states.get(Phase)).toBe("landed");

  game.clock.advance(5_000); // moves time.now() without running a frame
  await game.stop(); // runs Exit systems and cleanups
});

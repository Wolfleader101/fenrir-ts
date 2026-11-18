import { afterEach, describe, expect, it, vi } from "vitest";
import { createGame } from "@/core/Game";
import { NullLogger } from "@/core/NullLogger";
import { Random } from "@/core/Random";
import { Schedule } from "@/core/Scheduler";
import type { SystemCtx } from "@/core/SystemCtx";

const canvas = () => document.createElement("canvas");
const logger = new NullLogger();

function stubFrames() {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createGame({ seed })", () => {
  it("gives game.random and ctx.random as one seeded source", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger, seed: 1234 });
    let fromCtx: Random | undefined;
    game.addSystem(Schedule.Init, function grab({ random }: SystemCtx) { fromCtx = random; });
    await game.run();
    expect(fromCtx).toBe(game.random);
    expect(game.random).toBeInstanceOf(Random);
    expect(game.random.seed).toBe(1234);
    await game.stop();
  });

  it("gives two games with the same seed the same sequence, and other seeds another", async () => {
    const sequence = async (seed: number) => {
      const game = await createGame({ canvas: canvas(), logger, seed });
      return Array.from({ length: 20 }, () => game.random.int(0, 1_000));
    };
    expect(await sequence(5)).toEqual(await sequence(5));
    expect(await sequence(5)).not.toEqual(await sequence(6));
  });

  it("seeds from the clock without a seed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2 ** 32 * 3 + 4_242);
    const game = await createGame({ canvas: canvas(), logger });
    expect(game.random.seed).toBe(4_242);
  });

  it("rejects a seed that is not a safe integer", async () => {
    await expect(createGame({ canvas: canvas(), logger, seed: 0.5 })).rejects.toThrow(/safe integer, got 0.5/);
  });

  it("continues the sequence when stopped and run again", async () => {
    stubFrames();
    const game = await createGame({ canvas: canvas(), logger, seed: 8 });
    const drawn: number[] = [];
    game.addSystem(Schedule.Init, function draw({ random }: SystemCtx) { drawn.push(random.next()); });
    await game.run();
    await game.stop();
    await game.run();
    await game.stop();

    const reference = new Random(8);
    expect(drawn).toEqual([reference.next(), reference.next()]);
  });
});

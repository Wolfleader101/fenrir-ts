// Headless tests: the gameplay from src/game.ts on a test game, with no canvas or renderer.
// Frames run only on game.step(), so every run is exact and repeatable.
import { createTestGame, inspect, type GameSnapshot } from "fenrir-ts";
import { describe, expect, it } from "vitest";
import { CATCH_RADIUS, Phase, ROUND_SECONDS, Score, Tap, addGameplay } from "../src/game";

/** The star's position, read from inspect() by the name the gameplay gave it. */
function starAt(snapshot: GameSnapshot): { x: number; y: number } {
  const star = snapshot.entities.find((entity) => entity.name === "game.star");
  if (!star) throw new Error("no star in inspect(game).entities");
  return star.components["fenrir.Transform2D"] as { x: number; y: number };
}

async function startedGame() {
  const game = await createTestGame({ seed: 1 });
  addGameplay(game);
  await game.start();
  return game;
}

/** A tap at (x, y): pressed in one frame, released in the next. */
function tap(game: Awaited<ReturnType<typeof startedGame>>, x: number, y: number): void {
  game.input.pointerDown(x, y);
  game.step();
  game.input.pointerUp();
  game.step();
}

describe("the game", () => {
  it("waits for a tap, then starts without counting that tap", async () => {
    const game = await startedGame();
    game.step();
    expect(inspect(game).states["game.Phase"]?.value).toBe("ready");

    const { x, y } = starAt(inspect(game));
    tap(game, x, y); // right on the star: it starts the round, and catches nothing
    expect(game.states.get(Phase)).toBe("playing");
    expect(game.resources.get(Score).points).toBe(0);
    await game.stop();
  });

  it("counts taps on the star and ignores taps that miss", async () => {
    const game = await startedGame();
    tap(game, 0, 0);

    const star = starAt(inspect(game));
    tap(game, star.x, star.y);
    expect(game.resources.get(Score).points).toBe(1);

    const now = starAt(inspect(game));
    tap(game, now.x, now.y + CATCH_RADIUS * 3); // well below it
    expect(game.resources.get(Score).points).toBe(1);
    await game.stop();
  });

  it("moves the star while playing and keeps it on screen", async () => {
    const game = await startedGame();
    const before = starAt(inspect(game)).x;
    tap(game, 0, 0);
    game.step(1 / 60, 30);
    expect(starAt(inspect(game)).x).not.toBe(before);

    for (let frame = 0; frame < 600; frame++) {
      game.step();
      const { x } = starAt(inspect(game));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(390);
    }
    await game.stop();
  });

  it("ends the round when time runs out, and a tap starts a new one", async () => {
    const game = await startedGame();
    game.input.press(Tap);
    game.step();
    game.input.release(Tap);
    game.step(1 / 60, ROUND_SECONDS * 60);
    expect(inspect(game).states["game.Phase"]?.value).toBe("over");

    tap(game, 0, 0);
    expect(game.states.get(Phase)).toBe("playing");
    expect(game.resources.get(Score).timeLeft).toBeGreaterThan(ROUND_SECONDS - 0.1);
    await game.stop();
  });
});

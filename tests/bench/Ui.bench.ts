// Benchmarks for the UI kit's display-tree walk. Run with `pnpm bench`.
// Not part of `pnpm test:run` or CI: numbers depend on the machine, so nothing here asserts on
// them. Compare runs on the same machine before and after a change.
import { bench, describe } from "vitest";
import { Container, Graphics } from "pixi.js";
import { createTestGame, defineAction } from "@/index";
import { NullLogger } from "@/core/NullLogger";
import { control, ui } from "@/ui";

const Tab = defineAction("bench.tab", ["Tab"]);

/** A HUD of 3000 nodes: 60 rows of 49 decorations and one control each. */
async function hud() {
  const root = new Container();
  for (let row = 0; row < 60; row++) {
    const line = root.addChild(new Container());
    for (let i = 0; i < 49; i++) line.addChild(new Container());
    control(line.addChild(new Graphics().rect(0, 0, 10, 10).fill(0)), { id: `bench.${row}`, label: `Row ${row}` });
  }
  const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [ui({ root })] });
  await game.start();
  return game;
}

const idle = await hud();
const typing = await hud();

describe("ui kit, 3000 nodes", () => {
  bench("a frame with no input", () => {
    idle.step();
  });

  bench("a frame with a key press", () => {
    typing.input.press(Tab);
    typing.input.release(Tab);
    typing.step();
  });
});

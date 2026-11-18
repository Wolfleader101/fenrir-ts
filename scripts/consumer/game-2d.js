// A minimal 2D Pixi game: boots the documented way, createGame with the pixi2d
// plugin, and imports nothing else from fenrir-ts and fenrir-ts/2d. Bundled, never run.
import { Schedule, createGame, defineEvent } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const Scored = defineEvent("fixture.scored");

const canvas = document.querySelector("canvas");
const game = await createGame({ canvas, plugins: [pixi2d()] });
const scored = game.events.createReader(Scored);

game
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  }, { after: "score" });

await game.run();

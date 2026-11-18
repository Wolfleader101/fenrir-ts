// A game loop that imports only the core entry, fenrir-ts. Bundled, never run.
import { Schedule, createGame, defineEvent } from "fenrir-ts";

const Scored = defineEvent("fixture.scored");

const game = await createGame({ canvas: document.querySelector("canvas") });
const scored = game.events.createReader(Scored);

game
  .addSystem(Schedule.Exit, function clearAssets() {
    game.assets.clear();
  })
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  });

await game.run();

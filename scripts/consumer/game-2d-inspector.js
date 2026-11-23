// game-2d.js plus the inspector() plugin with window.__FENRIR__, as a debug build or a
// browser-tested build ships it. Its size minus game-2d's is what inspect() costs a game.
// Bundled, never run.
import { EntityBuilder, Schedule, createGame, defineEvent, inspector } from "fenrir-ts";
import { Transform2D, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const Scored = defineEvent("fixture.scored");

const canvas = document.querySelector("canvas");
const game = await createGame({ canvas, plugins: [pixi2d({ layers: ["world", "ui"] }), inspector({ global: true })] });
const scored = game.events.createReader(Scored);
const MOVING = [Transform2D];

game
  .addSystem(Schedule.Init, function spawn({ entities }) {
    const ball = new Graphics().circle(0, 0, 8).fill(0xffffff);
    EntityBuilder.create().transform2D(20, 20).display2D({ alpha: 0.8 }).pixiNode(ball, { layer: "world" }).spawn(entities);
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  }, { after: "score" });

await game.run();

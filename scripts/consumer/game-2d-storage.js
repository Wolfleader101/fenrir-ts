// game-2d.js plus storage: the storage() plugin, a setting read at startup, a best score
// with a parser, updated as the game scores, a key family and a resource field bound to a key. Its size minus game-2d's is what storage costs a
// game. Bundled, never run.
import {
  EntityBuilder,
  Schedule,
  createGame,
  defineEvent,
  defineResource,
  defineStorageKey,
  defineStorageKeyFamily,
  getStored,
  persistResource,
  storage,
  updateStored,
} from "fenrir-ts";
import { Transform2D, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const Scored = defineEvent("fixture.scored");
const Muted = defineStorageKey("fixture.muted", { default: false });
const Best = defineStorageKey("fixture.best", {
  default: { score: 0 },
  parse: (value) => (typeof value === "object" && value !== null && typeof value.score === "number" ? { score: value.score } : undefined),
});

const Plays = defineStorageKeyFamily("fixture.plays.", { default: 0 });
const Settings = defineResource("fixture.Settings", () => ({ hints: true }));
const Hints = defineStorageKey("fixture.hints", { default: true });

const canvas = document.querySelector("canvas");
const game = await createGame({ canvas, plugins: [storage(), pixi2d({ layers: ["world", "ui"] })] });
persistResource(game, Settings, "hints", Hints);
const scored = game.events.createReader(Scored);
const MOVING = [Transform2D];

game
  .addSystem(Schedule.Init, function spawn(ctx) {
    const ball = new Graphics().circle(0, 0, 8).fill(0xffffff);
    EntityBuilder.create().transform2D(20, 20).display2D({ alpha: getStored(ctx, Muted) ? 0.5 : 0.8 }).pixiNode(ball, { layer: "world" }).spawn(ctx.entities);
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore(ctx) {
    for (const { points } of scored.read()) {
      const best = updateStored(ctx, Best, ({ score }) => ({ score: score + points }));
      const plays = updateStored(ctx, Plays(String(points)), (n) => n + 1);
      ctx.logger.info("scored", { points, best: best.score, plays });
    }
  }, { after: "score" });

await game.run();

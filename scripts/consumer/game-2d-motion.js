// game-2d.js plus timers and tweens: the motion() plugin, a fade-in, a repeating bob in a
// pausable group and a timer. Its size minus game-2d's is what timers and tweens cost a game.
// Bundled, never run.
import { EntityBuilder, MotionSettings, Schedule, TimerFired, addTimer, addTween, createGame, defineEvent, motion } from "fenrir-ts";
import { Display2D, Transform2D, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const Scored = defineEvent("fixture.scored");

const canvas = document.querySelector("canvas");
const game = await createGame({ canvas, plugins: [motion(), pixi2d({ layers: ["world", "ui"] })] });
const scored = game.events.createReader(Scored);
const fired = game.events.createReader(TimerFired);
const MOVING = [Transform2D];

game
  .addSystem(Schedule.Init, function spawn(ctx) {
    const ball = new Graphics().circle(0, 0, 8).fill(0xffffff);
    const entity = EntityBuilder.create().transform2D(20, 20).display2D({ alpha: 0 }).pixiNode(ball, { layer: "world" }).spawn(ctx.entities);
    addTween(ctx, entity, Display2D, { to: { alpha: 1 }, duration: 0.3, ease: "quadOut" });
    addTween(ctx, entity, Transform2D, { to: { y: 28 }, duration: 1, repeat: Infinity, yoyo: true, ease: "sineInOut", group: "ambient" });
    addTimer(ctx, entity, "fixture.score", { duration: 2, repeat: Infinity });
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events, resources }) {
    for (const _ of fired.read()) events.send(Scored, { points: 1 });
    resources.get(MotionSettings).paused.ambient = document.hidden;
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  }, { after: "score" });

await game.run();

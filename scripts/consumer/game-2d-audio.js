// game-2d.js plus audio: the audio() plugin, a synthesized one-shot played on each score, a
// sample sound, looping music stopped with a fade at exit, and a mute toggle. Its size minus
// game-2d's is what audio costs a game. Bundled, never run.
import { EntityBuilder, Schedule, createGame, defineAction, defineEvent } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, stopSound } from "fenrir-ts/audio";
import { Transform2D, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const Scored = defineEvent("fixture.scored");
const Mute = defineAction("fixture.mute", ["KeyM"]);
const Blip = defineSound("fixture.blip", {
  synth: (context, output, { rate }) => {
    const osc = context.createOscillator();
    osc.frequency.value = 660 * rate;
    osc.connect(output);
    osc.start();
    osc.stop(context.currentTime + 0.1);
    return osc;
  },
});
const Splash = defineSound("fixture.splash", { sample: "splash", volume: 0.8 });
const Theme = defineSound("fixture.theme", { sample: "theme", bus: "music", loop: true });

const canvas = document.querySelector("canvas");
const game = await createGame({ canvas, plugins: [audio(), pixi2d({ layers: ["world", "ui"] })] });
const scored = game.events.createReader(Scored);
const MOVING = [Transform2D];

game
  .addSystem(Schedule.Init, function spawn(ctx) {
    const ball = new Graphics().circle(0, 0, 8).fill(0xffffff);
    EntityBuilder.create().transform2D(20, 20).display2D({ alpha: 0.8 }).pixiNode(ball, { layer: "world" }).spawn(ctx.entities);
    playSound(ctx, Theme);
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events, input, resources }) {
    events.send(Scored, { points: 1 });
    if (input.pressed(Mute)) resources.get(AudioState).muted = !resources.get(AudioState).muted;
  })
  .addSystem(Schedule.Update, function logScore(ctx) {
    for (const { points } of scored.read()) {
      playSound(ctx, points > 1 ? Splash : Blip, { rate: 0.9 + ctx.random.next() * 0.2 });
      ctx.logger.info("scored", { points });
    }
  }, { after: "score" })
  .addSystem(Schedule.Exit, function quiet(ctx) {
    stopSound(ctx, Theme, { fade: 0.5 });
  });

await game.run();

// The audio test example from skills/fenrir/references/audio.md, run as written. Change both together.
import { Schedule, createTestGame } from "@/index";
import { AudioState, audio, defineSound, playSound, testAudio, type Synth } from "@/audio";
import { expect, it } from "vitest";

const blip: Synth = (context, output) => {
  const osc = context.createOscillator();
  osc.connect(output);
  osc.start();
  return osc;
};
const Blip = defineSound("myGame.blip", { synth: blip, volume: 0.5 });

it("plays nothing until the first tap", async () => {
  const sounds = testAudio();
  const game = await createTestGame({ seed: 1, plugins: [audio({ backend: sounds })] });
  game.addSystem(Schedule.Update, (ctx) => void playSound(ctx, Blip, { rate: 2 }), { name: "myGame.blip" });
  await game.start();
  game.step();
  expect(game.resources.get(AudioState)).toMatchObject({ status: "locked", dropped: 1 });
  game.input.pointerDown(10, 10);
  game.step();
  expect(sounds.played).toMatchObject([{ sound: "myGame.blip", bus: "sfx", volume: 0.5, rate: 2 }]);
  await game.stop();
});

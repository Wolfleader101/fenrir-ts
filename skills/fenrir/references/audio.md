# Audio

The full rules for `fenrir-ts/audio`: sounds, buses, unlock and test audio. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Audio

Sounds come from `fenrir-ts/audio`, which needs no peer package (Web Audio only). Declare each sound once with `defineSound`, as a sample (an `audio` asset of a manifest, so it preloads in a bundle with progress) or a synth (a function that builds nodes on the `AudioContext`), and play it by its handle from systems. The `audio()` plugin starts output inside the first user gesture on the canvas, with no game code. A game that does not import `fenrir-ts/audio` ships none of this code.

```ts
import { Schedule, createGame, defineAction, defineAssets, defineStorageKey, loadAssets, persistResource, storage, type SystemCtx } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, stopSound, type Synth } from "fenrir-ts/audio";
import { pixi2d } from "fenrir-ts/2d";

const Sounds = defineAssets("myGame.sounds", {
  assets: { tap: { kind: "audio", src: "sfx/tap.mp3" }, theme: { kind: "audio", src: "music/theme.mp3" } },
  bundles: { boot: ["tap", "theme"] },
});

// A synthesized sound: two quick notes. It returns the source that ends last. Its parameters are
// typed: the sound gives every one, and each play may change some.
const coin: Synth<{ low: number; high: number }> = (context, output, { rate, params }) => {
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.frequency.setValueAtTime(params.low * rate, context.currentTime);
  osc.frequency.setValueAtTime(params.high * rate, context.currentTime + 0.06);
  env.gain.setValueAtTime(0.3, context.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
  osc.connect(env).connect(output);
  osc.start();
  osc.stop(context.currentTime + 0.3);
  return osc;
};

const Tap = defineSound("myGame.tap", { sample: "tap", volume: 0.8 });
const Coin = defineSound("myGame.coin", { synth: coin, params: { low: 988, high: 1319 }, limit: 3 });
const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true });
const Muted = defineStorageKey("myGame.muted", { default: false });
const ToggleMute = defineAction("myGame.toggleMute", ["KeyM"]);
const Jump = defineAction("myGame.jump", ["Space", "pointer.primary"]);
const Quit = defineAction("myGame.quit", ["Escape"]);

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [audio(), storage(), pixi2d()] });
// The game keeps mute, not the engine: loaded now, saved at the end of each frame it changes in.
persistResource(game, AudioState, "muted", Muted);

async function loadSounds(ctx: SystemCtx): Promise<void> {
  await loadAssets(ctx, Sounds, "boot");
  playSound(ctx, Theme); // a loop: queued until the first gesture, then it starts
}

let combo = 0;
function play(ctx: SystemCtx): void {
  const { input, random, resources } = ctx;
  if (input.pressed(ToggleMute)) {
    const audioState = resources.get(AudioState);
    audioState.muted = !audioState.muted; // applied, and saved, by the end of the frame
  }
  if (input.pressed(Jump)) playSound(ctx, Tap); // a one-shot: dropped while output is locked
  if (input.pressed(Jump) && random.next() < 0.2) {
    // One sound, a variant per combo step: the high note climbs a semitone each time.
    playSound(ctx, Coin, { rate: 0.9 + random.next() * 0.2, params: { high: 1319 * 2 ** (combo++ / 12) } });
  }
  if (input.pressed(Quit)) stopSound(ctx, Theme, { fade: 1 });
}

game.addSystem(Schedule.PreInit, loadSounds).addSystem(Schedule.Update, play);
await game.run();
```

- **Unlock.** Browsers start audio only inside a user gesture. The plugin starts output from `input.onGesture`, so the first key press, tap or click on the canvas starts it (on `pointerup` too, which iOS Safari needs). Where autoplay is allowed it starts when the run starts. For a gesture outside the canvas, such as an HTML menu button, call `unlockAudio(ctx)` in its handler. `AudioState.status` is `locked`, `running`, `suspended` or `unavailable`, and `AudioUnlocked` is sent once, the first time output runs.
- **Before unlock.** A one-shot played while output is not running is dropped and counted in `AudioState.dropped`: a tap sound played seconds late reads as a bug. A looping sound is queued in `AudioState.queued` and starts when output runs, so music asked for at startup begins at the first gesture. The same holds while the page is hidden.
- **Without the plugin.** `playSound`, `stopSound` and `unlockAudio` throw when the game has no `audio()` plugin, naming it, as `addTween` does without `motion()`. A test game passes `audio({ backend: testAudio() })`.
- **Playing.** `playSound(ctx, sound, { volume?, rate?, params? })` returns whether it plays (for a loop: plays or is queued). `params` reach a synth as `params`, laid over the sound's own: a `Synth<P>` types them, `defineSound` then needs every field of `P` as `params`, and a play passes only those that differ, so one sound covers its variants. A sample, or a synth without parameters, takes none (a compile error, and a throw). A looping sound plays once at a time; playing it again does nothing. Each sound has a `limit` of instances (4 by default, 1 for a loop): one more stops the oldest. A sample whose asset is not loaded is dropped and logged once. `stopSound(ctx, sound, { fade? })` stops every instance, fading over `fade` seconds.
- **Volume.** `AudioState` is plain data the game edits: `muted`, `volume` (master) and `buses[name].volume` and `.muted`. Buses are `sfx` (the default for a sound) and `music`, or whatever `audio({ buses })` names. Changes apply by the end of the frame and to every sound as it starts. The engine does not save mute: bind it to a key of the game's with `persistResource` from `storage()`, as above, so the game decides the key.
- **Lifecycle.** Output is suspended while the page is hidden and resumed when it shows; a loop keeps its place. When the run stops, every sound stops and output is suspended; the next `run()` resumes it without a new gesture. A paused game keeps playing. `AudioState.playing` counts instances by sound name, and `inspect(game)` shows all of it under `fenrir.AudioState`.
- **Samples.** `fenrir-ts/audio` adds the `audio` asset kind. The plugin registers its loader (fetch, then decode), so manifests load samples with progress, fallbacks and unload. Before output starts, samples decode on an `OfflineAudioContext`: no `AudioContext` is created outside a gesture.
- **Backends.** The output is an `AudioBackend`: `webAudio()` by default, `testAudio()` in tests, or a host app's own (`audio({ backend })`). The engine decides what plays, when and how loud; a backend only does it.

Tests pass `testAudio()` as the backend: nothing is heard, output stays locked until a gesture (`game.input.pointerDown`) unless `{ autoplay: true }`, and `played` lists each voice in order with its bus, volume and rate:

```ts
import { Schedule, createTestGame } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, testAudio, type Synth } from "fenrir-ts/audio";
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
```

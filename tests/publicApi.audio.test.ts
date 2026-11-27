import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { inspect } from "@/core/Inspect";

// The audio entry needs no peer package. Each of these throws if it reaches one.
vi.mock("three", () => {
  throw new Error("fenrir-ts/audio imported three");
});
vi.mock("pixi.js", () => {
  throw new Error("fenrir-ts/audio imported pixi.js");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/audio imported jolt-physics");
});

/** `fenrir-ts` plus `fenrir-ts/audio`, imported the way a game does. */
let core: typeof import("@/index");
let sound: typeof import("@/audio");

beforeAll(async () => {
  core = await import("@/index");
  sound = await import("@/audio");
});

describe("fenrir-ts/audio public API", () => {
  it("unlocks on the first gesture, plays sounds by name and preloads samples through a manifest (#39)", async () => {
    const { Schedule, createTestGame, defineAssets, getAsset, loadAssets, setAssetLoader, NullLogger } = core;
    const { AudioState, AudioUnlocked, audio, defineSound, playSound, stopSound, testAudio } = sound;
    const Assets = defineAssets("publicApi.sounds", { assets: { tap: { kind: "audio", src: "tap.mp3" } }, bundles: { boot: ["tap"] } });
    const Tap = defineSound("publicApi.tap", { sample: "tap", volume: 0.5 });
    const Theme = defineSound("publicApi.theme", {
      bus: "music",
      loop: true,
      synth: (context, output) => {
        const osc = context.createOscillator();
        osc.connect(output);
        osc.start();
        return osc;
      },
    });

    const backend = testAudio();
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend })] });
    setAssetLoader(game, { load: async () => ({ duration: 0.2 }) });
    const unlocked: unknown[] = [];
    game.on(AudioUnlocked, (payload) => void unlocked.push(payload));
    game.addSystem(Schedule.PreInit, async function boot(ctx) {
      await loadAssets(ctx, Assets, "boot");
      playSound(ctx, Theme); // queued until the first gesture
    });
    await game.start();
    expectTypeOf(getAsset(game, Assets, "tap")).toEqualTypeOf<import("@/audio").AudioClip>();
    expect(playSound(game, Tap)).toBe(false);

    game.input.pointerDown(5, 5);
    expect(unlocked).toEqual([{}]);
    expect(playSound(game, Tap, { rate: 1.5 })).toBe(true);
    game.resources.get(AudioState).muted = true;
    game.step();
    expect(backend.played.map(({ sound, bus, volume, rate }) => [sound, bus, volume, rate])).toEqual([
      ["publicApi.theme", "music", 1, 1],
      ["publicApi.tap", "sfx", 0.5, 1.5],
    ]);
    expect(backend.volumes.master).toBe(0);
    expect(inspect(game).resources["fenrir.AudioState"]).toMatchObject({ status: "running", muted: true, dropped: 1, playing: { "publicApi.theme": 1, "publicApi.tap": 1 } });
    stopSound(game, Theme, { fade: 1 });
    await game.stop();
    expect(game.resources.get(AudioState)).toMatchObject({ status: "suspended", playing: {} });
  });

  it("passes typed per-play params to a synth, laid over the sound's", async () => {
    const { createTestGame, NullLogger } = core;
    const { audio, defineSound, playSound, testAudio } = sound;
    const tone: import("@/audio").Synth<{ hz: number; length: number }> = (context, output, { params }) => {
      const osc = context.createOscillator();
      osc.frequency.value = params.hz;
      osc.connect(output);
      osc.start();
      osc.stop(context.currentTime + params.length);
      return osc;
    };
    const Tone = defineSound("publicApi.tone", { synth: tone, params: { hz: 440, length: 0.1 } });
    expectTypeOf(Tone).toEqualTypeOf<import("@/audio").SoundType<{ hz: number; length: number }>>();
    const backend = testAudio({ autoplay: true });
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend })] });
    await game.start();
    playSound(game, Tone, { params: { hz: 880 } });
    expect(backend.played[0]!.params).toEqual({ hz: 880, length: 0.1 });
    await game.stop();
  });
});

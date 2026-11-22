import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestGame } from "@/core/TestGame";
import type { TestGame } from "@/core/TestGame";
import { NullLogger } from "@/core/NullLogger";
import type { ILogger } from "@/core/ILogger";
import { Schedule } from "@/core/Schedule";
import type { SystemCtx } from "@/core/SystemCtx";
import { defineAssets, loadAssets, setAssetLoader } from "@/core/Assets/Manifest";
import { AudioState, AudioUnlocked, audio, defineSound, playSound, stopSound, unlockAudio, type AudioBackend, type Synth } from "@/core/Audio/Audio";
import { testAudio, type TestAudio } from "@/core/Audio/TestAudio";

const blip: Synth = (context, output) => {
  const osc = context.createOscillator();
  osc.connect(output);
  osc.start();
  return osc;
};

const Tap = defineSound("test.tap", { synth: blip, volume: 0.5 });
const Coin = defineSound("test.coin", { synth: blip, limit: 2 });
const Theme = defineSound("test.theme", { synth: blip, bus: "music", loop: true });
const Splash = defineSound("test.splash", { sample: "splash" });

function recordingLogger(): ILogger & { warnings: string[] } {
  const warnings: string[] = [];
  return { ...new NullLogger(), warnings, warn: (message: string) => void warnings.push(message) } as ILogger & { warnings: string[] };
}

type Setup = { game: TestGame; ctx: SystemCtx; sounds: TestAudio; unlocked: number };

async function setup(options: { autoplay?: boolean; logger?: ILogger; init?: (ctx: SystemCtx) => void } = {}): Promise<Setup> {
  const sounds = testAudio({ autoplay: options.autoplay });
  const game = await createTestGame({ seed: 1, logger: options.logger ?? new NullLogger(), plugins: [audio({ backend: sounds })] });
  const result = { game, sounds, unlocked: 0 } as Setup;
  game.on(AudioUnlocked, () => void result.unlocked++);
  game.addSystem(Schedule.Init, function capture(ctx) {
    result.ctx = ctx;
    options.init?.(ctx);
  });
  await game.start();
  return result;
}

const names = (sounds: TestAudio) => sounds.played.map((p) => p.sound);
const state = (game: TestGame) => game.resources.get(AudioState);

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, "visibilityState", { value: hidden ? "hidden" : "visible", configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

afterEach(() => {
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

describe("audio() plugin", () => {
  it("adds AudioState, the audio loader and two named systems", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend: testAudio(), buses: ["sfx", "music", "voice"] })] });
    const snapshot = game.inspect();
    expect(snapshot.schedule.init).toEqual(["fenrir.audio.init"]);
    expect(snapshot.schedule.postUpdate).toEqual(["fenrir.audio.postUpdate"]);
    expect(snapshot.resources["fenrir.AudioState"]).toEqual({
      status: "locked",
      muted: false,
      volume: 1,
      buses: { sfx: { volume: 1, muted: false }, music: { volume: 1, muted: false }, voice: { volume: 1, muted: false } },
      playing: {},
      queued: [],
      dropped: 0,
    });
    expect(game.assets.getSupportedExtensions("audio")).toContain("mp3");
  });

  it("stays locked until the first gesture, then unlocks once and sends AudioUnlocked", async () => {
    const s = await setup();
    expect(state(s.game).status).toBe("locked");
    expect(s.sounds.running).toBe(false);
    s.game.input.pointerDown(10, 10);
    expect(state(s.game).status).toBe("running");
    expect(s.sounds.running).toBe(true);
    s.game.input.pointerUp();
    s.game.step();
    expect(s.unlocked).toBe(1);
  });

  it("drops one-shots played before unlock, and counts them", async () => {
    const s = await setup();
    expect(playSound(s.ctx, Tap)).toBe(false);
    expect(state(s.game).dropped).toBe(1);
    s.game.input.pointerDown(1, 1);
    expect(names(s.sounds)).toEqual([]);
    expect(playSound(s.ctx, Tap)).toBe(true);
    expect(names(s.sounds)).toEqual(["test.tap"]);
  });

  it("queues a looping sound until unlock, then starts it once", async () => {
    const s = await setup({ init: (ctx) => void playSound(ctx, Theme) });
    expect(state(s.game).queued).toEqual(["test.theme"]);
    expect(playSound(s.ctx, Theme)).toBe(true);
    s.game.input.pointerDown(1, 1);
    expect(names(s.sounds)).toEqual(["test.theme"]);
    expect(state(s.game)).toMatchObject({ queued: [], playing: { "test.theme": 1 } });
    // Playing a looping sound that plays does nothing.
    playSound(s.ctx, Theme);
    expect(names(s.sounds)).toEqual(["test.theme"]);
  });

  it("starts at once where autoplay is allowed", async () => {
    const s = await setup({ autoplay: true, init: (ctx) => void playSound(ctx, Tap) });
    expect(state(s.game).status).toBe("running");
    expect(names(s.sounds)).toEqual(["test.tap"]);
    expect(s.unlocked).toBe(1);
  });

  it("plays by name with volume, rate, bus and loop, in order", async () => {
    const s = await setup({ autoplay: true });
    playSound(s.ctx, Tap, { volume: 0.5, rate: 1.25 });
    playSound(s.ctx, Theme);
    expect(s.sounds.played).toEqual([
      { sound: "test.tap", bus: "sfx", volume: 0.25, rate: 1.25, loop: false, synth: true, ended: false, fade: null },
      { sound: "test.theme", bus: "music", volume: 1, rate: 1, loop: true, synth: true, ended: false, fade: null },
    ]);
    expect(state(s.game).playing).toEqual({ "test.tap": 1, "test.theme": 1 });
    s.sounds.finish("test.tap");
    expect(state(s.game).playing).toEqual({ "test.theme": 1 });
  });

  it("stops the oldest instance when a sound is over its limit", async () => {
    const s = await setup({ autoplay: true });
    for (let i = 0; i < 3; i++) playSound(s.ctx, Coin, { volume: i + 1 });
    expect(s.sounds.played.map((p) => [p.volume, p.ended])).toEqual([
      [1, true],
      [2, false],
      [3, false],
    ]);
    expect(state(s.game).playing).toEqual({ "test.coin": 2 });
  });

  it("applies master and bus volume and mute to the backend by the end of the frame", async () => {
    const s = await setup({ autoplay: true });
    expect(s.sounds.volumes).toEqual({ master: 1, sfx: 1, music: 1 });
    const audioState = state(s.game);
    audioState.buses.music!.volume = 0.3;
    audioState.muted = true;
    s.game.step();
    expect(s.sounds.volumes).toEqual({ master: 0, sfx: 1, music: 0.3 });
    audioState.muted = false;
    audioState.volume = 0.5;
    audioState.buses.sfx!.muted = true;
    // A play applies changes too, so a sound never starts at a stale volume.
    playSound(s.ctx, Tap);
    expect(s.sounds.volumes).toEqual({ master: 0.5, sfx: 0, music: 0.3 });
  });

  it("stops a sound with a fade and drops it from the queue", async () => {
    const s = await setup({ init: (ctx) => void playSound(ctx, Theme) });
    stopSound(s.ctx, Theme);
    s.game.input.pointerDown(1, 1);
    expect(names(s.sounds)).toEqual([]);
    playSound(s.ctx, Theme);
    stopSound(s.ctx, Theme, { fade: 0.5 });
    expect(s.sounds.played[0]).toMatchObject({ ended: true, fade: 0.5 });
    expect(state(s.game).playing).toEqual({});
  });

  it("suspends while the page is hidden, drops one-shots, and resumes when it shows", async () => {
    const s = await setup({ autoplay: true });
    playSound(s.ctx, Theme);
    setHidden(true);
    expect(state(s.game).status).toBe("suspended");
    expect(s.sounds.running).toBe(false);
    expect(playSound(s.ctx, Tap)).toBe(false);
    // A gesture while hidden does not start output.
    s.game.input.pointerDown(1, 1);
    expect(s.sounds.running).toBe(false);
    setHidden(false);
    expect(state(s.game).status).toBe("running");
    expect(s.sounds.running).toBe(true);
    // The loop kept its place; it was not restarted.
    expect(names(s.sounds)).toEqual(["test.theme"]);
    expect(s.unlocked).toBe(1);
  });

  it("stops every sound at stop() and resumes output on the next run without a gesture", async () => {
    const s = await setup({ autoplay: false });
    s.game.input.pointerDown(1, 1);
    playSound(s.ctx, Theme);
    playSound(s.ctx, Tap);
    await s.game.stop();
    expect(s.sounds.played.every((p) => p.ended)).toBe(true);
    expect(state(s.game)).toMatchObject({ status: "suspended", playing: {}, queued: [] });
    expect(s.sounds.running).toBe(false);
    // Nothing plays between runs.
    expect(playSound(s.ctx, Tap)).toBe(false);

    await s.game.start();
    expect(state(s.game).status).toBe("running");
    expect(s.unlocked).toBe(1);
    await s.game.stop();
  });

  it("listens for visibility only while a run is going", async () => {
    const s = await setup({ autoplay: true });
    await s.game.stop();
    setHidden(true);
    setHidden(false);
    expect(s.sounds.running).toBe(false);
  });

  it("plays a sample loaded by a manifest, and drops one whose sample is not loaded with one warning", async () => {
    const logger = recordingLogger();
    const s = await setup({ autoplay: true, logger });
    const GameAssets = defineAssets("test.audioAssets", { assets: { splash: { kind: "audio", src: "sfx/splash.mp3" } }, bundles: { boot: ["splash"] } });
    expect(playSound(s.ctx, Splash)).toBe(false);
    expect(playSound(s.ctx, Splash)).toBe(false);
    expect(logger.warnings).toEqual(['Sound "test.splash": its sample "splash" is not loaded, so it does not play. Load a manifest bundle that lists it first.']);
    expect(state(s.game).dropped).toBe(2);

    setAssetLoader(s.game, { load: async () => ({ duration: 0.4 }) });
    await loadAssets(s.game, GameAssets, "boot");
    expect(playSound(s.ctx, Splash, { rate: 0.9 })).toBe(true);
    expect(s.sounds.played).toEqual([expect.objectContaining({ sound: "test.splash", synth: false, rate: 0.9 })]);
  });

  it("loads an audio asset through the plugin's loader: fetch, then the backend's decode", async () => {
    const fetch = vi.fn(async () => new Response(new ArrayBuffer(8)));
    vi.stubGlobal("fetch", fetch);
    try {
      const sounds = testAudio();
      const decode = vi.spyOn(sounds, "decode");
      const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend: sounds })] });
      const GameAssets = defineAssets("test.fetchedAudio", { assets: { splash: { kind: "audio", src: "sfx/splash.ogg" } }, bundles: { boot: ["splash"] } });
      await loadAssets(game, GameAssets, "boot");
      expect(fetch).toHaveBeenCalledWith("sfx/splash.ogg");
      expect(decode).toHaveBeenCalledOnce();
      expect(game.resources.get(GameAssets.progress).fraction).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reports unavailable audio once and drops every sound", async () => {
    const logger = recordingLogger();
    const game = await createTestGame({ seed: 1, logger, plugins: [audio({ backend: testAudio({ unavailable: true }) })] });
    let ctx!: SystemCtx;
    game.addSystem(Schedule.Init, (c) => void (ctx = c), { name: "capture" });
    await game.start();
    game.input.pointerDown(1, 1);
    game.input.pointerUp();
    expect(state(game).status).toBe("unavailable");
    expect(playSound(ctx, Theme)).toBe(false);
    expect(playSound(ctx, Tap)).toBe(false);
    expect(logger.warnings).toHaveLength(1);
    await game.stop();
    expect(state(game).status).toBe("unavailable");
  });

  it("starts from unlockAudio, for a gesture outside the canvas", async () => {
    const s = await setup();
    unlockAudio(s.ctx);
    expect(state(s.game).status).toBe("running");
  });

  it("waits for an asynchronous start and starts queued loops when it resolves", async () => {
    let resolve!: (running: boolean) => void;
    const sounds = testAudio();
    const backend: AudioBackend = { ...sounds, name: "async", canAutoplay: () => false, start: () => new Promise<boolean>((r) => (resolve = r)) };
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend })] });
    let ctx!: SystemCtx;
    game.addSystem(Schedule.Init, (c) => void (ctx = c), { name: "capture" });
    await game.start();
    playSound(ctx, Theme);
    game.input.pointerDown(1, 1);
    game.input.pointerUp(); // a second gesture while starting asks nothing more
    expect(state(game).status).toBe("locked");
    resolve(true);
    await Promise.resolve();
    expect(state(game).status).toBe("running");
    expect(names(sounds)).toEqual(["test.theme"]);
    await game.stop();
  });

  it("checks sounds and plays", async () => {
    const s = await setup({ autoplay: true });
    const Voice = defineSound("test.voice", { synth: blip, bus: "voice" });
    expect(() => playSound(s.ctx, Voice)).toThrow(/no bus is called "voice". The buses: sfx, music/);
    expect(() => playSound(s.ctx, Tap, { rate: 0 })).toThrow(/rate must be a finite number above 0/);
    expect(() => playSound(s.ctx, Tap, { volume: -1 })).toThrow(/volume must be a finite number 0 or more/);
    // @ts-expect-error a sound is a sample or a synth, not both
    expect(() => defineSound("test.both", { synth: blip, sample: "x" })).toThrow(/either a sample/);
    expect(() => defineSound("test.limit", { synth: blip, limit: 0 })).toThrow(/limit must be a whole number/);
  });

  it("throws a clear error without the plugin", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    expect(() => playSound(game, Tap)).toThrow(/needs the audio\(\) plugin from fenrir-ts\/audio/);
  });

  it("shows what plays in inspect()", async () => {
    const s = await setup({ autoplay: true });
    playSound(s.ctx, Theme);
    playSound(s.ctx, Coin);
    playSound(s.ctx, Coin);
    expect(s.game.inspect().resources["fenrir.AudioState"]).toMatchObject({ status: "running", playing: { "test.theme": 1, "test.coin": 2 } });
  });

  it("runs the AGENTS.md example", async () => {
    // AGENTS.md "Audio". Change both together.
    const Blip = defineSound("myGame.blip", { synth: blip, limit: 2 });
    const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true });
    const sounds = testAudio();
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [audio({ backend: sounds })] });
    game.addSystem(Schedule.Init, (ctx) => void playSound(ctx, Theme), { name: "myGame.music" });
    await game.start();
    game.input.pointerDown(10, 10);
    playSound(game, Blip, { volume: 0.5 });
    game.resources.get(AudioState).buses.music!.volume = 0.4;
    game.step();
    expect(sounds.played.map((p) => p.sound)).toEqual(["myGame.blip"]);
    expect(sounds.volumes.music).toBe(0.4);
  });
});

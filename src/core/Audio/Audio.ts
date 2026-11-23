// Audio: named sounds played from systems, unlocked inside the first user gesture, with master
// and bus volumes and mute as plain data in the AudioState resource.
//
// Opt-in, in its own entry (fenrir-ts/audio): nothing here is reachable from code that does not
// import it. The output is an AudioBackend, Web Audio by default and testAudio() in tests.
import { peekLoadedAsset } from "../Assets/ManifestStore";
import type { AssetStore } from "../Assets/AssetStore";
import type { EventBus } from "../EventBus";
import { defineEvent } from "../EventQueue";
import type { Plugin } from "../Game";
import type { ILogger } from "../ILogger";
import { defineResource, peekResource, type Resources } from "../Resource";
import { Schedule } from "../Schedule";
import { webAudio } from "./WebAudio";

/** A decoded sample: an `AudioBuffer` from the Web Audio backend. */
export interface AudioClip {
  /** Seconds. */
  readonly duration: number;
}

declare module "../Assets/AssetStore" {
  interface AssetKinds {
    /** A decoded sample, loaded by the `audio()` plugin's loader. Declared in a manifest as `{ kind: "audio", src }`. */
    audio: AudioClip;
  }
}

/** No per-play parameters: the default for a `Synth`, and what a sample sound has. */
export type NoParams = Record<never, never>;

/**
 * Builds a synthesized sound on the context: creates its nodes, connects the last to `output`,
 * starts them and returns the source that ends last, so the engine knows when the sound ended and
 * can stop it. `rate` is the play's rate, 1 by default; scale frequencies by it if it matters.
 *
 * `params` are the play's parameters, typed by `P`: the sound's `params` from `defineSound`, with
 * the fields `playSound` passed laid over them. So one sound plays in several variants (a pitch
 * per combo step, a timbre per pickup) instead of one sound per variant.
 *
 * @example
 * const blip: Synth = (audio, output, { rate }) => {
 *   const osc = audio.createOscillator();
 *   osc.frequency.value = 880 * rate;
 *   osc.connect(output);
 *   osc.start();
 *   osc.stop(audio.currentTime + 0.08);
 *   return osc;
 * };
 * const tone: Synth<{ hz: number; length: number }> = (audio, output, { params }) => {
 *   const osc = audio.createOscillator();
 *   osc.frequency.value = params.hz;
 *   osc.connect(output);
 *   osc.start();
 *   osc.stop(audio.currentTime + params.length);
 *   return osc;
 * };
 */
export type Synth<P extends object = NoParams> = (
  audio: AudioContext,
  output: AudioNode,
  play: { readonly rate: number; readonly params: Readonly<P> },
) => AudioScheduledSourceNode;

/**
 * A sound, made by `defineSound`. Plain data apart from `synth`. `P` is its synth's parameters,
 * which `playSound` takes as `params`; a sample sound, or a synth without parameters, has `NoParams`.
 */
export interface SoundType<P extends object = NoParams> {
  /** Namespaced, such as `myGame.tap`. Counts in `AudioState.playing` are by this name. */
  readonly name: string;
  /** The audio asset it plays, by its name in a manifest, or null for a synthesized sound. */
  readonly sample: string | null;
  readonly synth: Synth<P> | null;
  /** The synth's parameters for a play that passes none: `params` from `defineSound`, frozen. `{}` for a sample. */
  readonly params: Readonly<P>;
  readonly bus: string;
  /** 0 to 1 and above, multiplied by each play's volume. */
  readonly volume: number;
  /** Repeats until stopped. A looping sound plays once at a time: playing it again while it plays does nothing. */
  readonly loop: boolean;
  /** Instances that may sound at once. Playing one more stops the oldest. */
  readonly limit: number;
}

interface SoundBase {
  /** One of the plugin's buses. Defaults to `"sfx"`. */
  bus?: string;
  /** Defaults to 1. */
  volume?: number;
  /** Defaults to false. */
  loop?: boolean;
  /** Instances at once, at least 1. Defaults to 4, and to 1 for a looping sound. */
  limit?: number;
}

/** `params` is required when the synth has parameters, so every field has a value, and optional when it has none. */
type ParamsOption<P extends object> = NoParams extends P
  ? { /** The synth's parameters. It has none. */ params?: NoInfer<P> }
  : { /** The synth's parameters for a play that passes none: every field, since a play may pass only some. */ params: NoInfer<P> };

export type SoundOptions<P extends object = NoParams> =
  | (SoundBase & { /** The name of an `audio` asset of a manifest. */ sample: string; synth?: never; params?: never })
  | (SoundBase & { /** Builds the sound on the context. */ synth: Synth<P>; sample?: never } & ParamsOption<P>);

/** One play's options. */
export interface PlayOptions<P extends object = NoParams> {
  /** Multiplies the sound's volume. Defaults to 1. */
  volume?: number;
  /** Playback rate: 2 is an octave up and twice as fast. Defaults to 1. */
  rate?: number;
  /**
   * This play's parameters for a synth sound, laid over the sound's `params`: pass only the
   * fields that differ. Typed from the sound's synth. A sample sound, or a synth without
   * parameters, takes none.
   */
  params?: NoParams extends P ? never : Partial<NoInfer<P>>;
}

/** One bus in `AudioState`. */
export interface AudioBus {
  volume: number;
  muted: boolean;
}

/**
 * The game's audio, as plain data: the value of the `AudioState` resource, which `game.inspect()`
 * shows. The game edits `muted`, `volume` and `buses`; they apply by the end of the frame, and to
 * every sound that plays. The engine writes the rest.
 */
export interface AudioState {
  /**
   * `locked`: no user gesture has started output yet. `running`: sounds play. `suspended`: the page
   * is hidden, or the game stopped, after output had started. `unavailable`: the backend cannot play.
   */
  status: "locked" | "running" | "suspended" | "unavailable";
  /** Silences everything. Not saved by the engine: store it with `fenrir-ts` storage if the game keeps it. */
  muted: boolean;
  /** Master volume, 0 to 1. */
  volume: number;
  /** Each bus's volume and mute, by name. */
  buses: Record<string, AudioBus>;
  /** Instances sounding now, by sound name. A sound that is not playing is absent. */
  playing: Record<string, number>;
  /** Looping sounds asked for while output was not running, which start when it runs. */
  queued: string[];
  /** One-shots dropped because output was not running or their sample was not loaded. */
  dropped: number;
}
export const AudioState = defineResource<AudioState>("fenrir.AudioState");

/** Sent once per game, when output first runs: after the first user gesture, or at startup where autoplay is allowed. */
export const AudioUnlocked = defineEvent<Record<string, never>>("fenrir.audio.unlocked");

/** What the backend is asked to play. */
export interface VoiceRequest {
  readonly sound: string;
  readonly bus: string;
  /** The decoded sample, for a sample sound. */
  readonly clip: AudioClip | null;
  readonly synth: Synth<object> | null;
  /**
   * The synth's parameters for this play: the sound's `params` with the play's laid over them.
   * The engine always sets it (`{}` for a sample); optional so requests built by hand still type-check.
   */
  readonly params?: Readonly<Record<string, unknown>>;
  /** The sound's volume times the play's. */
  readonly volume: number;
  readonly rate: number;
  readonly loop: boolean;
}

/** A sound the backend is playing. */
export interface AudioVoice {
  /** Fades out over `fade` seconds, then stops. 0 stops at once. */
  stop(fade: number): void;
  /** Set by the engine. The backend calls it once, when the voice has ended or been stopped. */
  onended: (() => void) | null;
}

/**
 * Where sounds go: `webAudio()` by default, `testAudio()` in tests, or a host app's own output.
 * The engine decides what plays and when; a backend only does it.
 */
export interface AudioBackend {
  readonly name: string;
  /** Whether output may start without a user gesture. Asked when each run starts. */
  canAutoplay(): boolean;
  /**
   * Starts or resumes output. Called inside a user gesture, so it must ask the platform for
   * output synchronously, and again when the page shows. Returns, or resolves to, whether output
   * runs. Throws if the platform has no audio at all.
   */
  start(): boolean | Promise<boolean>;
  /** Pauses output, keeping each voice where it is: the page was hidden or the game stopped. */
  suspend(): void;
  /** Sets the volume of `bus`, or the master volume when `bus` is null. Called before `start` too. */
  setVolume(bus: string | null, volume: number): void;
  /** Starts a voice. Called only while output runs. */
  play(request: VoiceRequest): AudioVoice;
  /** Decodes a fetched audio file, for the `audio` asset loader. */
  decode(data: ArrayBuffer): Promise<AudioClip>;
}

export interface AudioOptions {
  /** Bus names. Defaults to `["sfx", "music"]`. */
  buses?: readonly string[];
  /** Defaults to `webAudio()`. Pass `testAudio()` in tests. */
  backend?: AudioBackend;
}

/** What the audio functions need: a `SystemCtx`, or the `Game` or `TestGame` itself. */
export type AudioCtx = { readonly resources: Resources };

interface Playing {
  readonly voice: AudioVoice;
}

/** A sound of any parameters, as the runtime handles it. */
type AnySound = SoundType<object>;

/** One play, resolved: what `startVoice` needs, and what a queued loop keeps. */
interface Play {
  readonly sound: AnySound;
  readonly volume: number;
  readonly rate: number;
  readonly params: Readonly<Record<string, unknown>>;
}

interface Runtime {
  readonly backend: AudioBackend;
  readonly state: AudioState;
  readonly events: EventBus;
  readonly logger: ILogger;
  readonly assets: AssetStore;
  /** Voices by sound name, oldest first. */
  readonly voices: Map<string, Playing[]>;
  /** Looping sounds waiting for output, with their play options. */
  readonly queued: Map<string, Play>;
  /** Volumes last given to the backend, by bus (`null` for master). */
  readonly levels: Map<string | null, number>;
  readonly warned: Set<string>;
  /** A run is going: between the start of `fenrir.audio.init` and its cleanup. */
  active: boolean;
  hidden: boolean;
  starting: boolean;
  unlocked: boolean;
}

const runtimes = new WeakMap<Resources, Runtime>();

const fail = (caller: string, text: string): never => {
  throw new Error(`${caller}: ${text}.`);
};

function runtimeOf(caller: string, { resources }: AudioCtx): Runtime {
  const runtime = runtimes.get(resources);
  if (!runtime || peekResource(resources, AudioState) !== runtime.state) {
    fail(caller, "needs the audio() plugin from fenrir-ts/audio: createGame({ canvas, plugins: [audio()] })");
  }
  return runtime!;
}

function warnOnce(runtime: Runtime, key: string, text: string, error?: unknown): void {
  if (runtime.warned.has(key)) return;
  runtime.warned.add(key);
  runtime.logger.warn(text, error === undefined ? undefined : { error });
}

/** Gives the backend every volume that changed since it was last told. */
function applyLevels(runtime: Runtime): void {
  const { state, backend, levels } = runtime;
  const set = (bus: string | null, volume: number): void => {
    if (levels.get(bus) === volume) return;
    levels.set(bus, volume);
    backend.setVolume(bus, volume);
  };
  set(null, state.muted ? 0 : state.volume);
  for (const bus in state.buses) set(bus, state.buses[bus]!.muted ? 0 : state.buses[bus]!.volume);
}

function count(runtime: Runtime, name: string): void {
  const n = runtime.voices.get(name)?.length ?? 0;
  if (n) runtime.state.playing[name] = n;
  else delete runtime.state.playing[name];
}

function syncQueued(runtime: Runtime): void {
  runtime.state.queued = [...runtime.queued.keys()];
}

/** Starts a voice now. Output is running. Returns whether it started. */
function startVoice(runtime: Runtime, { sound, volume, rate, params }: Play): boolean {
  const { name } = sound;
  let clip: AudioClip | null = null;
  if (sound.sample !== null) {
    clip = (peekLoadedAsset(runtime.assets, sound.sample) as AudioClip | undefined) ?? null;
    if (!clip) {
      warnOnce(runtime, name, `Sound "${name}": its sample "${sound.sample}" is not loaded, so it does not play. Load a manifest bundle that lists it first.`);
      return false;
    }
  }
  const list = runtime.voices.get(name) ?? [];
  runtime.voices.set(name, list);
  // Over the limit: the oldest instance makes way.
  while (list.length >= sound.limit) list.shift()!.voice.stop(0);
  applyLevels(runtime);
  let voice: AudioVoice;
  try {
    voice = runtime.backend.play({ sound: name, bus: sound.bus, clip, synth: sound.synth, params, volume: sound.volume * volume, rate, loop: sound.loop });
  } catch (error) {
    count(runtime, name);
    runtime.logger.error(`Sound "${name}" failed to play`, { error });
    return false;
  }
  const entry: Playing = { voice };
  list.push(entry);
  voice.onended = () => {
    const at = list.indexOf(entry);
    if (at < 0) return;
    list.splice(at, 1);
    count(runtime, name);
  };
  count(runtime, name);
  return true;
}

function settle(runtime: Runtime, running: boolean): void {
  runtime.starting = false;
  const { state } = runtime;
  // Stopped or hidden while starting: stay quiet until the next run or the page shows.
  if (!runtime.active || runtime.hidden) {
    if (running) runtime.backend.suspend();
    return;
  }
  if (!running) return;
  state.status = "running";
  applyLevels(runtime);
  if (!runtime.unlocked) {
    runtime.unlocked = true;
    runtime.events.send(AudioUnlocked, {});
  }
  const queued = [...runtime.queued.values()];
  runtime.queued.clear();
  syncQueued(runtime);
  for (const play of queued) startVoice(runtime, play);
}

/** Asks the backend for output, unless it runs, is being started, or cannot be. */
function tryStart(runtime: Runtime): void {
  const { state } = runtime;
  if (!runtime.active || runtime.hidden || runtime.starting || state.status === "running" || state.status === "unavailable") return;
  applyLevels(runtime);
  let result: boolean | Promise<boolean>;
  try {
    result = runtime.backend.start();
  } catch (error) {
    state.status = "unavailable";
    warnOnce(runtime, "", `Audio is unavailable (${runtime.backend.name}); sounds will not play`, error);
    return;
  }
  if (typeof result === "boolean") return settle(runtime, result);
  runtime.starting = true;
  result.then(
    (running) => settle(runtime, running),
    (error: unknown) => {
      runtime.logger.warn(`Audio did not start (${runtime.backend.name})`, { error });
      settle(runtime, false);
    },
  );
}

function stopAll(runtime: Runtime): void {
  for (const [name, list] of runtime.voices) {
    for (const { voice } of list.splice(0)) voice.stop(0);
    count(runtime, name);
  }
  runtime.queued.clear();
  syncQueued(runtime);
}

const checkLevel = (caller: string, what: string, value: number, positive = false): void => {
  if (!(Number.isFinite(value) && (positive ? value > 0 : value >= 0))) fail(caller, `${what} must be a finite number ${positive ? "above 0" : "0 or more"}, got ${value}`);
};

/**
 * Defines a sound: a sample (an `audio` asset of a manifest, by name) or a synthesized sound,
 * with its bus, volume, looping and how many may sound at once. Plain data, declared once at
 * module level; play it from systems with `playSound`. The name is namespaced: `myGame.tap`.
 *
 * @example
 * const Tap = defineSound("myGame.tap", { sample: "tap", volume: 0.8 });
 * const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true });
 * const Blip = defineSound("myGame.blip", { synth: blip, limit: 2 });
 * // A synth with parameters gets all of them here; a play passes only the ones that differ.
 * const Tone = defineSound("myGame.tone", { synth: tone, params: { hz: 440, length: 0.1 } });
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineSound<P extends object = NoParams>(name: string, options: SoundOptions<P>): SoundType<P> {
  const caller = `defineSound("${name}")`;
  const { sample = null, synth = null, bus = "sfx", volume = 1, loop = false } = options;
  const limit = options.limit ?? (loop ? 1 : 4);
  if ((sample === null) === (synth === null)) fail(caller, "give either a sample (an audio asset's name) or a synth");
  if (sample !== null && options.params !== undefined) fail(caller, "params are for a synth; a sample sound takes none");
  checkLevel(caller, "volume", volume);
  if (!(Number.isInteger(limit) && limit >= 1)) fail(caller, `limit must be a whole number, 1 or more, got ${limit}`);
  const params = Object.freeze({ ...options.params }) as Readonly<P>;
  return Object.freeze({ name, sample, synth, params, bus, volume, loop, limit });
}

/**
 * Plays `sound` now. Returns whether it is playing, or, for a looping sound, playing or queued.
 *
 * Until a user gesture has started output (and while the page is hidden), a one-shot is dropped,
 * not queued: a tap sound played seconds late reads as a bug. A looping sound (music, ambience)
 * is queued instead and starts when output runs. A looping sound plays once at a time, so playing
 * it again while it plays or waits does nothing. A one-shot over its sound's `limit` stops that
 * sound's oldest instance. A sample that is not loaded yet is dropped and logged once.
 *
 * `params` reach a synth sound's synth, laid over the sound's own `params`. A queued loop keeps
 * the parameters it was played with.
 *
 * Throws for an unknown bus, a volume or rate that is not a finite number (above 0 for rate), or
 * `params` given for a sample sound.
 *
 * @example
 * playSound(ctx, Tap, { volume: 0.5, rate: ctx.random.next() * 0.2 + 0.9 });
 * playSound(ctx, Tone, { params: { hz: 440 * 2 ** (combo / 12) } }); // length stays 0.1
 */
export function playSound<P extends object>(ctx: AudioCtx, sound: SoundType<P>, options: PlayOptions<P> = {}): boolean {
  const caller = `playSound("${sound.name}")`;
  const runtime = runtimeOf(caller, ctx);
  const { volume = 1, rate = 1 } = options;
  checkLevel(caller, "volume", volume);
  checkLevel(caller, "rate", rate, true);
  if (sound.synth === null && options.params !== undefined) fail(caller, "params are for a synth; a sample sound takes none");
  // `?? {}`: a SoundType built by hand, without defineSound, may have no params.
  const base: Readonly<Record<string, unknown>> = sound.params ?? {};
  const play: Play = { sound: sound as AnySound, volume, rate, params: options.params ? { ...base, ...options.params } : base };
  const { state } = runtime;
  if (!(sound.bus in state.buses)) fail(caller, `no bus is called "${sound.bus}". The buses: ${Object.keys(state.buses).join(", ")}`);
  if (sound.loop) {
    if (runtime.voices.get(sound.name)?.length || runtime.queued.has(sound.name)) return true;
    if (state.status === "running") return startVoice(runtime, play);
    if (state.status === "unavailable") return false;
    runtime.queued.set(sound.name, play);
    syncQueued(runtime);
    return true;
  }
  if (state.status === "running" && startVoice(runtime, play)) return true;
  state.dropped++;
  return false;
}

/**
 * Stops every instance of `sound`, fading out over `fade` seconds (default 0, at once), and
 * removes it from the queue. It counts as stopped at once, so playing it again starts afresh
 * while the old instance fades.
 */
export function stopSound<P extends object>(ctx: AudioCtx, sound: SoundType<P>, options: { fade?: number } = {}): void {
  const caller = `stopSound("${sound.name}")`;
  const runtime = runtimeOf(caller, ctx);
  const { fade = 0 } = options;
  checkLevel(caller, "fade", fade);
  if (runtime.queued.delete(sound.name)) syncQueued(runtime);
  for (const { voice } of runtime.voices.get(sound.name)?.splice(0) ?? []) voice.stop(fade);
  count(runtime, sound.name);
}

/**
 * Starts output from inside a user gesture the engine does not see, such as a click on an HTML
 * button over the canvas. The engine already does this for every gesture on the canvas, so most
 * games never call it. Does nothing while no run is going, or once output runs.
 */
export function unlockAudio(ctx: AudioCtx): void {
  tryStart(runtimeOf("unlockAudio", ctx));
}

/** File extensions the audio loader takes. Which ones decode depends on the browser. */
const EXTENSIONS = ["mp3", "ogg", "oga", "opus", "wav", "m4a", "aac", "webm", "flac"];

/**
 * Plays sounds: `playSound`, `stopSound` and `unlockAudio` need it. It adds the `AudioState`
 * resource, the loader for `audio` assets (so a manifest preloads samples with progress), and
 * two systems: `fenrir.audio.init`, which starts output at once where autoplay is allowed or
 * after a previous run unlocked it, and suspends output while the page is hidden, and
 * `fenrir.audio.postUpdate`, which applies volume and mute changes each frame.
 *
 * Output starts inside the first user gesture on the canvas (through `input.onGesture`), with no
 * game code. When a run stops, every sound stops and output is suspended; the next run resumes it
 * without a new gesture.
 *
 * @example
 * const game = await createGame({ canvas, plugins: [audio(), pixi2d()] });
 * const test = await createTestGame({ seed: 1, plugins: [audio({ backend: testAudio() })] });
 */
export function audio(options: AudioOptions = {}): Plugin {
  const { buses = ["sfx", "music"] } = options;
  return {
    name: "fenrir.audio",
    install(game) {
      const backend = options.backend ?? webAudio();
      const state: AudioState = { status: "locked", muted: false, volume: 1, buses: {}, playing: {}, queued: [], dropped: 0 };
      for (const bus of buses) state.buses[bus] = { volume: 1, muted: false };
      const runtime: Runtime = {
        backend,
        state,
        events: game.events,
        logger: game.logger,
        assets: game.assets,
        voices: new Map(),
        queued: new Map(),
        levels: new Map(),
        warned: new Set(),
        active: false,
        hidden: false,
        starting: false,
        unlocked: false,
      };
      game.resources.set(AudioState, state);
      runtimes.set(game.resources, runtime);

      game.assets.registerLoader("audio", "fenrir.audio", {
        extensions: EXTENSIONS,
        loader: async ({ url }) => {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
          return backend.decode(await response.arrayBuffer());
        },
      }, "audio");

      game.input.onGesture(() => tryStart(runtime));

      // Named by option, not nameEngineSystems: SystemName.ts would pull its stage list into every core bundle.
      game
        .addSystem(Schedule.Init, function init({ signal, onCleanup }) {
          runtime.active = true;
          const doc = globalThis.document;
          runtime.hidden = doc?.visibilityState === "hidden";
          doc?.addEventListener("visibilitychange", () => {
            runtime.hidden = doc.visibilityState === "hidden";
            if (!runtime.hidden) return tryStart(runtime);
            if (state.status !== "running") return;
            backend.suspend();
            state.status = "suspended";
          }, { signal });
          onCleanup(() => {
            runtime.active = false;
            runtime.hidden = false;
            stopAll(runtime);
            if (state.status === "running") backend.suspend();
            if (state.status !== "unavailable") state.status = runtime.unlocked ? "suspended" : "locked";
          });
          if (runtime.unlocked || backend.canAutoplay()) tryStart(runtime);
        }, { name: "fenrir.audio.init" })
        .addSystem(Schedule.PostUpdate, () => applyLevels(runtime), { name: "fenrir.audio.postUpdate" });
    },
  };
}

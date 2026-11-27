# `fenrir-ts/audio` API reference

Generated from the TSDoc in the source by `scripts/api-reference.mjs`. Do not edit: run `pnpm api:reference`.

Sounds, buses, the unlock policy, the `audio` asset kind and the Web Audio and test backends.

Peer packages: none. Import from `fenrir-ts/audio` only, never from `dist/` or a source path.

## Contents

- Functions: [`audio`](#audio), [`defineSound`](#definesound), [`playSound`](#playsound), [`stopSound`](#stopsound), [`testAudio`](#testaudio), [`unlockAudio`](#unlockaudio), [`webAudio`](#webaudio)
- Constants: [`AudioState`](#audiostate), [`AudioUnlocked`](#audiounlocked)
- Types: [`AudioBackend`](#audiobackend), [`AudioBus`](#audiobus), [`AudioClip`](#audioclip), [`AudioCtx`](#audioctx), [`AudioOptions`](#audiooptions), [`AudioVoice`](#audiovoice), [`NoParams`](#noparams), [`PlayedSound`](#playedsound), [`PlayOptions`](#playoptions), [`SoundOptions`](#soundoptions), [`SoundType`](#soundtype), [`Synth`](#synth), [`TestAudio`](#testaudio), [`TestAudioOptions`](#testaudiooptions), [`VoiceRequest`](#voicerequest)
- [Added to core types when imported](#added-to-core-types-when-imported)

## Functions

### audio

```ts
function audio(options?: AudioOptions): Plugin;
```

Plays sounds: `playSound`, `stopSound` and `unlockAudio` need it. It adds the `AudioState`
resource, the loader for `audio` assets (so a manifest preloads samples with progress), and
two systems: `fenrir.audio.init`, which starts output at once where autoplay is allowed or
after a previous run unlocked it, and suspends output while the page is hidden, and
`fenrir.audio.postUpdate`, which applies volume and mute changes each frame.

Output starts inside the first user gesture on the canvas (through `input.onGesture`), with no
game code. When a run stops, every sound stops and output is suspended; the next run resumes it
without a new gesture.

```ts
const game = await createGame({ canvas, plugins: [audio(), pixi2d()] });
const test = await createTestGame({ seed: 1, plugins: [audio({ backend: testAudio() })] });
```

### defineSound

```ts
function defineSound<P extends object = NoParams>(name: string, options: SoundOptions<P>): SoundType<P>;
```

Defines a sound: a sample (an `audio` asset of a manifest, by name) or a synthesized sound,
with its bus, volume, looping and how many may sound at once. Plain data, declared once at
module level; play it from systems with `playSound`. The name is namespaced: `myGame.tap`.

```ts
const Tap = defineSound("myGame.tap", { sample: "tap", volume: 0.8 });
const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true });
const Blip = defineSound("myGame.blip", { synth: blip, limit: 2 });
// A synth with parameters gets all of them here; a play passes only the ones that differ.
const Tone = defineSound("myGame.tone", { synth: tone, params: { hz: 440, length: 0.1 } });
```

### playSound

```ts
function playSound<P extends object>(ctx: AudioCtx, sound: SoundType<P>, options?: PlayOptions<P>): boolean;
```

Plays `sound` now. Returns whether it is playing, or, for a looping sound, playing or queued.

Until a user gesture has started output (and while the page is hidden), a one-shot is dropped,
not queued: a tap sound played seconds late reads as a bug. A looping sound (music, ambience)
is queued instead and starts when output runs. A looping sound plays once at a time, so playing
it again while it plays or waits does nothing. A one-shot over its sound's `limit` stops that
sound's oldest instance. A sample that is not loaded yet is dropped and logged once.

`params` reach a synth sound's synth, laid over the sound's own `params`. A queued loop keeps
the parameters it was played with.

Throws for an unknown bus, a volume or rate that is not a finite number (above 0 for rate), or
`params` given for a sample sound.

```ts
playSound(ctx, Tap, { volume: 0.5, rate: ctx.random.next() * 0.2 + 0.9 });
playSound(ctx, Tone, { params: { hz: 440 * 2 ** (combo / 12) } }); // length stays 0.1
```

### stopSound

```ts
function stopSound<P extends object>(ctx: AudioCtx, sound: SoundType<P>, options?: {
    fade?: number;
}): void;
```

Stops every instance of `sound`, fading out over `fade` seconds (default 0, at once), and
removes it from the queue. It counts as stopped at once, so playing it again starts afresh
while the old instance fades.

### testAudio

```ts
function testAudio(options?: TestAudioOptions): TestAudio;
```

A backend for tests: no Web Audio, nothing is heard. Output is locked until a gesture
(`game.input.pointerDown`, `pointerUp` or `press` in a test game) unless `autoplay` is set, and
starts synchronously. Decoding returns a clip with `duration: 1`.

```ts
const sounds = testAudio();
const game = await createTestGame({ seed: 1, plugins: [audio({ backend: sounds })] });
await game.start();
game.input.pointerDown(10, 10); // the first gesture unlocks output
game.step();
expect(sounds.played.map((p) => p.sound)).toEqual(["myGame.tap"]);
```

### unlockAudio

```ts
function unlockAudio(ctx: AudioCtx): void;
```

Starts output from inside a user gesture the engine does not see, such as a click on an HTML
button over the canvas. The engine already does this for every gesture on the canvas, so most
games never call it. Does nothing while no run is going, or once output runs.

### webAudio

```ts
function webAudio(): AudioBackend;
```

The default audio backend: one `AudioContext`, a gain node per bus into a master gain node.
The context is created inside the first `start()`, which the engine calls inside a user
gesture, so no browser warns that it was not allowed to start. Samples decoded before then
decode on an `OfflineAudioContext`.

## Constants

### AudioState

```ts
interface AudioState {
    status: "locked" | "running" | "suspended" | "unavailable";
    muted: boolean;
    volume: number;
    buses: Record<string, AudioBus>;
    playing: Record<string, number>;
    queued: string[];
    dropped: number;
}
const AudioState: ResourceType<AudioState>;
```

The game's audio, as plain data: the value of the `AudioState` resource, which `inspect(game)`
shows. The game edits `muted`, `volume` and `buses`; they apply by the end of the frame, and to
every sound that plays. The engine writes the rest.

Members:

- `status`: `locked`: no user gesture has started output yet. `running`: sounds play. `suspended`: the page is hidden, or the game stopped, after output had started. `unavailable`: the backend cannot play.
- `muted`: Silences everything. Not saved by the engine: store it with `fenrir-ts` storage if the game keeps it.
- `volume`: Master volume, 0 to 1.
- `buses`: Each bus's volume and mute, by name.
- `playing`: Instances sounding now, by sound name. A sound that is not playing is absent.
- `queued`: Looping sounds asked for while output was not running, which start when it runs.
- `dropped`: One-shots dropped because output was not running or their sample was not loaded.

### AudioUnlocked

```ts
const AudioUnlocked: EventType<Record<string, never>>;
```

Sent once per game, when output first runs: after the first user gesture, or at startup where autoplay is allowed.

## Types

### AudioBackend

```ts
interface AudioBackend {
    readonly name: string;
    canAutoplay(): boolean;
    start(): boolean | Promise<boolean>;
    suspend(): void;
    setVolume(bus: string | null, volume: number): void;
    play(request: VoiceRequest): AudioVoice;
    decode(data: ArrayBuffer): Promise<AudioClip>;
}
```

Where sounds go: `webAudio()` by default, `testAudio()` in tests, or a host app's own output.
The engine decides what plays and when; a backend only does it.

Members:

- `canAutoplay`: Whether output may start without a user gesture. Asked when each run starts.
- `start`: Starts or resumes output. Called inside a user gesture, so it must ask the platform for output synchronously, and again when the page shows. Returns, or resolves to, whether output runs. Throws if the platform has no audio at all.
- `suspend`: Pauses output, keeping each voice where it is: the page was hidden or the game stopped.
- `setVolume`: Sets the volume of `bus`, or the master volume when `bus` is null. Called before `start` too.
- `play`: Starts a voice. Called only while output runs.
- `decode`: Decodes a fetched audio file, for the `audio` asset loader.

### AudioBus

```ts
interface AudioBus {
    volume: number;
    muted: boolean;
}
```

One bus in `AudioState`.

### AudioClip

```ts
interface AudioClip {
    readonly duration: number;
}
```

A decoded sample: an `AudioBuffer` from the Web Audio backend.

Members:

- `duration`: Seconds.

### AudioCtx

```ts
type AudioCtx = {
    readonly resources: Resources;
};
```

What the audio functions need: a `SystemCtx`, or the `Game` or `TestGame` itself.

### AudioOptions

```ts
interface AudioOptions {
    buses?: readonly string[];
    backend?: AudioBackend;
}
```

What the `audio()` plugin takes: bus names and the backend (`webAudio()` by default, `testAudio()` in tests).

Members:

- `buses`: Bus names. Defaults to `["sfx", "music"]`.
- `backend`: Defaults to `webAudio()`. Pass `testAudio()` in tests.

### AudioVoice

```ts
interface AudioVoice {
    stop(fade: number): void;
    onended: (() => void) | null;
}
```

A sound the backend is playing.

Members:

- `stop`: Fades out over `fade` seconds, then stops. 0 stops at once.
- `onended`: Set by the engine. The backend calls it once, when the voice has ended or been stopped.

### NoParams

```ts
type NoParams = Record<never, never>;
```

No per-play parameters: the default for a `Synth`, and what a sample sound has.

### PlayedSound

```ts
interface PlayedSound {
    sound: string;
    bus: string;
    volume: number;
    rate: number;
    loop: boolean;
    synth: boolean;
    params: Record<string, unknown>;
    ended: boolean;
    fade: number | null;
}
```

One voice the test backend was asked to play, in order.

Members:

- `volume`: The sound's volume times the play's: bus and master volumes are in `volumes`.
- `synth`: True for a synthesized sound. Its synth is not run: there is no context.
- `params`: The synth's parameters for this play: the sound's `params` with the play's laid over them. `{}` for a sample.
- `ended`: True once it ended on its own (`finish`) or was stopped.
- `fade`: The fade it was stopped with, or null while it plays or when it ended on its own.

### PlayOptions

```ts
interface PlayOptions<P extends object = NoParams> {
    volume?: number;
    rate?: number;
    params?: NoParams extends P ? never : Partial<NoInfer<P>>;
}
```

One play's options.

Members:

- `volume`: Multiplies the sound's volume. Defaults to 1.
- `rate`: Playback rate: 2 is an octave up and twice as fast. Defaults to 1.
- `params`: This play's parameters for a synth sound, laid over the sound's `params`: pass only the fields that differ. Typed from the sound's synth. A sample sound, or a synth without parameters, takes none.

### SoundOptions

```ts
type SoundOptions<P extends object = NoParams> = (SoundBase & {
    sample: string;
    synth?: never;
    params?: never;
}) | (SoundBase & {
    synth: Synth<P>;
    sample?: never;
} & ParamsOption<P>);
```

What `defineSound` takes: a `sample` (an `audio` asset name) or a `synth`, plus bus, volume, loop and voice limit.

### SoundType

```ts
interface SoundType<P extends object = NoParams> {
    readonly name: string;
    readonly sample: string | null;
    readonly synth: Synth<P> | null;
    readonly params: Readonly<P>;
    readonly bus: string;
    readonly volume: number;
    readonly loop: boolean;
    readonly limit: number;
}
```

A sound, made by `defineSound`. Plain data apart from `synth`. `P` is its synth's parameters,
which `playSound` takes as `params`; a sample sound, or a synth without parameters, has `NoParams`.

Members:

- `name`: Namespaced, such as `myGame.tap`. Counts in `AudioState.playing` are by this name.
- `sample`: The audio asset it plays, by its name in a manifest, or null for a synthesized sound.
- `params`: The synth's parameters for a play that passes none: `params` from `defineSound`, frozen. `{}` for a sample.
- `volume`: 0 to 1 and above, multiplied by each play's volume.
- `loop`: Repeats until stopped. A looping sound plays once at a time: playing it again while it plays does nothing.
- `limit`: Instances that may sound at once. Playing one more stops the oldest.

### Synth

```ts
type Synth<P extends object = NoParams> = (audio: AudioContext, output: AudioNode, play: {
    readonly rate: number;
    readonly params: Readonly<P>;
}) => AudioScheduledSourceNode;
```

Builds a synthesized sound on the context: creates its nodes, connects the last to `output`,
starts them and returns the source that ends last, so the engine knows when the sound ended and
can stop it. `rate` is the play's rate, 1 by default; scale frequencies by it if it matters.

`params` are the play's parameters, typed by `P`: the sound's `params` from `defineSound`, with
the fields `playSound` passed laid over them. So one sound plays in several variants (a pitch
per combo step, a timbre per pickup) instead of one sound per variant.

```ts
const blip: Synth = (audio, output, { rate }) => {
  const osc = audio.createOscillator();
  osc.frequency.value = 880 * rate;
  osc.connect(output);
  osc.start();
  osc.stop(audio.currentTime + 0.08);
  return osc;
};
const tone: Synth<{ hz: number; length: number }> = (audio, output, { params }) => {
  const osc = audio.createOscillator();
  osc.frequency.value = params.hz;
  osc.connect(output);
  osc.start();
  osc.stop(audio.currentTime + params.length);
  return osc;
};
```

### TestAudio

```ts
interface TestAudio extends AudioBackend {
    readonly played: PlayedSound[];
    readonly volumes: Record<string, number>;
    readonly running: boolean;
    finish(sound?: string): void;
}
```

An audio backend with no Web Audio, for `createTestGame`. Records what plays.

Members:

- `played`: Every voice played, oldest first.
- `volumes`: The volumes the engine set: `master`, then each bus by name. Muted is 0.
- `running`: Whether output runs: started and not suspended.
- `finish`: Ends playing voices as if their samples finished: all of them, or those of `sound`.

### TestAudioOptions

```ts
interface TestAudioOptions {
    autoplay?: boolean;
    unavailable?: boolean;
}
```

What `testAudio()` takes: whether it can autoplay, or is unavailable.

Members:

- `autoplay`: Output may start without a gesture, as where autoplay is allowed. Defaults to false: locked until a gesture.
- `unavailable`: The platform has no audio: `start` throws, and the engine reports `unavailable`. Defaults to false.

### VoiceRequest

```ts
interface VoiceRequest {
    readonly sound: string;
    readonly bus: string;
    readonly clip: AudioClip | null;
    readonly synth: Synth<object> | null;
    readonly params?: Readonly<Record<string, unknown>>;
    readonly volume: number;
    readonly rate: number;
    readonly loop: boolean;
}
```

What the backend is asked to play.

Members:

- `clip`: The decoded sample, for a sample sound.
- `params`: The synth's parameters for this play: the sound's `params` with the play's laid over them. The engine always sets it (`{}` for a sample); optional so requests built by hand still type-check.
- `volume`: The sound's volume times the play's.

## Added to core types when imported

Importing `fenrir-ts/audio` adds these members to core types for the whole program.

### AssetKinds

```ts
interface AssetKinds {
    audio: AudioClip;
}
```

- `audio`: A decoded sample, loaded by the `audio()` plugin's loader. Declared in a manifest as `{ kind: "audio", src }`.

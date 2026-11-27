import type { AudioBackend, AudioClip } from "./Audio";

/** One voice the test backend was asked to play, in order. */
export interface PlayedSound {
  sound: string;
  bus: string;
  /** The sound's volume times the play's: bus and master volumes are in `volumes`. */
  volume: number;
  rate: number;
  loop: boolean;
  /** True for a synthesized sound. Its synth is not run: there is no context. */
  synth: boolean;
  /** The synth's parameters for this play: the sound's `params` with the play's laid over them. `{}` for a sample. */
  params: Record<string, unknown>;
  /** True once it ended on its own (`finish`) or was stopped. */
  ended: boolean;
  /** The fade it was stopped with, or null while it plays or when it ended on its own. */
  fade: number | null;
}

/** An audio backend with no Web Audio, for `createTestGame`. Records what plays. */
export interface TestAudio extends AudioBackend {
  /** Every voice played, oldest first. */
  readonly played: PlayedSound[];
  /** The volumes the engine set: `master`, then each bus by name. Muted is 0. */
  readonly volumes: Record<string, number>;
  /** Whether output runs: started and not suspended. */
  readonly running: boolean;
  /** Ends playing voices as if their samples finished: all of them, or those of `sound`. */
  finish(sound?: string): void;
}

/** What `testAudio()` takes: whether it can autoplay, or is unavailable. */
export interface TestAudioOptions {
  /** Output may start without a gesture, as where autoplay is allowed. Defaults to false: locked until a gesture. */
  autoplay?: boolean;
  /** The platform has no audio: `start` throws, and the engine reports `unavailable`. Defaults to false. */
  unavailable?: boolean;
}

/**
 * A backend for tests: no Web Audio, nothing is heard. Output is locked until a gesture
 * (`game.input.pointerDown`, `pointerUp` or `press` in a test game) unless `autoplay` is set, and
 * starts synchronously. Decoding returns a clip with `duration: 1`.
 *
 * @example
 * const sounds = testAudio();
 * const game = await createTestGame({ seed: 1, plugins: [audio({ backend: sounds })] });
 * await game.start();
 * game.input.pointerDown(10, 10); // the first gesture unlocks output
 * game.step();
 * expect(sounds.played.map((p) => p.sound)).toEqual(["myGame.tap"]);
 */
export function testAudio(options: TestAudioOptions = {}): TestAudio {
  const played: PlayedSound[] = [];
  const volumes: Record<string, number> = {};
  const ends = new Map<PlayedSound, () => void>();
  let running = false;
  return {
    name: "test",
    played,
    volumes,
    get running() {
      return running;
    },
    canAutoplay: () => options.autoplay === true,
    start() {
      if (options.unavailable) throw new Error("no audio in this test");
      return (running = true);
    },
    suspend() {
      running = false;
    },
    setVolume(bus, volume) {
      volumes[bus ?? "master"] = volume;
    },
    play({ sound, bus, synth, params, volume, rate, loop }) {
      const entry: PlayedSound = { sound, bus, volume, rate, loop, synth: synth !== null, params: { ...params }, ended: false, fade: null };
      played.push(entry);
      const voice = {
        onended: null as (() => void) | null,
        stop(fade: number) {
          if (entry.ended) return;
          entry.fade = fade;
          end();
        },
      };
      const end = (): void => {
        entry.ended = true;
        ends.delete(entry);
        voice.onended?.();
      };
      ends.set(entry, end);
      return voice;
    },
    finish(sound) {
      for (const [entry, end] of [...ends]) if (sound === undefined || entry.sound === sound) end();
    },
    decode: async (): Promise<AudioClip> => ({ duration: 1 }),
  };
}

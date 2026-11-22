import type { AudioBackend, AudioClip, AudioVoice } from "./Audio";

const noop = (): void => {};

/**
 * The default audio backend: one `AudioContext`, a gain node per bus into a master gain node.
 * The context is created inside the first `start()`, which the engine calls inside a user
 * gesture, so no browser warns that it was not allowed to start. Samples decoded before then
 * decode on an `OfflineAudioContext`.
 */
export function webAudio(): AudioBackend {
  let context: AudioContext | undefined;
  let decoder: BaseAudioContext | undefined;
  let master: GainNode | undefined;
  const buses = new Map<string, GainNode>();
  const levels = new Map<string | null, number>();

  const gain = (target: AudioNode, volume = 1): GainNode => {
    const node = context!.createGain();
    node.gain.value = volume;
    node.connect(target);
    return node;
  };
  const bus = (name: string): GainNode => {
    let node = buses.get(name);
    if (!node) buses.set(name, (node = gain(master!, levels.get(name))));
    return node;
  };

  return {
    name: "webAudio",

    canAutoplay: () =>
      (globalThis.navigator as { getAutoplayPolicy?(type: string): string } | undefined)?.getAutoplayPolicy?.("audiocontext") === "allowed",

    start() {
      if (!context) {
        const Context = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) throw new Error("this browser has no Web Audio");
        context = new Context();
        master = gain(context.destination, levels.get(null));
      }
      if (context.state === "running") return true;
      // Older WebKit unlocks only when a source starts inside the gesture: a silent one-sample buffer.
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, 22050);
      silent.connect(context.destination);
      silent.start();
      const started = context;
      return started.resume().then(() => started.state === "running");
    },

    suspend() {
      void context?.suspend().catch(noop);
    },

    setVolume(name, volume) {
      levels.set(name, volume);
      const node = name === null ? master : buses.get(name);
      // A short ramp, so a mute or volume change does not click.
      node?.gain.setTargetAtTime(volume, context!.currentTime, 0.015);
    },

    play({ bus: busName, clip, synth, volume, rate, loop }) {
      const audio = context!;
      const output = gain(bus(busName), volume);
      let source: AudioScheduledSourceNode;
      if (synth) {
        source = synth(audio, output, { rate });
      } else {
        const buffer = audio.createBufferSource();
        buffer.buffer = clip as AudioBuffer;
        buffer.loop = loop;
        buffer.playbackRate.value = rate;
        buffer.connect(output);
        buffer.start();
        source = buffer;
      }
      const voice: AudioVoice = {
        onended: null,
        stop(fade) {
          const now = audio.currentTime;
          if (fade > 0) {
            output.gain.setValueAtTime(output.gain.value, now);
            output.gain.linearRampToValueAtTime(0, now + fade);
          }
          try {
            source.stop(now + fade);
          } catch {
            // Already stopped.
          }
        },
      };
      source.addEventListener("ended", () => {
        output.disconnect();
        voice.onended?.();
      });
      return voice;
    },

    decode(data): Promise<AudioClip> {
      return (context ?? (decoder ??= new OfflineAudioContext(1, 1, 44100))).decodeAudioData(data);
    },
  };
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { webAudio } from "@/core/Audio/WebAudio";

/** Just enough of Web Audio to follow the node graph the backend builds. */
class FakeParam {
  value = 1;
  setTargetAtTime = vi.fn((value: number) => void (this.value = value));
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
}
class FakeNode extends EventTarget {
  connected: unknown[] = [];
  connect(target: unknown) {
    this.connected.push(target);
  }
  disconnect = vi.fn();
}
class FakeGain extends FakeNode {
  gain = new FakeParam();
}
class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  playbackRate = new FakeParam();
  start = vi.fn();
  stop = vi.fn();
}
class FakeContext {
  static created: FakeContext[] = [];
  state = "suspended";
  currentTime = 2;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  constructor() {
    FakeContext.created.push(this);
  }
  createGain() {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }
  createBufferSource() {
    const node = new FakeSource();
    this.sources.push(node);
    return node;
  }
  createBuffer = vi.fn(() => ({}));
  createOscillator() {
    return this.createBufferSource();
  }
  resume = vi.fn(async () => void (this.state = "running"));
  suspend = vi.fn(async () => void (this.state = "suspended"));
  decodeAudioData = vi.fn(async () => ({ duration: 2 }));
}
class FakeOffline {
  static created = 0;
  constructor() {
    FakeOffline.created++;
  }
  decodeAudioData = vi.fn(async () => ({ duration: 3 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeContext.created = [];
  FakeOffline.created = 0;
});

describe("webAudio()", () => {
  it("creates its context in start(), plays a silent buffer and resumes inside the gesture", async () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const backend = webAudio();
    backend.setVolume(null, 0.5);
    expect(FakeContext.created).toHaveLength(0);
    const started = backend.start();
    const context = FakeContext.created[0]!;
    expect(context.resume).toHaveBeenCalledOnce();
    expect(context.sources[0]!.start).toHaveBeenCalled();
    await expect(started).resolves.toBe(true);
    expect(backend.start()).toBe(true);
    // Master gain was created at the volume set before the context existed.
    expect(context.gains[0]!.gain.value).toBe(0.5);
    expect(context.gains[0]!.connected).toEqual([context.destination]);
  });

  it("decodes on an OfflineAudioContext before start, so no context is created outside a gesture", async () => {
    vi.stubGlobal("AudioContext", FakeContext);
    vi.stubGlobal("OfflineAudioContext", FakeOffline);
    const backend = webAudio();
    await expect(backend.decode(new ArrayBuffer(4))).resolves.toEqual({ duration: 3 });
    expect(FakeContext.created).toHaveLength(0);
    await backend.start();
    await expect(backend.decode(new ArrayBuffer(4))).resolves.toEqual({ duration: 2 });
    expect(FakeOffline.created).toBe(1);
  });

  it("plays a sample through a voice gain into its bus, and fades it out on stop", async () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const backend = webAudio();
    await backend.start();
    const context = FakeContext.created[0]!;
    const clip = { duration: 1 };
    const voice = backend.play({ sound: "s", bus: "sfx", clip, synth: null, volume: 0.25, rate: 1.5, loop: true });
    const source = context.sources.at(-1)!;
    const [master, bus, output] = context.gains;
    expect(source).toMatchObject({ buffer: clip, loop: true, playbackRate: { value: 1.5 } });
    expect(source.connected).toEqual([output]);
    expect(output!.gain.value).toBe(0.25);
    expect(output!.connected).toEqual([bus]);
    expect(bus!.connected).toEqual([master]);

    voice.stop(0.5);
    expect(output!.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 2.5);
    expect(source.stop).toHaveBeenCalledWith(2.5);
    const ended = vi.fn();
    voice.onended = ended;
    source.dispatchEvent(new Event("ended"));
    expect(ended).toHaveBeenCalledOnce();
    expect(output!.disconnect).toHaveBeenCalled();
  });

  it("hands a synth the context, the voice's output and the rate", async () => {
    vi.stubGlobal("AudioContext", FakeContext);
    const backend = webAudio();
    await backend.start();
    const synth = vi.fn((audio: AudioContext) => audio.createOscillator());
    backend.play({ sound: "s", bus: "sfx", clip: null, synth, volume: 1, rate: 2, loop: false });
    const context = FakeContext.created[0]!;
    expect(synth).toHaveBeenCalledWith(context, context.gains.at(-1), { rate: 2 });
  });

  it("throws from start when there is no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => webAudio().start()).toThrow(/no Web Audio/);
  });
});

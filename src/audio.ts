/**
 * Fenrir-TS audio: the `fenrir-ts/audio` entry point. No peer packages: Web Audio only.
 *
 * Importing it adds, for this program, the `audio` asset kind (a decoded `AudioClip`), so a
 * manifest can declare samples as `{ kind: "audio", src }` and preload them with progress. The
 * loader itself is registered by the `audio()` plugin when it installs.
 */
export { audio, defineSound, playSound, stopSound, unlockAudio, AudioState, AudioUnlocked } from "./core/Audio/Audio";
export type {
  AudioBackend,
  AudioBus,
  AudioClip,
  AudioCtx,
  AudioOptions,
  AudioVoice,
  PlayOptions,
  SoundOptions,
  SoundType,
  Synth,
  VoiceRequest,
} from "./core/Audio/Audio";
export { webAudio } from "./core/Audio/WebAudio";
export { testAudio } from "./core/Audio/TestAudio";
export type { PlayedSound, TestAudio, TestAudioOptions } from "./core/Audio/TestAudio";

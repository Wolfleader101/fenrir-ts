import { defineComponent } from "../ECS";
import type { AssetKey } from "../Assets/AssetStore";

export type Animation = {
  /** The asset key containing the animations */
  assetKey: AssetKey;

  /** Name of the animation to play (from the GLTF animations array) */
  animationName?: string;

  /** Animation index to play (alternative to name) */
  animationIndex?: number;

  /** Whether the animation is currently playing */
  playing: boolean;

  /** Loop the animation */
  loop: boolean;

  /** Animation speed multiplier */
  speed: number;

  /** Time scale for the animation */
  timeScale: number;

  /** Whether to auto-play on component add */
  autoPlay: boolean;

  /** Animation weight (for blending multiple animations) */
  weight: number;

  /** Fade in/out duration in seconds */
  fadeDuration?: number;
};

export const Animation = defineComponent<Animation>("Animation");

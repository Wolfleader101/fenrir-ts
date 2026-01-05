import type { AssetKey } from "@/core/Assets/AssetStore";
import { Animation } from "@/core/Animation";
import { EntityBuilder } from "..";

export type AnimateOpts = Partial<{
  animationName: string;
  animationIndex: number;
  playing: boolean;
  loop: boolean;
  speed: number;
  timeScale: number;
  autoPlay: boolean;
  weight: number;
  fadeDuration: number;
}>;

declare module "../EntityBuilder" {
  interface EntityBuilder {
    animate(assetKey: AssetKey, opts?: AnimateOpts): EntityBuilder;
    play(): EntityBuilder;
    pause(): EntityBuilder;
  }
}

EntityBuilder.extend({
  animate(this: EntityBuilder, assetKey: AssetKey, opts?: AnimateOpts) {
    return this.with(Animation, {
      assetKey,
      animationName: opts?.animationName,
      animationIndex: opts?.animationIndex,
      playing: opts?.playing ?? true,
      loop: opts?.loop ?? true,
      speed: opts?.speed ?? 1,
      timeScale: opts?.timeScale ?? 1,
      autoPlay: opts?.autoPlay ?? true,
      weight: opts?.weight ?? 1,
      fadeDuration: opts?.fadeDuration ?? 0.3,
    });
  },
});

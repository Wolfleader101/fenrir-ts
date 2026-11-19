import { Scene } from "../Scene";
import type { SkyboxDescriptor } from "./SkyboxDescriptor";

// The skybox members of Scene. They live here, loaded by `fenrir-ts/3d` and the skybox code,
// so that core's Scene, which every 2D bundle ships, carries none of them.
declare module "../Scene" {
  interface Scene {
    /** This scene's skybox, read by the skybox system. Set it with `setSkybox`. */
    skybox?: SkyboxDescriptor;
    /** Sets the skybox for this scene, or removes it with `undefined`. */
    setSkybox(skybox: SkyboxDescriptor | undefined): void;
    /** Removes the skybox from this scene. */
    removeSkybox(): void;
    /** Whether this scene has a skybox that is not disabled. */
    hasSkybox(): boolean;
  }
}

Scene.prototype.setSkybox = function setSkybox(this: Scene, skybox: SkyboxDescriptor | undefined): void {
  this.skybox = skybox;
};

Scene.prototype.removeSkybox = function removeSkybox(this: Scene): void {
  this.skybox = undefined;
};

Scene.prototype.hasSkybox = function hasSkybox(this: Scene): boolean {
  return this.skybox !== undefined && (this.skybox.enabled ?? true);
};

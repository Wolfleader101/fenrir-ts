import { EntityList } from "./ECS";
import type { SkyboxDescriptor } from "./Skybox/SkyboxComponents";

export class Scene {
  public name: string;
  public readonly entityList: EntityList;
  public skybox?: SkyboxDescriptor;

  constructor(name: string) {
    this.name = name;
    this.entityList = new EntityList();
  }

  /**
   * Set the skybox for this scene
   */
  setSkybox(skybox: SkyboxDescriptor | undefined): void {
    this.skybox = skybox;
  }

  /**
   * Remove the skybox from this scene
   */
  removeSkybox(): void {
    this.skybox = undefined;
  }

  /**
   * Check if this scene has a skybox
   */
  hasSkybox(): boolean {
    return this.skybox !== undefined && (this.skybox.enabled ?? true);
  }
}

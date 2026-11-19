import { EntityList } from "./ECS";

/**
 * A named set of entities. `fenrir-ts/3d` adds the skybox members (`skybox`, `setSkybox`,
 * `removeSkybox`, `hasSkybox`) when it is imported.
 */
export class Scene {
  public name: string;
  public readonly entityList: EntityList;

  constructor(name: string) {
    this.name = name;
    this.entityList = new EntityList();
  }
}

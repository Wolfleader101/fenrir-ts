import { EntityList } from "./ECS";

export class Scene {
  public name: string;
  public readonly entityList: EntityList;

  constructor(name: string) {
    this.name = name;
    this.entityList = new EntityList();
  }
}

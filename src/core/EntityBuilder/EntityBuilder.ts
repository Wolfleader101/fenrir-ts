import type { Entity, EntityList, ComponentType } from "../ECS";

type ValueOrFactory<T> = T | ((e: Entity, entities: EntityList) => T);

type WithOp = {
  type: ComponentType<any>;
  make: (e: Entity, entities: EntityList) => any;
};

export class EntityBuilder {
  private readonly ops: WithOp[] = [];
  private readonly children: EntityBuilder[] = [];

  private constructor() {}

  public static create(): EntityBuilder {
    return new EntityBuilder();
  }

  public with<T>(type: ComponentType<T>, value: ValueOrFactory<T>): this {
    const make =
      typeof value === "function"
        ? (value as (e: Entity, entities: EntityList) => T)
        : () => value;

    this.ops.push({ type, make });
    return this;
  }

  /**
   * Add a child prefab.
   * You can pass an existing EntityBuilder or a builder callback.
   */
  public child(child: EntityBuilder | ((p: EntityBuilder) => void)): this {
    const p = child instanceof EntityBuilder ? child : EntityBuilder.create();
    if (!(child instanceof EntityBuilder)) child(p);
    this.children.push(p);
    return this;
  }

  /**
   * Spawns a root entity (no parent)
   */
  public spawn(entities: EntityList): Entity {
    const e = entities.createEntity();
    this.applyTo(e, entities);

    for (const childPrefab of this.children) {
      const c = childPrefab.spawn(entities);
      entities.addChild(e, c);
    }
    return e;
  }

  /**
   * Spawns and parents under an existing entity
   */
  public spawnInto(entities: EntityList, parent: Entity): Entity {
    const e = this.spawn(entities);
    entities.addChild(parent, e);
    return e;
  }

  private applyTo(e: Entity, entities: EntityList) {
    for (const op of this.ops) {
      const component = op.make(e, entities);
      entities.set(e, op.type, component);
    }
  }

  public static extend<T extends Record<string, any>>(methods: T): void {
    Object.assign(this.prototype, methods);
  }
}

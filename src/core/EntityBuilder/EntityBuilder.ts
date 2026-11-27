import type { Entity, EntityList, ComponentType } from "../ECS";
import { Name, Transform, createDefaultTransform, type QuatLike, type Vec3Like } from "../ECS/DefaultComponents";
import { Display2D } from "../ECS/Display2D";
import { Transform2D } from "../ECS/Transform2D";

type ValueOrFactory<T> = T | ((e: Entity, entities: EntityList) => T);

type WithOp = {
  type: ComponentType<any>;
  make: (e: Entity, entities: EntityList) => any;
};

/**
 * Builds an entity from components, then `spawn(ctx.entities)`. Add any component with
 * `with(type, value)`, such as `with(PixiNode, { node, layer })` from `fenrir-ts/2d` or
 * `with(PhysicsShape, ShapeBuilder.box(halfExtents))` from `fenrir-ts/physics`. The frozen
 * `fenrir-ts/3d` entry still adds its own methods when imported.
 */
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
   * Modify an existing component on the entity.
   * If the component doesn't exist, it will be created with the modifier function.
   */
  public modify<T>(
    type: ComponentType<T>,
    modifier: (existing: T | undefined, e: Entity, entities: EntityList) => T
  ): this {
    const make = (e: Entity, entities: EntityList): T => {
      const existing = entities.has(e, type)
        ? entities.get(e, type)
        : undefined;
      return modifier(existing, e, entities);
    };

    this.ops.push({ type, make });
    return this;
  }

  /** Adds the engine's `Transform`. Defaults come from the installed factory: Three objects once fenrir-ts/3d is loaded. */
  public transform(pos?: Vec3Like, rot?: QuatLike, scale?: Vec3Like): this {
    const defaults = createDefaultTransform();
    return this.with(Transform, {
      position: pos ?? defaults.position,
      rotation: rot ?? defaults.rotation,
      scale: scale ?? defaults.scale,
    });
  }

  /** Adds the engine's `Name`. */
  public name(value: string): this {
    return this.with(Name, { name: value });
  }

  /** Adds `Transform2D`: `x`, `y` in logical units, `rotation` in radians, scale 1 unless given. */
  public transform2D(x = 0, y = 0, options: { rotation?: number; scaleX?: number; scaleY?: number } = {}): this {
    // A factory, so every spawn gets its own object.
    return this.with(Transform2D, () => ({ x, y, rotation: options.rotation ?? 0, scaleX: options.scaleX ?? 1, scaleY: options.scaleY ?? 1 }));
  }

  /** Adds `Display2D`: `alpha` 1 and `visible` true unless given. */
  public display2D({ alpha = 1, visible = true }: { alpha?: number; visible?: boolean } = {}): this {
    return this.with(Display2D, () => ({ alpha, visible }));
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

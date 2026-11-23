/**
 * A typed handle to a resource: one value of type `T` per game. Made by `defineResource`.
 * The name is the identity: two handles with the same name read and write the same value.
 */
export interface ResourceType<T> {
  readonly name: string;
  /** Carries `T` in the type only. There is no value at runtime. */
  readonly __resource?: (value: T) => T;
}

// Factories live here, not on the handle, so the handle stays a plain `{ name }`.
const factories = new WeakMap<object, () => unknown>();

/**
 * Defines a resource: a single value of type `T` that one game owns. Read it with
 * `ctx.resources.get(Resource)` and replace it with `ctx.resources.set(Resource, value)`.
 *
 * `factory` runs once per game, on the first `get`, and again after the engine resets.
 * Without a factory, `get` throws until a value is set.
 *
 * As with components, the name is the identity: two calls with the same name share one value
 * in each game. Prefix names with a namespace for your game or library. Names starting with
 * `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
 * export const Seed = defineResource<number>("myGame.seed"); // set before use
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineResource<T>(name: string, factory?: () => T): ResourceType<T> {
  const resource: ResourceType<T> = Object.freeze({ name });
  if (factory) factories.set(resource, factory);
  return resource;
}

/**
 * The resources of one game: `game.resources` and `ctx.resources` are the same object.
 * Values are kept until the engine resets; stopping and running again keeps them.
 */
export class Resources {
  private readonly values = new Map<string, unknown>();
  private readonly creating = new Set<string>();

  /** Returns the resource's value, running its factory on first use. */
  public get<T>(resource: ResourceType<T>): T {
    const { name } = resource;
    if (this.values.has(name)) return this.values.get(name) as T;

    const factory = factories.get(resource);
    if (!factory) {
      throw new Error(
        `Resource "${name}" has no value. It has no factory, so set it before it is read: ` +
          `call game.resources.set before game.run(), or ctx.resources.set in an earlier system. ` +
          `Or pass a factory: defineResource("${name}", () => value).`,
      );
    }
    if (this.creating.has(name)) {
      throw new Error(`The factory of resource "${name}" reads "${name}". A factory cannot read its own resource.`);
    }

    this.creating.add(name);
    try {
      const value = factory() as T;
      this.values.set(name, value);
      return value;
    } finally {
      this.creating.delete(name);
    }
  }

  /**
   * Whether the resource has a value: set, or made by its factory on an earlier `get`. Never
   * runs the factory. A plugin's resource (`AudioState`, `MotionSettings`, `StorageStatus`)
   * has a value once the plugin is installed, so this is how game code and tests ask whether an
   * optional plugin is there before using it.
   *
   * @example
   * if (resources.has(AudioState)) resources.get(AudioState).muted = true;
   */
  public has<T>(resource: ResourceType<T>): boolean {
    return this.values.has(resource.name);
  }

  /** Replaces the resource's value. Works before `game.run()` and from any system. */
  public set<T>(resource: ResourceType<T>, value: NoInfer<T>): void {
    this.values.set(resource.name, value);
  }
}

/** Drops every value, so factories run again on next use. Called by `Engine.reset`. Internal. */
export function clearResources(resources: Resources): void {
  resources["values"].clear();
}

/** The resource's value if it has one, without running its factory. Internal. */
export function peekResource<T>(resources: Resources, resource: ResourceType<T>): T | undefined {
  return resources["values"].get(resource.name) as T | undefined;
}

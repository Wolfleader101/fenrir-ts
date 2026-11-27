/** A typed component key, made by `defineComponent<T>(name)`. */
export type ComponentType<T> = symbol & { __component?: T };

/**
 * Defines a component type. The name is the component's identity: two calls
 * with the same name return the same type and share storage. That keeps a
 * component stable across hot module reloads and across two copies of the
 * engine in one bundle.
 *
 * Because identity is global, prefix names with a namespace for your game or
 * library. Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export type Health = { current: number; max: number };
 * export const Health = defineComponent<Health>("myGame.Health");
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineComponent<T>(name: string): ComponentType<T> {
  return Symbol.for(`component:${name}`) as ComponentType<T>;
}

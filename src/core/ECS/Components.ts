export type ComponentType<T> = symbol & { __component?: T };

export function defineComponent<T>(name: string): ComponentType<T> {
  return Symbol.for(`component:${name}`) as ComponentType<T>;
}

// Usage
// export type Position = { x: number; y: number };
// export const Position = defineComponent<Position>("Position");

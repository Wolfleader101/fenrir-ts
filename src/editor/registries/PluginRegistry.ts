import type { SandboxPlugin } from "../SandboxProvider";

export interface PluginRegistry {
  register(name: string, plugin: SandboxPlugin): void;
  unregister(name: string): void;
  get(name: string): SandboxPlugin | undefined;
  getAll(): SandboxPlugin[];
  has(name: string): boolean;
}

export const createPluginRegistry = (): PluginRegistry => {
  const plugins = new Map<string, SandboxPlugin>();

  return {
    register(name, plugin) {
      if (plugins.has(name)) {
        throw new Error(`Plugin '${name}' is already registered`);
      }
      plugins.set(name, plugin);
    },

    unregister(name) {
      plugins.delete(name);
    },

    get(name) {
      return plugins.get(name);
    },

    getAll() {
      return Array.from(plugins.values());
    },

    has(name) {
      return plugins.has(name);
    },
  };
};

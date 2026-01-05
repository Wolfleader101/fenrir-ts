import { defineComponent } from "../ECS";
import type { AssetKey } from "../Assets/AssetStore";
import type { EntityBuilder } from "../EntityBuilder/EntityBuilder";

export type GeometryDesc =
  | { kind: "box"; size?: [number, number, number] } // default 1,1,1
  | { kind: "plane"; size?: [number, number] } // default 1,1
  | { kind: "sphere"; radius?: number; widthSeg?: number; heightSeg?: number }
  | { kind: "model"; key: AssetKey }; // File-based model loading

export type MaterialDesc =
  | { kind: "standard"; color?: number; roughness?: number; metalness?: number }
  | { kind: "lambert"; color?: number }
  | { kind: "basic"; color?: number }
  | { kind: "asset"; key: AssetKey } // Load material from asset
  | { kind: "none" }; // Use asset's own material (for Object3D assets)

export type RenderFlags = {
  visible?: boolean; // default true
  castShadow?: boolean; // default false
  receiveShadow?: boolean; // default false
  layer?: number; // default 0
};

/**
 * Primary renderable component — purely data.
 * `id` allows renderer to keep a stable mapping even if you later allow multiple renderables per entity.
 */
export type Renderable = {
  id: number; // stable within an entity; start at 0 for "main mesh"
  geometry: GeometryDesc;
  material: MaterialDesc;
  flags?: RenderFlags;

  /**
   * Optional hint for future batching/instancing:
   * entities with same batchKey could be merged/instanced.
   */
  batchKey?: string;
};

export const Renderable = defineComponent<Renderable>("Renderable");

export type Camera = {
  fov: number;
  near: number;
  far: number;
  active?: boolean;
};

export const Camera = defineComponent<Camera>("Camera");

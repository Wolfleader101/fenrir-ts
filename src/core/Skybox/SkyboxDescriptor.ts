// Plain skybox data. No Three types here: Scene stores a descriptor, and Scene
// is part of the core entry, which must not reference Three.
import type { AssetKey } from "../Assets/AssetStore";

export type SkyboxType = "cubemap" | "equirectangular" | "color";

/**
 * Cube map texture configuration for skybox.
 * Uses standard cube map face naming convention.
 */
export type SkyboxCubemapTextures = {
  readonly posX: AssetKey; // Right face
  readonly negX: AssetKey; // Left face
  readonly posY: AssetKey; // Top face
  readonly negY: AssetKey; // Bottom face
  readonly posZ: AssetKey; // Front face
  readonly negZ: AssetKey; // Back face
};

/**
 * Equirectangular texture configuration for HDR skyboxes.
 */
export type SkyboxEquirectangularTextures = {
  readonly texture: AssetKey; // Single HDR/LDR panoramic texture
};

/**
 * Color configuration for solid color skyboxes.
 */
export type SkyboxColorTextures = {
  readonly color: number; // Hex color value (e.g., 0x87ceeb for sky blue)
};

/**
 * Union type for different skybox texture configurations.
 */
export type SkyboxTextures =
  | SkyboxCubemapTextures
  | SkyboxEquirectangularTextures
  | SkyboxColorTextures;

/**
 * Scene-level skybox descriptor.
 * This is stored directly on Scene objects, not as ECS components.
 */
export type SkyboxDescriptor = {
  readonly type: SkyboxType;
  readonly textures: SkyboxTextures;
  readonly enabled?: boolean; // Whether skybox should render (default: true)
};

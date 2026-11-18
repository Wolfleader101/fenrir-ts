import type { Texture, Color, CubeTexture } from "three";
import type { AssetKey } from "../Assets/AssetStore";

import type {
  SkyboxColorTextures,
  SkyboxCubemapTextures,
  SkyboxDescriptor,
  SkyboxEquirectangularTextures,
  SkyboxTextures,
} from "./SkyboxDescriptor";

export type {
  SkyboxColorTextures,
  SkyboxCubemapTextures,
  SkyboxDescriptor,
  SkyboxEquirectangularTextures,
  SkyboxTextures,
  SkyboxType,
} from "./SkyboxDescriptor";

/**
 * Runtime skybox instance managed by the skybox system.
 * Uses Three.js scene.background for proper skybox rendering.
 * This is the recommended approach per Three.js documentation.
 */
export type SkyboxInstance = {
  readonly background: Texture | CubeTexture | Color; // For scene.background
};

// Helper functions for creating skybox configurations

/**
 * Create a cube map skybox configuration.
 * Follows standard cube map face naming convention.
 */
export function createCubemapSkybox(opts: {
  posX: AssetKey;
  negX: AssetKey;
  posY: AssetKey;
  negY: AssetKey;
  posZ: AssetKey;
  negZ: AssetKey;
  enabled?: boolean;
}): SkyboxDescriptor {
  return {
    type: "cubemap",
    textures: {
      posX: opts.posX,
      negX: opts.negX,
      posY: opts.posY,
      negY: opts.negY,
      posZ: opts.posZ,
      negZ: opts.negZ,
    },
    enabled: opts.enabled ?? true,
  };
}

/**
 * Create an equirectangular skybox configuration.
 * Used for HDR environment maps or panoramic images.
 */
export function createEquirectangularSkybox(opts: {
  texture: AssetKey;
  enabled?: boolean;
}): SkyboxDescriptor {
  return {
    type: "equirectangular",
    textures: {
      texture: opts.texture,
    },
    enabled: opts.enabled ?? true,
  };
}

/**
 * Utility function to check if textures are cube map type.
 */
export function isCubemapTextures(
  textures: SkyboxTextures
): textures is SkyboxCubemapTextures {
  return "posX" in textures;
}

/**
 * Utility function to check if textures are equirectangular type.
 */
export function isEquirectangularTextures(
  textures: SkyboxTextures
): textures is SkyboxEquirectangularTextures {
  return "texture" in textures;
}

/**
 * Utility function to check if textures are color type.
 */
export function isColorTextures(
  textures: SkyboxTextures
): textures is SkyboxColorTextures {
  return "color" in textures;
}

/**
 * Create a color skybox configuration.
 * Uses a solid color background instead of textures.
 */
export function createColorSkybox(opts: {
  color: number;
  enabled?: boolean;
}): SkyboxDescriptor {
  return {
    type: "color",
    textures: {
      color: opts.color,
    },
    enabled: opts.enabled ?? true,
  };
}

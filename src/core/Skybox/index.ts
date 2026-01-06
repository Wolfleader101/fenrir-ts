// Skybox system exports
export * from "./SkyboxComponents";
export * from "./SkyboxSystem";
export * from "./SkyboxUtils";

// Re-export commonly used types for convenience
export type {
  SkyboxDescriptor,
  SkyboxInstance,
  SkyboxType,
  SkyboxTextures,
  SkyboxCubemapTextures,
  SkyboxEquirectangularTextures,
  SkyboxColorTextures,
} from "./SkyboxComponents";

export {
  createCubemapSkybox,
  createEquirectangularSkybox,
  createColorSkybox,
  isCubemapTextures,
  isEquirectangularTextures,
  isColorTextures,
} from "./SkyboxComponents";

export type { SkyboxSystemOptions } from "./SkyboxSystem";
export { createSkyboxSystem } from "./SkyboxSystem";

export { SkyboxUtils } from "./SkyboxUtils";

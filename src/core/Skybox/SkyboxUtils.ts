import type { AssetKey, IAssetStore } from "../Assets/AssetStore";
import type { Scene } from "../Scene";
import {
  type SkyboxDescriptor,
  createCubemapSkybox,
  createEquirectangularSkybox,
} from "./SkyboxComponents";

/**
 * Utility functions for skybox management and common skybox configurations
 */
export class SkyboxUtils {
  private constructor() {}

  /**
   * Load and set up a cube map skybox for a scene using individual face textures
   */
  static async setupCubemapSkybox(
    scene: Scene,
    assets: IAssetStore,
    options: {
      basePath?: string;
      faces?: {
        posX?: string;
        negX?: string;
        posY?: string;
        negY?: string;
        posZ?: string;
        negZ?: string;
      };
      enabled?: boolean;
    } = {},
  ): Promise<void> {
    const basePath = options.basePath ?? "skybox";
    const faces = options.faces ?? {};

    // Default face mappings
    const faceTextures = {
      posX: `${basePath}/${faces.posX ?? "right.png"}`,
      negX: `${basePath}/${faces.negX ?? "left.png"}`,
      posY: `${basePath}/${faces.posY ?? "top.png"}`,
      negY: `${basePath}/${faces.negY ?? "bottom.png"}`,
      posZ: `${basePath}/${faces.posZ ?? "front.png"}`,
      negZ: `${basePath}/${faces.negZ ?? "back.png"}`,
    };
    // Load all textures
    await Promise.all([
      assets.loadTexture(faceTextures.posX as AssetKey, faceTextures.posX),
      assets.loadTexture(faceTextures.negX as AssetKey, faceTextures.negX),
      assets.loadTexture(faceTextures.posY as AssetKey, faceTextures.posY),
      assets.loadTexture(faceTextures.negY as AssetKey, faceTextures.negY),
      assets.loadTexture(faceTextures.posZ as AssetKey, faceTextures.posZ),
      assets.loadTexture(faceTextures.negZ as AssetKey, faceTextures.negZ),
    ]);

    // Create and set skybox
    const skybox = createCubemapSkybox({
      posX: faceTextures.posX as AssetKey,
      negX: faceTextures.negX as AssetKey,
      posY: faceTextures.posY as AssetKey,
      negY: faceTextures.negY as AssetKey,
      posZ: faceTextures.posZ as AssetKey,
      negZ: faceTextures.negZ as AssetKey,
      enabled: options.enabled,
    });

    scene.setSkybox(skybox);
  }

  /**
   * Load and set up an HDR equirectangular skybox for a scene
   */
  static async setupHdrSkybox(
    scene: Scene,
    assets: IAssetStore,
    texturePath: string,
    options: {
      enabled?: boolean;
    } = {},
  ): Promise<void> {
    const assetKey = texturePath as AssetKey;

    // Load the HDR texture
    await assets.loadTexture(assetKey, texturePath);

    // Create and set skybox
    const skybox = createEquirectangularSkybox({
      texture: assetKey,
      enabled: options.enabled,
    });

    scene.setSkybox(skybox);
  }

  /**
   * Set up the default skybox using the existing textures in public/textures/skybox/
   */
  static async setupDefaultSkybox(
    scene: Scene,
    assets: IAssetStore,
    options: {
      enabled?: boolean;
    } = {},
  ): Promise<void> {
    // Load the default skybox textures
    await this.setupCubemapSkybox(scene, assets, {
      basePath: "textures/skybox",
      faces: {
        posX: "right.png",
        negX: "left.png",
        posY: "top.png",
        negY: "bottom.png",
        posZ: "front.png",
        negZ: "back.png",
      },
      ...options,
    });
  }

  /**
   * Validate skybox descriptor
   */
  static validateSkyboxDescriptor(descriptor: SkyboxDescriptor): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!descriptor.type) {
      errors.push("Skybox type is required");
    }

    if (
      descriptor.type !== "cubemap" &&
      descriptor.type !== "equirectangular" &&
      descriptor.type !== "color"
    ) {
      errors.push(`Invalid skybox type: ${descriptor.type}`);
    }

    if (!descriptor.textures) {
      errors.push("Skybox textures are required");
    } else if (descriptor.type === "cubemap") {
      const cubemapTextures = descriptor.textures as any;
      const requiredFaces = ["posX", "negX", "posY", "negY", "posZ", "negZ"];

      for (const face of requiredFaces) {
        if (!cubemapTextures[face]) {
          errors.push(`Missing cube map face: ${face}`);
        }
      }
    } else if (descriptor.type === "equirectangular") {
      const equiTextures = descriptor.textures as any;
      if (!equiTextures.texture) {
        errors.push("Missing equirectangular texture");
      }
    } else if (descriptor.type === "color") {
      const colorTextures = descriptor.textures as any;
      if (typeof colorTextures.color !== "number") {
        errors.push("Missing or invalid color value");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clone a skybox descriptor
   */
  static cloneSkyboxDescriptor(descriptor: SkyboxDescriptor): SkyboxDescriptor {
    return {
      type: descriptor.type,
      textures: { ...descriptor.textures },
      enabled: descriptor.enabled,
    };
  }
}

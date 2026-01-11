import * as THREE from "three";
import type { AsyncSystemFn, SystemCtx } from "../SystemCtx";
import type { Scene } from "../Scene";
import type { IAssetStore } from "../Assets/AssetStore";
import {
  type SkyboxDescriptor,
  type SkyboxInstance,
  isCubemapTextures,
  isEquirectangularTextures,
  isColorTextures,
} from "./SkyboxComponents";

export type SkyboxSystemOptions = {
  assets: IAssetStore;
};

/**
 * Private SkyboxSystem class that manages scene-level skyboxes
 * Following the class + factory pattern like PhysicsSystem and CameraSystem
 */
class SkyboxSystem {
  private readonly assets: IAssetStore;
  private skyboxInstances = new WeakMap<Scene, SkyboxInstance>();

  constructor(options: SkyboxSystemOptions) {
    this.assets = options.assets;
  }

  /**
   * Initialize skybox system
   */
  async initialize(ctx: SystemCtx): Promise<void> {
    ctx.logger.info("Skybox system initialized");
  }

  /**
   * Pre-update phase: create and update skyboxes for scenes
   */
  async preUpdate(ctx: SystemCtx): Promise<void> {
    const scene = ctx.scene;
    if (!scene.skybox) {
      // Remove existing skybox if scene no longer has one
      this.removeSkyboxFromScene(scene, ctx);
      return;
    }

    // Create or update skybox for the scene
    await this.ensureSkyboxForScene(scene, ctx);
  }

  /**
   * Ensure a scene has the correct skybox instance
   */
  private async ensureSkyboxForScene(
    scene: Scene,
    ctx: SystemCtx
  ): Promise<void> {
    const skyboxDescriptor = scene.skybox!;

    if (!skyboxDescriptor.enabled) {
      this.removeSkyboxFromScene(scene, ctx);
      return;
    }

    // Create new skybox if we don't have one
    if (!this.skyboxInstances.has(scene)) {
      try {
        const instance = await this.createSkyboxInstance(skyboxDescriptor, ctx);
        if (instance) {
          this.skyboxInstances.set(scene, instance);
          ctx.logger.debug(`Created skybox for scene: ${scene.name}`);
        }
      } catch (error) {
        ctx.logger.error(`Failed to create skybox for scene: ${scene.name}`, {
          error,
        });
      }
    }
  }

  /**
   * Create a new skybox instance from descriptor
   */
  private async createSkyboxInstance(
    descriptor: SkyboxDescriptor,
    ctx: SystemCtx
  ): Promise<SkyboxInstance | null> {
    try {
      let background: THREE.Texture | THREE.CubeTexture | THREE.Color;

      if (
        descriptor.type === "cubemap" &&
        isCubemapTextures(descriptor.textures)
      ) {
        const texture = await this.createCubeTexture(descriptor.textures);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.CubeReflectionMapping;
        background = texture;
      } else if (
        descriptor.type === "equirectangular" &&
        isEquirectangularTextures(descriptor.textures)
      ) {
        const texture = await this.createEquirectangularTexture(
          descriptor.textures
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.mapping = THREE.EquirectangularReflectionMapping;
        background = texture;
      } else if (
        descriptor.type === "color" &&
        isColorTextures(descriptor.textures)
      ) {
        background = new THREE.Color(descriptor.textures.color);
      } else {
        throw new Error(`Invalid skybox configuration: ${descriptor.type}`);
      }

      // Use background-only approach (no mesh rendering)
      return {
        background,
      };
    } catch (error) {
      ctx.logger.error("Failed to create skybox instance", { error });
      return null;
    }
  }

  /**
   * Create cube texture from individual face textures
   */
  private async createCubeTexture(textures: any): Promise<THREE.CubeTexture> {
    // Use Three.js CubeTextureLoader for proper format handling
    const loader = new THREE.CubeTextureLoader();

    // Create array of texture paths in the correct order for CubeTextureLoader
    // Order: [positive-x, negative-x, positive-y, negative-y, positive-z, negative-z]
    const urls = [
      textures.posX, // right
      textures.negX, // left
      textures.posY, // top
      textures.negY, // bottom
      textures.posZ, // front
      textures.negZ, // back
    ];

    // Load the cube texture directly
    return new Promise((resolve, reject) => {
      loader.load(
        urls,
        (cubeTexture) => {
          cubeTexture.mapping = THREE.CubeReflectionMapping;
          cubeTexture.flipY = false; // Important: don't flip Y for cube textures
          resolve(cubeTexture);
        },
        undefined, // onProgress
        (error) => {
          reject(error);
        }
      );
    });
  }

  /**
   * Create texture from equirectangular image
   */
  private async createEquirectangularTexture(
    textures: any
  ): Promise<THREE.Texture> {
    const texture = await this.assets.getTexture(textures.texture);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Remove skybox from a scene
   */
  private removeSkyboxFromScene(scene: Scene, ctx: SystemCtx): void {
    const instance = this.skyboxInstances.get(scene);
    if (instance) {
      this.disposeSkyboxInstance(instance);
      this.skyboxInstances.delete(scene);
      ctx.logger.debug(`Removed skybox from scene: ${scene.name}`);
    }
  }

  /**
   * Dispose of skybox instance resources
   */
  private disposeSkyboxInstance(instance: SkyboxInstance): void {
    // Dispose background texture (only if it's a texture, not a color)
    if (
      instance.background instanceof THREE.Texture ||
      instance.background instanceof THREE.CubeTexture
    ) {
      instance.background.dispose();
    }
  }

  /**
   * Get skybox instance for a scene (used by renderer)
   */
  getSkyboxInstance(scene: Scene): SkyboxInstance | null {
    return this.skyboxInstances.get(scene) ?? null;
  }

  /**
   * Cleanup all skyboxes
   */
  async cleanup(_ctx: SystemCtx): Promise<void> {
    // WeakMap doesn't have .values() method, so we can't iterate directly
    // The WeakMap will automatically clean up when scenes are garbage collected
    // For explicit cleanup, we'd need to track scenes separately

    // Reset the WeakMap
    this.skyboxInstances = new WeakMap();
  }
}

/**
 * Factory function that creates a skybox system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export function createSkyboxSystem(options: SkyboxSystemOptions) {
  const skyboxSystem = new SkyboxSystem(options);

  const init: AsyncSystemFn = (ctx) => skyboxSystem.initialize(ctx);
  const preUpdate: AsyncSystemFn = (ctx) => skyboxSystem.preUpdate(ctx);
  const exit: AsyncSystemFn = (ctx) => skyboxSystem.cleanup(ctx);

  return {
    init,
    preUpdate,
    exit,

    // Utility functions for external access
    getSkyboxInstance: (scene: Scene) => skyboxSystem.getSkyboxInstance(scene),
  } as const;
}

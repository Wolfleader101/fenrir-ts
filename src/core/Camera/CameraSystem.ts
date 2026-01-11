import { PerspectiveCamera, OrthographicCamera } from "three";
import type { SyncSystemFn, SystemCtx } from "../SystemCtx";
import type { Entity, EntityList } from "../ECS";
import { Transform } from "../ECS/DefaultComponents";
import {
  Camera,
  ActiveCamera,
  CameraTarget,
  CameraInstance,
  type CameraViewport,
} from "./CameraComponents";

// Define query tuples as constants for proper caching
const CAMERA_QUERY = [Camera] as const;
const CAMERA_INSTANCE_QUERY = [Camera, CameraInstance] as const;
const CAMERA_TARGET_QUERY = [
  Camera,
  CameraInstance,
  CameraTarget,
  Transform,
] as const;
const CAMERA_TRANSFORM_QUERY = [Camera, CameraInstance, Transform] as const;
const ACTIVE_CAMERA_QUERY = [Camera, ActiveCamera, CameraInstance] as const;

export type CameraSystemOptions = {
  defaultCanvasWidth?: number;
  defaultCanvasHeight?: number;
};

/**
 * Private CameraSystem class that encapsulates all camera state and logic
 * Following the class + factory pattern like PhysicsSystem
 */
class CameraSystem {
  private currentFrame = 0;
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(options: CameraSystemOptions = {}) {
    this.canvasWidth = options.defaultCanvasWidth ?? window.innerWidth;
    this.canvasHeight = options.defaultCanvasHeight ?? window.innerHeight;
  }

  /**
   * Initialize camera system and set up component signals
   */
  initialize(ctx: SystemCtx): void {
    // Set up signals for camera lifecycle management
    ctx.entities.signals.onAdd(Camera, (entity, camera) => {
      this.createCameraInstance(ctx.entities, entity, camera);
    });

    ctx.entities.signals.onRemove(Camera, (entity, _camera) => {
      this.removeCameraInstance(ctx.entities, entity);
    });

    ctx.entities.signals.onReplace(Camera, (entity, camera) => {
      this.updateCameraInstance(ctx.entities, entity, camera);
    });

    // Create camera instances for existing cameras
    ctx.entities.each(CAMERA_QUERY, (entity, camera) => {
      this.createCameraInstance(ctx.entities, entity, camera);
    });

    ctx.logger.info("Camera system initialized");
  }

  /**
   * Pre-update phase: handle window resizing and camera updates
   */
  preUpdate(ctx: SystemCtx): void {
    this.currentFrame++;

    // Update canvas dimensions if window size changed
    const newWidth = window.innerWidth;
    const newHeight = window.innerHeight;

    if (newWidth !== this.canvasWidth || newHeight !== this.canvasHeight) {
      this.canvasWidth = newWidth;
      this.canvasHeight = newHeight;

      // Update all camera aspect ratios that don't have explicit overrides
      ctx.entities.each(CAMERA_INSTANCE_QUERY, (_entity, camera, instance) => {
        if (!camera.aspectRatio) {
          this.updateCameraProjection(
            camera,
            instance.threeCamera,
            this.canvasWidth,
            this.canvasHeight
          );
          instance.threeCamera.updateProjectionMatrix();
        }
      });
    }

    // Update camera transforms and properties
    this.updateCameras(ctx);
  }

  /**
   * Update phase: apply look-at behavior for cameras with targets
   */
  update(ctx: SystemCtx): void {
    ctx.entities.each(
      CAMERA_TARGET_QUERY,
      (_entity, _camera, instance, target, transform) => {
        instance.threeCamera.position.copy(transform.position);
        instance.threeCamera.lookAt(target.target);
        instance.threeCamera.up.copy(target.up);
        instance.threeCamera.updateMatrixWorld();
      }
    );
  }

  /**
   * Create a Three.js camera instance from ECS camera component
   */
  private createCameraInstance(
    entities: EntityList,
    entity: Entity,
    camera: Camera
  ): void {
    let threeCamera: PerspectiveCamera | OrthographicCamera;

    if (camera.projectionType === "perspective") {
      threeCamera = new PerspectiveCamera(
        camera.fov,
        camera.aspectRatio ?? this.canvasWidth / this.canvasHeight,
        camera.near,
        camera.far
      );
    } else {
      const aspect = camera.aspectRatio ?? this.canvasWidth / this.canvasHeight;
      const size = camera.orthoSize ?? 10;

      const left = camera.orthoLeft ?? -size * aspect;
      const right = camera.orthoRight ?? size * aspect;
      const top = camera.orthoTop ?? size;
      const bottom = camera.orthoBottom ?? -size;

      threeCamera = new OrthographicCamera(
        left,
        right,
        top,
        bottom,
        camera.near,
        camera.far
      );
    }

    // Apply viewport if specified
    if (camera.viewport) {
      this.applyViewport(threeCamera, camera.viewport);
    }

    const instance: CameraInstance = {
      threeCamera,
      lastUpdateFrame: this.currentFrame,
    };

    entities.set(entity, CameraInstance, instance);
  }

  /**
   * Remove camera instance when camera component is removed
   */
  private removeCameraInstance(entities: EntityList, entity: Entity): void {
    if (entities.has(entity, CameraInstance)) {
      // Clean up Three.js camera resources if needed
      entities.remove(entity, CameraInstance);
    }
  }

  /**
   * Update existing camera instance when camera component changes
   */
  private updateCameraInstance(
    entities: EntityList,
    entity: Entity,
    camera: Camera
  ): void {
    if (entities.has(entity, CameraInstance)) {
      const instance = entities.get(entity, CameraInstance);
      this.updateCameraProjection(
        camera,
        instance.threeCamera,
        this.canvasWidth,
        this.canvasHeight
      );

      // Apply viewport changes
      if (camera.viewport) {
        this.applyViewport(instance.threeCamera, camera.viewport);
      }

      instance.threeCamera.updateProjectionMatrix();
    }
  }

  /**
   * Update Three.js camera projection properties from ECS camera component
   */
  private updateCameraProjection(
    camera: Camera,
    threeCamera: PerspectiveCamera | OrthographicCamera,
    width: number,
    height: number
  ): void {
    const aspect = camera.aspectRatio ?? width / height;

    if (
      camera.projectionType === "perspective" &&
      threeCamera instanceof PerspectiveCamera
    ) {
      threeCamera.fov = camera.fov;
      threeCamera.aspect = aspect;
      threeCamera.near = camera.near;
      threeCamera.far = camera.far;
    } else if (
      camera.projectionType === "orthographic" &&
      threeCamera instanceof OrthographicCamera
    ) {
      const size = camera.orthoSize ?? 10;

      threeCamera.left = camera.orthoLeft ?? -size * aspect;
      threeCamera.right = camera.orthoRight ?? size * aspect;
      threeCamera.top = camera.orthoTop ?? size;
      threeCamera.bottom = camera.orthoBottom ?? -size;
      threeCamera.near = camera.near;
      threeCamera.far = camera.far;
    }
  }

  /**
   * Apply viewport settings to Three.js camera
   */
  private applyViewport(
    camera: PerspectiveCamera | OrthographicCamera,
    viewport: CameraViewport
  ): void {
    // Three.js doesn't have built-in viewport support on cameras,
    // so we store this for the renderer to use during render calls
    (camera as any).viewport = viewport;
  }

  /**
   * Update camera transforms for cameras without specific targets
   */
  private updateCameras(ctx: SystemCtx): void {
    ctx.entities.each(
      CAMERA_TRANSFORM_QUERY,
      (entity, _camera, instance, transform) => {
        // Skip if camera has a target (handled in update phase)
        if (ctx.entities.has(entity, CameraTarget)) return;

        // Sync transform to Three.js camera
        instance.threeCamera.position.copy(transform.position);
        instance.threeCamera.quaternion.copy(transform.rotation);
        instance.threeCamera.scale.copy(transform.scale);
        instance.threeCamera.updateMatrixWorld();

        // Mark as updated this frame
        (instance as any).lastUpdateFrame = this.currentFrame;
      }
    );
  }

  /**
   * Get the currently active camera entity for the scene.
   * Returns the camera with the highest priority ActiveCamera component.
   */
  getActiveCamera(entities: EntityList): Entity | null {
    let activeEntity: Entity | null = null;
    let highestPriority = -Infinity;

    entities.each(ACTIVE_CAMERA_QUERY, (entity, camera, active, _instance) => {
      if (camera.enabled && active.priority > highestPriority) {
        highestPriority = active.priority;
        activeEntity = entity;
      }
    });

    return activeEntity;
  }

  /**
   * Get all cameras sorted by render priority.
   * Returns array of [entity, camera, instance] tuples.
   */
  getCamerasSortedByPriority(
    entities: EntityList
  ): Array<[Entity, Camera, CameraInstance]> {
    const cameras: Array<[Entity, Camera, CameraInstance]> = [];

    entities.each(CAMERA_INSTANCE_QUERY, (entity, camera, instance) => {
      if (camera.enabled) {
        cameras.push([entity, camera, instance]);
      }
    });

    // Sort by priority (higher = later)
    cameras.sort((a, b) => a[1].priority - b[1].priority);

    return cameras;
  }

  /**
   * Get the Three.js camera instance for an entity.
   */
  getCameraInstance(
    entities: EntityList,
    entity: Entity
  ): PerspectiveCamera | OrthographicCamera | null {
    if (!entities.has(entity, CameraInstance)) {
      return null;
    }

    const instance = entities.get(entity, CameraInstance);
    return instance.threeCamera;
  }

  /**
   * Get current frame number
   */
  getCurrentFrame(): number {
    return this.currentFrame;
  }

  /**
   * Get current canvas size
   */
  getCanvasSize(): { width: number; height: number } {
    return { width: this.canvasWidth, height: this.canvasHeight };
  }

  /**
   * Exit handler for cleanup when system shuts down
   */
  exit(ctx: SystemCtx): void {
    // Clean up all camera instances
    ctx.entities.each(CAMERA_INSTANCE_QUERY, (entity, _camera, _instance) => {
      // Three.js cameras don't need explicit disposal, but we remove the component
      ctx.entities.remove(entity, CameraInstance);
    });

    ctx.logger.info("Camera system shutdown complete");
  }
}

/**
 * Factory function that creates a camera system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export function createCameraSystem(options: CameraSystemOptions = {}) {
  const cameraSystem = new CameraSystem(options);

  const init: SyncSystemFn = (ctx) => cameraSystem.initialize(ctx);
  const preUpdate: SyncSystemFn = (ctx) => cameraSystem.preUpdate(ctx);
  const update: SyncSystemFn = (ctx) => cameraSystem.update(ctx);
  const exit: SyncSystemFn = (ctx) => cameraSystem.exit(ctx);

  return {
    init,
    preUpdate,
    update,
    exit,

    // Utility functions for external access
    getActiveCamera: (entities: EntityList) =>
      cameraSystem.getActiveCamera(entities),
    getCamerasSortedByPriority: (entities: EntityList) =>
      cameraSystem.getCamerasSortedByPriority(entities),
    getCameraInstance: (entities: EntityList, entity: Entity) =>
      cameraSystem.getCameraInstance(entities, entity),
    getCurrentFrame: () => cameraSystem.getCurrentFrame(),
    getCanvasSize: () => cameraSystem.getCanvasSize(),
  } as const;
}

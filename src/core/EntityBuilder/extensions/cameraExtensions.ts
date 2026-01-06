import { Vector3 } from "three";
import { EntityBuilder } from "../EntityBuilder";
import {
  Camera,
  ActiveCamera,
  CameraTarget,
  createPerspectiveCamera,
  createOrthographicCamera,
  createCameraTarget,
} from "../../Camera/CameraComponents";
import type { CameraViewport } from "../../Camera/CameraComponents";

export type PerspectiveCameraOptions = {
  fov?: number;
  near?: number;
  far?: number;
  aspectRatio?: number;
  viewport?: CameraViewport;
  priority?: number;
  clearColor?: number;
  enabled?: boolean;
  active?: boolean;
  activePriority?: number;
};

export type OrthographicCameraOptions = {
  orthoSize?: number;
  orthoLeft?: number;
  orthoRight?: number;
  orthoTop?: number;
  orthoBottom?: number;
  near?: number;
  far?: number;
  aspectRatio?: number;
  viewport?: CameraViewport;
  priority?: number;
  clearColor?: number;
  enabled?: boolean;
  active?: boolean;
  activePriority?: number;
};

export type CameraTargetOptions = {
  target: Vector3;
  up?: Vector3;
};

declare module "../EntityBuilder" {
  interface EntityBuilder {
    // Camera builders
    perspectiveCamera(options?: PerspectiveCameraOptions): EntityBuilder;
    orthographicCamera(options?: OrthographicCameraOptions): EntityBuilder;

    // Camera target
    lookAt(target: Vector3, up?: Vector3): EntityBuilder;
    lookAt(x: number, y: number, z: number): EntityBuilder;

    // Active camera marker
    activeCamera(priority?: number): EntityBuilder;

    // Convenience methods for common camera setups
    mainCamera(options?: PerspectiveCameraOptions): EntityBuilder;
    uiCamera(options?: OrthographicCameraOptions): EntityBuilder;
  }
}

EntityBuilder.extend({
  perspectiveCamera(
    this: EntityBuilder,
    options: PerspectiveCameraOptions = {}
  ) {
    const camera = createPerspectiveCamera(options);

    let builder = this.with(Camera, camera);

    // Add active camera component if requested
    if (options.active) {
      builder = builder.with(ActiveCamera, {
        priority: options.activePriority ?? 0,
      });
    }

    return builder;
  },

  orthographicCamera(
    this: EntityBuilder,
    options: OrthographicCameraOptions = {}
  ) {
    const camera = createOrthographicCamera(options);

    let builder = this.with(Camera, camera);

    // Add active camera component if requested
    if (options.active) {
      builder = builder.with(ActiveCamera, {
        priority: options.activePriority ?? 0,
      });
    }

    return builder;
  },

  lookAt(
    this: EntityBuilder,
    targetOrX: Vector3 | number,
    y?: number | Vector3,
    z?: number
  ) {
    let target: Vector3;
    let up: Vector3 | undefined;

    if (
      typeof targetOrX === "number" &&
      typeof y === "number" &&
      typeof z === "number"
    ) {
      // lookAt(x, y, z) overload
      target = new Vector3(targetOrX, y, z);
    } else if (targetOrX instanceof Vector3) {
      // lookAt(target, up?) overload
      target = targetOrX;
      up = y instanceof Vector3 ? y : undefined;
    } else {
      throw new Error("Invalid lookAt parameters");
    }

    const cameraTarget = createCameraTarget(target, up);
    return this.with(CameraTarget, cameraTarget);
  },

  activeCamera(this: EntityBuilder, priority: number = 0) {
    return this.with(ActiveCamera, { priority });
  },

  mainCamera(this: EntityBuilder, options: PerspectiveCameraOptions = {}) {
    return this.perspectiveCamera({
      fov: 75,
      near: 0.1,
      far: 1000,
      priority: 0,
      active: true,
      activePriority: 0,
      ...options,
    });
  },

  uiCamera(this: EntityBuilder, options: OrthographicCameraOptions = {}) {
    return this.orthographicCamera({
      orthoSize: 10,
      near: -100,
      far: 100,
      priority: 100, // UI cameras typically render last
      viewport: { x: 0, y: 0, width: 1, height: 1 },
      active: false, // Usually not the main active camera
      ...options,
    });
  },
});

import { Vector3, Spherical, MathUtils } from "three";
import type { SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder";
import { Transform } from "@/core/ECS/DefaultComponents";
import {
  Camera,
  ActiveCamera,
  CameraTarget,
  CameraInstance,
} from "@/core/Camera/CameraComponents";
import "@/core/EntityBuilder/extensions/cameraExtensions";

/**
 * ECS-based orbital camera controller
 *
 * This replaces the old CameraController that directly manipulated Three.js cameras.
 * Instead, it creates ECS camera entities and controls them through components.
 *
 * Controls:
 * - Mouse drag: Orbit around target
 * - Mouse wheel: Zoom in/out
 * - WASD: Move target point
 * - Space/Shift: Move target up/down
 */
export interface ECSCameraControllerConfig {
  readonly target?: Vector3;
  readonly distance?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
  readonly enableDamping?: boolean;
  readonly dampingFactor?: number;
  readonly rotateSpeed?: number;
  readonly zoomSpeed?: number;
  readonly panSpeed?: number;
  readonly fov?: number;
  readonly near?: number;
  readonly far?: number;
}

// Query constants for ECS iteration
const ACTIVE_CAMERA_QUERY = [
  Camera,
  ActiveCamera,
  Transform,
  CameraInstance,
] as const;

export function createECSCameraController(
  config: ECSCameraControllerConfig = {}
) {
  // Configuration with defaults
  const target = config.target?.clone() || new Vector3(0, 0, 0);
  let distance = config.distance || 30;
  const minDistance = config.minDistance || 5;
  const maxDistance = config.maxDistance || 100;
  const enableDamping = config.enableDamping ?? true;
  const dampingFactor = config.dampingFactor || 0.1;
  const rotateSpeed = config.rotateSpeed || 1.0;
  const zoomSpeed = config.zoomSpeed || 1.0;
  const panSpeed = config.panSpeed || 100.0;

  // Camera settings
  const fov = config.fov || 75;
  const near = config.near || 0.1;
  const far = config.far || 1000;

  // Control state
  const spherical = new Spherical();
  const sphericalDelta = new Spherical();

  // Mouse state
  let isMouseDown = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  // Keyboard state
  const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
  };

  // Camera entity reference
  let cameraEntity: any = null;

  /**
   * Handle mouse events
   */
  function handleMouseMove(event: MouseEvent) {
    if (!isMouseDown) return;

    const deltaX = event.clientX - lastMouseX;
    const deltaY = event.clientY - lastMouseY;

    // Update spherical coordinates
    sphericalDelta.theta -= deltaX * rotateSpeed * 0.01;
    sphericalDelta.phi -= deltaY * rotateSpeed * 0.01;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }

  function handleMouseDown(event: MouseEvent) {
    isMouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }

  function handleMouseUp(_event: MouseEvent) {
    isMouseDown = false;
  }

  function handleWheel(event: WheelEvent) {
    const delta = event.deltaY > 0 ? 1.1 : 0.9;
    distance *= delta * zoomSpeed;
    distance = MathUtils.clamp(distance, minDistance, maxDistance);
    event.preventDefault();
  }

  /**
   * Handle keyboard events
   */
  function handleKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
        keys.forward = true;
        break;
      case "KeyS":
        keys.backward = true;
        break;
      case "KeyA":
        keys.left = true;
        break;
      case "KeyD":
        keys.right = true;
        break;
      case "Space":
        keys.up = true;
        event.preventDefault();
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.down = true;
        break;
    }
  }

  function handleKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case "KeyW":
        keys.forward = false;
        break;
      case "KeyS":
        keys.backward = false;
        break;
      case "KeyA":
        keys.left = false;
        break;
      case "KeyD":
        keys.right = false;
        break;
      case "Space":
        keys.up = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        keys.down = false;
        break;
    }
  }

  const init: SyncSystemFn = (ctx) => {
    // Create ECS camera entity
    cameraEntity = EntityBuilder.create()
      .perspectiveCamera({
        fov,
        near,
        far,
        active: true,
        activePriority: 0,
      })
      .transform(new Vector3(0, 5, distance)) // Initial position
      .lookAt(target) // Look at target
      .spawn(ctx.entities);

    // Initialize spherical coordinates from camera position
    const transform = ctx.entities.get(cameraEntity, Transform);
    const offset = new Vector3();
    offset.copy(transform.position).sub(target);
    spherical.setFromVector3(offset);

    // Set up event listeners
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    ctx.logger.info("ECS Camera controller initialized");
    ctx.logger.info(`Camera entity: ${ctx.entities.idOf(cameraEntity)}`);
    ctx.logger.info(
      "Controls: Mouse to orbit, Wheel to zoom, WASD to move, Space/Shift for up/down"
    );
  };

  const update: SyncSystemFn = (ctx) => {
    const deltaTime = ctx.time.deltaTime;

    // Handle keyboard movement (move target)
    const moveVector = new Vector3();
    if (keys.forward) moveVector.z -= 1;
    if (keys.backward) moveVector.z += 1;
    if (keys.left) moveVector.x -= 1;
    if (keys.right) moveVector.x += 1;
    if (keys.up) moveVector.y += 1;
    if (keys.down) moveVector.y -= 1;

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.multiplyScalar(panSpeed * deltaTime);

      // We need the camera's current orientation to transform movement
      ctx.entities.each(
        ACTIVE_CAMERA_QUERY,
        (entity, camera, active, transform, instance) => {
          if (!camera.enabled) return;

          // Transform movement relative to camera orientation
          const cameraDirection = new Vector3();
          instance.threeCamera.getWorldDirection(cameraDirection);
          const cameraRight = new Vector3();
          cameraRight.crossVectors(cameraDirection, instance.threeCamera.up);

          const worldMovement = new Vector3();
          worldMovement.addScaledVector(cameraRight, moveVector.x);
          worldMovement.addScaledVector(instance.threeCamera.up, moveVector.y);
          worldMovement.addScaledVector(cameraDirection, -moveVector.z);

          target.add(worldMovement);

          // Update camera target component if it exists
          if (ctx.entities.has(entity, CameraTarget)) {
            const cameraTarget = ctx.entities.get(entity, CameraTarget);
            cameraTarget.target.copy(target);
          }
        }
      );
    }

    // Apply spherical delta (mouse rotation)
    if (enableDamping) {
      spherical.theta += sphericalDelta.theta * dampingFactor;
      spherical.phi += sphericalDelta.phi * dampingFactor;
      sphericalDelta.theta *= 1 - dampingFactor;
      sphericalDelta.phi *= 1 - dampingFactor;
    } else {
      spherical.theta += sphericalDelta.theta;
      spherical.phi += sphericalDelta.phi;
      sphericalDelta.set(0, 0, 0);
    }

    // Constrain phi to prevent flipping
    spherical.phi = MathUtils.clamp(spherical.phi, 0.1, Math.PI - 0.1);
    spherical.radius = distance;

    // Update camera position based on orbital coordinates
    ctx.entities.each(
      ACTIVE_CAMERA_QUERY,
      (entity, camera, active, transform, instance) => {
        if (!camera.enabled) return;

        // Calculate new camera position
        const offset = new Vector3();
        offset.setFromSpherical(spherical);
        transform.position.copy(target).add(offset);

        // Update camera target component
        if (ctx.entities.has(entity, CameraTarget)) {
          const cameraTarget = ctx.entities.get(entity, CameraTarget);
          cameraTarget.target.copy(target);
        }

        // Directly update Three.js camera for immediate response
        instance.threeCamera.position.copy(transform.position);
        instance.threeCamera.lookAt(target);
        instance.threeCamera.updateMatrixWorld();
      }
    );
  };

  const exit: SyncSystemFn = (ctx) => {
    // Clean up event listeners
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("wheel", handleWheel);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);

    // Remove camera entity
    if (cameraEntity) {
      ctx.entities.destroyEntity(cameraEntity);
    }

    ctx.logger.info("ECS Camera controller cleaned up");
  };

  return {
    init,
    update,
    exit,

    // Utility methods
    setTarget: (newTarget: Vector3) => {
      target.copy(newTarget);
    },

    getTarget: () => target.clone(),

    setDistance: (newDistance: number) => {
      distance = MathUtils.clamp(newDistance, minDistance, maxDistance);
      spherical.radius = distance;
    },

    getDistance: () => distance,

    getCameraEntity: () => cameraEntity,
  } as const;
}

/**
 * Legacy compatibility function for existing code
 * @deprecated Use createECSCameraController instead
 */
export function createCameraController(config: any) {
  console.warn(
    "createCameraController is deprecated. Use createECSCameraController instead."
  );

  // Convert old config to new format
  const ecsConfig: ECSCameraControllerConfig = {
    target: config.target,
    distance: config.distance,
    minDistance: config.minDistance,
    maxDistance: config.maxDistance,
    enableDamping: config.enableDamping,
    dampingFactor: config.dampingFactor,
    rotateSpeed: config.rotateSpeed,
    zoomSpeed: config.zoomSpeed,
    panSpeed: config.panSpeed,
    fov: config.camera?.fov || 75,
    near: config.camera?.near || 0.1,
    far: config.camera?.far || 1000,
  };

  return createECSCameraController(ecsConfig);
}

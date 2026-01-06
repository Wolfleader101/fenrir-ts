import { Vector3, PerspectiveCamera, OrthographicCamera } from "three";
import { defineComponent } from "../ECS";
import type { Entity } from "../ECS";

export type CameraProjectionType = "perspective" | "orthographic";

export type CameraViewport = {
  readonly x: number; // Viewport X (0-1, normalized)
  readonly y: number; // Viewport Y (0-1, normalized)
  readonly width: number; // Viewport width (0-1, normalized)
  readonly height: number; // Viewport height (0-1, normalized)
};

export type CameraClearFlags = {
  readonly color: boolean;
  readonly depth: boolean;
  readonly stencil: boolean;
};

export type Camera = {
  readonly fov: number; // Field of view in degrees
  readonly near: number; // Near clipping plane
  readonly far: number; // Far clipping plane
  readonly aspectRatio?: number; // Optional override (auto-calculated if not set)
  readonly projectionType: CameraProjectionType;

  // Orthographic-specific properties
  readonly orthoSize?: number; // For orthographic cameras (half-height)
  readonly orthoLeft?: number;
  readonly orthoRight?: number;
  readonly orthoTop?: number;
  readonly orthoBottom?: number;

  // Viewport settings
  readonly viewport?: CameraViewport;

  readonly priority: number; // Render order (higher = later)
  readonly clearFlags: CameraClearFlags;
  readonly clearColor?: number; // Override clear color for this camera
  readonly enabled: boolean; // Whether camera should render
};

export const Camera = defineComponent<Camera>("Camera");

/**
 * Marks an entity as the active camera for the scene.
 * Only one entity should have this component at a time per scene.
 */
export type ActiveCamera = {
  readonly priority: number; // Priority if multiple active cameras exist
};

export const ActiveCamera = defineComponent<ActiveCamera>("ActiveCamera");

/**
 * Optional component for cameras that should look at a specific target.
 * This is a helper component - user systems can use this to implement look-at behavior.
 */
export type CameraTarget = {
  readonly target: Vector3; // What the camera should look at
  readonly up: Vector3; // Up vector for orientation
};

export const CameraTarget = defineComponent<CameraTarget>("CameraTarget");

/**
 * Runtime component managed by the camera system.
 * Contains the actual Three.js camera instance.
 */
export type CameraInstance = {
  readonly threeCamera: PerspectiveCamera | OrthographicCamera;
  readonly lastUpdateFrame: number; // Frame when camera was last updated
};

export const CameraInstance = defineComponent<CameraInstance>("CameraInstance");

// Helper functions for creating camera configurations
export function createPerspectiveCamera(opts: {
  fov?: number;
  near?: number;
  far?: number;
  aspectRatio?: number;
  viewport?: CameraViewport;
  priority?: number;
  clearColor?: number;
  enabled?: boolean;
}): Camera {
  return {
    fov: opts.fov ?? 75,
    near: opts.near ?? 0.1,
    far: opts.far ?? 1000,
    aspectRatio: opts.aspectRatio,
    projectionType: "perspective",
    viewport: opts.viewport,
    priority: opts.priority ?? 0,
    clearFlags: {
      color: true,
      depth: true,
      stencil: false,
    },
    clearColor: opts.clearColor,
    enabled: opts.enabled ?? true,
  };
}

export function createOrthographicCamera(opts: {
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
}): Camera {
  return {
    fov: 0, // Not used for orthographic
    near: opts.near ?? -100,
    far: opts.far ?? 100,
    aspectRatio: opts.aspectRatio,
    projectionType: "orthographic",
    orthoSize: opts.orthoSize ?? 10,
    orthoLeft: opts.orthoLeft,
    orthoRight: opts.orthoRight,
    orthoTop: opts.orthoTop,
    orthoBottom: opts.orthoBottom,
    viewport: opts.viewport,
    priority: opts.priority ?? 0,
    clearFlags: {
      color: true,
      depth: true,
      stencil: false,
    },
    clearColor: opts.clearColor,
    enabled: opts.enabled ?? true,
  };
}

export function createCameraTarget(
  target: Vector3,
  up?: Vector3
): CameraTarget {
  return {
    target: target.clone(),
    up: up?.clone() ?? new Vector3(0, 1, 0),
  };
}

export function defaultViewport(): CameraViewport {
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
}

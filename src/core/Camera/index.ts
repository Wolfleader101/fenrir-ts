// Camera system exports
export * from "./CameraComponents";
export * from "./CameraSystem";

// Re-export commonly used types for convenience
export type {
  Camera,
  ActiveCamera,
  CameraTarget,
  CameraInstance,
  CameraProjectionType,
  CameraViewport,
  CameraClearFlags,
} from "./CameraComponents";

export {
  createPerspectiveCamera,
  createOrthographicCamera,
  createCameraTarget,
  defaultViewport,
} from "./CameraComponents";

export type { CameraSystemOptions } from "./CameraSystem";
export { createCameraSystem } from "./CameraSystem";

/**
 * Fenrir-TS 3D: the `fenrir-ts/3d` entry point. Peer: `three`. Frozen: kept
 * working and tested, no new features.
 *
 * Importing it also, for this program:
 * - makes every default `Transform` out of Three `Vector3` and `Quaternion`
 * - adds the skybox members to `Scene` (`skybox`, `setSkybox`, `removeSkybox`, `hasSkybox`)
 * - adds the 3D EntityBuilder methods (`model`, `renderBox`, `renderSphere`,
 *   `animate`, the camera methods)
 *
 * Models and 3D textures load through `AssetStore3D` (`loadModel`, `loadTexture`, `getGeometry`,
 * `getTexture`, ...), the store `bootstrapEngine` builds, with the default glTF and texture
 * loaders. Nothing patches `AssetStore`.
 */

// Side effects: Three default transforms, the Scene skybox members and EntityBuilder patches.
import "./core/Transform3D";
import "./core/Skybox/SceneSkybox";
import "./core/EntityBuilder/extensions/renderExtensions";
import "./core/EntityBuilder/extensions/animationExtensions";
import "./core/EntityBuilder/extensions/cameraExtensions";

// Transform typed with Three classes. The same component as `Transform` from fenrir-ts.
export { Transform } from "./core/Transform3D";

// Setup
export { bootstrapEngine } from "./core/Bootstrap";
export type { BootstrapConfig, BootstrapResult, BootstrapPhysicsSystem } from "./core/Bootstrap";

// Asset store: models and textures
export { AssetStore3D } from "./core/Assets/Assets3D";
export type { AssetStore3DOptions, IAssetStore3D, LoadedModel, ModelLoaderConfig, TextureLoaderConfig } from "./core/Assets/Assets3D";
export { createGltfLoader } from "./core/Assets/loaders/gltfLoader";
export { createObjLoader } from "./core/Assets/loaders/objLoader";
export { createTextureLoader } from "./core/Assets/loaders/textureLoader";
export { createHdrTextureLoader } from "./core/Assets/loaders/hdrTextureLoader";

// Entity builder extensions
export * from "./core/EntityBuilder/extensions/renderExtensions";
export * from "./core/EntityBuilder/extensions/animationExtensions";
export * from "./core/EntityBuilder/extensions/cameraExtensions";

// Renderer (Three.js)
export { ThreeRenderer, isWebGPUAvailable } from "./core/Renderer/ThreeRenderer";
export type { RendererType, ThreeRendererOptions } from "./core/Renderer/ThreeRenderer";
export { createThreeRendererSystem } from "./core/Renderer/ThreeRendererSystem";
export { Renderable } from "./core/Renderer/renderComponents";
export type { GeometryDesc, MaterialDesc, RenderFlags } from "./core/Renderer/renderComponents";

// Camera, skybox, animation
// From the component files: the Camera barrel re-exports its components as types only.
export * from "./core/Camera/CameraComponents";
export * from "./core/Camera/CameraSystem";
export * from "./core/Skybox/SkyboxComponents";
export * from "./core/Skybox/SkyboxSystem";
export * from "./core/Skybox/SkyboxUtils";
// Its declarations add the skybox members to Scene, here and in the editor's bundled types.
export * from "./core/Skybox/SceneSkybox";
export * from "./core/Animation";

// Window-level keyboard and mouse input for the 3D path, which bootstrapEngine registers.
// A 2D game reads ctx.input and actions from fenrir-ts instead.
export { InputState } from "./core/InputSystem/InputState";
export { InputEvent } from "./core/InputSystem/InputEvents";
export { createDomInputSystems } from "./core/InputSystem/DOMInputSystem";
export type { DomInputOptions } from "./core/InputSystem/DOMInputSystem";
export { createInputStateSystem } from "./core/InputSystem/InputStateSystem";

// Performance stats
export { createStatsSystem } from "./core/Util/Stats";

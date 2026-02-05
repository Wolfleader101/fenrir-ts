/**
 * Fenrir-TS Core Module
 *
 * Main entry point for the game engine core.
 * Exports all public APIs that should be available for use.
 */

// Core engine
export { Engine } from "./Engine";
export { Time } from "./Time";
export { Scene } from "./Scene";
export { SceneManager } from "./SceneManager";
export { Schedule, Scheduler } from "./Scheduler";
export { EventBus } from "./EventBus";
export { EventQueue } from "./EventQueue";
export { bootstrapEngine } from "./Bootstrap";

// Logging
export type { ILogger } from "./ILogger";
export { ConsoleLogger } from "./ConsoleLogger";
export { NullLogger } from "./NullLogger";

// System context
export type { SystemCtx, SyncSystemFn, AsyncSystemFn } from "./SystemCtx";

// ECS
export { EntityList, View, Pool } from "./ECS";
export type { Entity } from "./ECS";
export { Name, Transform, Relationship } from "./ECS/DefaultComponents";
export type { ComponentType } from "./ECS/Component";

// Entity Builder
export { EntityBuilder } from "./EntityBuilder/EntityBuilder";
export * from "./builderExtensions";

// Assets
export type { IAssetStore } from "./Assets/AssetStore";
export { assetKey } from "./Assets/AssetStore";
export type { AssetLoader } from "./Assets/AssetLoader";

// Camera
export { Camera } from "./Camera/CameraComponents";

// Input
export { InputState } from "./InputSystem/InputState";
export type { InputEvent } from "./InputSystem/InputEvents";

// Physics
export { PhysicsBody, PhysicsShape, PhysicsMaterial } from "./Physics";

// Skybox
export { SkyboxUtils } from "./Skybox/SkyboxUtils";
export type { SkyboxDescriptor } from "./Skybox/SkyboxComponents";

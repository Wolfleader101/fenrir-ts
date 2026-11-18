/**
 * Fenrir-TS core: the `fenrir-ts` entry point.
 *
 * ECS, scheduler, engine, scenes, events, time, logging, input, the entity
 * builder and the asset cache. Imports no renderer, physics or editor code:
 * those are `fenrir-ts/2d`, `fenrir-ts/3d`, `fenrir-ts/physics` and
 * `fenrir-ts/editor`. scripts/check-entry-imports.mjs enforces this on the build.
 */

// Game: the way to start a game
export { createGame } from "./Game";
export type { Game, GameOptions, Plugin } from "./Game";

// Core engine
export { Engine } from "./Engine";
export type { EngineOptions } from "./Engine";
export { Time } from "./Time";
export type { Clock } from "./Clock";
export { Random } from "./Random";
export { Scene } from "./Scene";
export { SceneManager } from "./SceneManager";
export { Schedule, Scheduler } from "./Scheduler";
export type { ScheduleStage, SyncStage, AsyncStage, SystemOptions, ScheduledSystem } from "./Scheduler";
export { EventBus } from "./EventBus";
export { EventQueue, defineEvent } from "./EventQueue";

export type { EventReader, EventType } from "./EventQueue";

// Logging
export type { ILogger } from "./ILogger";
export { ConsoleLogger } from "./ConsoleLogger";
export { NullLogger } from "./NullLogger";

// System context
export type { SystemCtx, SyncSystemFn, AsyncSystemFn, GameServices } from "./SystemCtx";

// ECS
export { EntityList, View, Pool } from "./ECS";
export type { Entity } from "./ECS";
export { Name, Transform, Relationship } from "./ECS/DefaultComponents";
export type { Vec3Like, QuatLike } from "./ECS/DefaultComponents";
export { defineComponent } from "./ECS/Component";
export type { ComponentType } from "./ECS/Component";

// Entity Builder (with the core transform() and name() extensions)
export { EntityBuilder } from "./EntityBuilder/EntityBuilder";
export * from "./EntityBuilder/extensions/coreExtensions";

// Assets
export type { IAssetStore, Asset, AssetKey, AssetKind, AssetKinds, AssetStoreConfig, LoaderConfig } from "./Assets/AssetStore";
export { AssetStore, assetKey } from "./Assets/AssetStore";
export type { AssetLoader, AssetSource } from "./Assets/AssetLoader";

// Skybox descriptors are plain data stored on Scene. The skybox system is in fenrir-ts/3d.
export type { SkyboxDescriptor } from "./Skybox/SkyboxDescriptor";

// Input
export { InputState } from "./InputSystem/InputState";
export { InputEvent } from "./InputSystem/InputEvents";

export type { CanvasPointerEvent } from "./InputSystem/InputEvents";
export { createPointerInputSystems } from "./InputSystem/PointerInputSystem";
export { createDomInputSystems } from "./InputSystem/DOMInputSystem";
export type { DomInputOptions } from "./InputSystem/DOMInputSystem";
export { createInputStateSystem } from "./InputSystem/InputStateSystem";

/**
 * Fenrir-TS core: the `fenrir-ts` entry point.
 *
 * ECS, scheduler, engine, scenes, events, time, logging, input actions, the entity
 * builder and the asset cache. Imports no renderer, physics or editor code:
 * those are `fenrir-ts/2d`, `fenrir-ts/3d`, `fenrir-ts/physics` and
 * `fenrir-ts/editor`. scripts/check-entry-imports.mjs enforces this on the build.
 */

// Game: the way to start a game
export { createGame } from "./Game";
export type { Game, GameBase, GameOptions, Plugin } from "./Game";

// Test game: frames on demand, no canvas and no real clock
export { createTestGame } from "./TestGame";
export type { TestClock, TestGame, TestGameOptions } from "./TestGame";
export type { GameSnapshot, EntitySnapshot } from "./Inspect";
export type { JsonValue } from "./Json";

// States: state machines with enter and exit hooks, and the inState run condition
export { defineState, inState } from "./State";
export type { StateType, States } from "./State";

// Timers and tweens: the motion() plugin, plain-data components on entities
export { motion, addTimer, cancelTimer, addTween, cancelTween, Timers, Tweens, TimerFired, TweenDone, MotionSettings } from "./Motion/Motion";
export type { Timer, Tween, TimerOptions, TweenOptions, MotionCtx, NumericKeys } from "./Motion/Motion";
export { easings, defineEasing } from "./Motion/Easing";
export type { Easing, EasingName } from "./Motion/Easing";

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
export type { EventHandler } from "./EventBus";
export { EventQueue, defineEvent } from "./EventQueue";

export type { EventReader, EventType } from "./EventQueue";
export { defineResource, Resources } from "./Resource";
export type { ResourceType } from "./Resource";

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
export { Transform2D } from "./ECS/Transform2D";
export { Display2D } from "./ECS/Display2D";
export { defineComponent } from "./ECS/Component";
export type { ComponentType } from "./ECS/Component";

// Entity Builder (with the core transform() and name() extensions)
export { EntityBuilder } from "./EntityBuilder/EntityBuilder";
export * from "./EntityBuilder/extensions/coreExtensions";

// Assets
export type { IAssetStore, Asset, AssetKey, AssetKind, AssetKinds, AssetStoreConfig, LoaderConfig } from "./Assets/AssetStore";
export { AssetStore, assetKey } from "./Assets/AssetStore";
export type { AssetLoader, AssetSource } from "./Assets/AssetLoader";

// Skybox descriptors are plain data. fenrir-ts/3d stores them on Scene and runs the skybox system.
export type { SkyboxDescriptor } from "./Skybox/SkyboxDescriptor";

// Input: actions bound to keys and pointer buttons, on game.input and ctx.input
export { defineAction } from "./Input/Action";
export type { ActionType, InputBinding, KeyCode, PointerBinding } from "./Input/Action";
export type { Input, InputDomEvent, InputDownHandler, InputEdge, InputGestureHandler, InputPointer, TestInput } from "./Input/Input";

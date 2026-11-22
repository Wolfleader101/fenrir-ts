import Jolt from 'jolt-physics/wasm-compat';
import initJolt from 'jolt-physics/wasm-compat';
import * as THREE from 'three';
import { Color, CubeTexture, OrthographicCamera, PerspectiveCamera, Quaternion, Texture, TextureLoader, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE_WEBGPU from 'three/webgpu';

export type AssetSource = {
	url: string;
} | {
	url: string;
	format?: string;
};
export type AssetLoader<T> = (src: AssetSource) => Promise<T>;
export type AssetKey = string & {
	__assetKey?: true;
};
export declare const assetKey: (k: string) => AssetKey;
/** A loader and the file extensions it handles. */
export type LoaderConfig<T> = {
	loader: AssetLoader<T>;
	extensions: string[];
	/**
	 * Frees an asset this loader loaded, such as a GPU texture. Called by `unloadAssets` when the
	 * last bundle holding the asset is unloaded. Optional: without it the asset is only dropped.
	 */
	unload?: (asset: T, src: AssetSource) => void | Promise<void>;
};
/**
 * The asset kinds this program can load, mapped to the type a loaded asset of
 * that kind has. Empty in core: `fenrir-ts/2d` adds `texture2d`, and
 * `fenrir-ts/3d` adds `model` and `texture3d`. A game adds its own kinds the
 * same way, with `declare module "fenrir-ts" { interface AssetKinds { ... } }`.
 */
export interface AssetKinds {
}
/** The name of an asset kind this program knows. */
export type AssetKind = keyof AssetKinds & string;
/**
 * Any loaded asset: the union of every kind this program knows. `never` when
 * no kind is known, because then nothing can be stored.
 */
export type Asset = AssetKinds[AssetKind];
/**
 * Constructor options. Empty in core: `fenrir-ts/2d` adds `texture2DLoaders`,
 * and `fenrir-ts/3d` adds `modelLoaders` and `textureLoaders`.
 */
export interface AssetStoreConfig {
}
/**
 * The asset store as systems see it. Core has the cache only. The 2D and 3D
 * entries add their typed loading and getter methods to this interface.
 */
export interface IAssetStore {
	/** The asset stored under `key`, whatever its kind. Rejects if nothing is stored. */
	get(key: AssetKey): Promise<Asset>;
	/**
	 * The asset stored under `key`. Rejects if nothing is stored, or if the asset
	 * is of another kind; `label` names the kind in that message.
	 */
	get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;
	clear(): void;
}
/** Registers an entry's default loaders and reads its options from the config. */
export type AssetStoreInstaller = (store: AssetStore, config: AssetStoreConfig) => void;
/**
 * Caches loaded assets by key and picks a loader by file extension.
 *
 * Core knows nothing about textures or models. Each asset kind ("model",
 * "texture3d", "texture2d") is added by the entry point that renders it, which
 * registers its default loaders and typed methods when it loads.
 */
export declare class AssetStore implements IAssetStore {
	private cache;
	private assetKinds;
	private loaders;
	/**
	 * Adds default loaders to every store constructed from now on. The 2D and 3D
	 * entries call this when they load.
	 */
	static addInstaller(installer: AssetStoreInstaller): void;
	constructor(config?: AssetStoreConfig);
	/**
	 * Registers a loader for one asset kind. `label` names the kind in messages,
	 * for example "2D texture".
	 */
	registerLoader<K extends AssetKind>(kind: K, name: string, config: LoaderConfig<AssetKinds[K]>, label?: string): void;
	/** Sorted extensions that loaders of this kind handle. */
	getSupportedExtensions(kind: string): string[];
	/** The loader of this kind for the URL's extension. Throws if none handles it. */
	resolveLoader<K extends AssetKind>(kind: K, url: string, label?: string): AssetLoader<AssetKinds[K]>;
	/** Stores a pending or loaded asset under `key`, replacing whatever was there. */
	setAsset<K extends AssetKind>(key: AssetKey, kind: K, asset: Promise<AssetKinds[K]>): void;
	/** The kind of asset stored under `key`, if any. */
	kindOf(key: AssetKey): AssetKind | undefined;
	/** The promise stored under `key` if it is of this kind, without awaiting it. */
	peek<K extends AssetKind>(key: AssetKey, kind: K): Promise<AssetKinds[K]> | undefined;
	private getFileExtension;
	get(key: AssetKey): Promise<Asset>;
	get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;
	clear(): void;
}
export declare const Schedule: {
	readonly PreInit: "preInit";
	readonly Init: "init";
	readonly PostInit: "postInit";
	readonly PreUpdate: "preUpdate";
	readonly Tick: "tick";
	readonly Update: "update";
	readonly PostUpdate: "postUpdate";
	readonly Exit: "exit";
};
export type ScheduleStage = (typeof Schedule)[keyof typeof Schedule];
export type AsyncStage = typeof Schedule.PreInit | typeof Schedule.Init | typeof Schedule.PostInit | typeof Schedule.Exit;
export type SyncStage = Exclude<ScheduleStage, AsyncStage>;
/**
 * Sparse-set component pool (EnTT-style).
 * - sparse[entityId] = denseIndex + 1 (0 means not present)
 * - denseEntities[denseIndex] = entityId
 * - dense[denseIndex] = component
 */
export declare class Pool<T> {
	private sparse;
	private denseEntities;
	private dense;
	size(): number;
	has(entityId: number): boolean;
	/** Returns dense index, or -1 if missing */
	indexOf(entityId: number): number;
	/** Get component by entity id (sparse lookup) */
	get(entityId: number): T;
	tryGet(entityId: number): T | undefined;
	/** Get by dense index (fast path) */
	getAt(denseIndex: number): T;
	entityAt(denseIndex: number): number;
	entities(): readonly number[];
	components(): readonly T[];
	/**
	 * Add or replace.
	 * Returns true if inserted, false if replaced.
	 */
	set(entityId: number, component: T): boolean;
	/**
	 * Remove component for entityId.
	 * Returns true if removed, false if it wasn't present.
	 */
	remove(entityId: number): T | undefined;
	/**
	 * Iterate all entries in packed order
	 */
	forEach(fn: (entityId: number, component: T) => void): void;
}
export type ComponentType<T> = symbol & {
	__component?: T;
};
/**
 * Defines a component type. The name is the component's identity: two calls
 * with the same name return the same type and share storage. That keeps a
 * component stable across hot module reloads and across two copies of the
 * engine in one bundle.
 *
 * Because identity is global, prefix names with a namespace for your game or
 * library. Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export type Health = { current: number; max: number };
 * export const Health = defineComponent<Health>("myGame.Health");
 */
export declare function defineComponent<T>(name: string): ComponentType<T>;
export type AddCb<T> = (entity: Entity, component: T) => void;
export type RemoveCb<T> = (entity: Entity, component: T) => void;
export type ReplaceCb<T> = (entity: Entity, component: T) => void;
declare class ComponentSignals {
	private onAddMap;
	private onRemoveMap;
	private onReplaceMap;
	private onAnyAdd;
	private onAnyRemove;
	private onAnyReplace;
	onAdd<T>(type: ComponentType<T>, cb: AddCb<T>): () => void;
	onRemove<T>(type: ComponentType<T>, cb: RemoveCb<T>): () => void;
	onReplace<T>(type: ComponentType<T>, cb: ReplaceCb<T>): () => void;
	onAnyComponentAdded(cb: (type: symbol, entity: Entity) => void): () => void;
	onAnyComponentRemoved(cb: (type: symbol, entity: Entity) => void): () => void;
	onAnyComponentReplaced(cb: (type: symbol, entity: Entity) => void): () => void;
	emitAdd<T>(type: ComponentType<T>, entity: Entity, component: T): void;
	emitRemove<T>(type: ComponentType<T>, entity: Entity, component: T): void;
	emitReplace<T>(type: ComponentType<T>, entity: Entity, component: T): void;
	private addListener;
}
export type ComponentDataOf<C> = C extends ComponentType<infer T> ? T : never;
export type ComponentTuple<TTypes extends readonly ComponentType<any>[]> = {
	[K in keyof TTypes]: ComponentDataOf<TTypes[K]>;
};
export declare class View<TTypes extends readonly ComponentType<any>[]> {
	private readonly entityList;
	readonly types: TTypes;
	private readonly pools;
	private readonly drive;
	constructor(entityList: EntityList, types: TTypes);
	each(fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void): void;
	private each1;
	private each2;
	private each3;
	private each4;
	private eachN;
}
export type Entity = number;
export type AnyTypes = readonly ComponentType<any>[];
/**
 * EntityList manages entity lifetimes (create/destroy) and id recycling.
 * Component pools will be built on top of this.
 */
export declare class EntityList {
	private generations;
	private nextFree;
	private freeHead;
	private pools;
	private viewCache;
	readonly signals: ComponentSignals;
	nullEntity(): Entity;
	/**
	 * Create a new entity (reuses a destroyed id if available).
	 */
	createEntity(): Entity;
	/**
	 * Destroy an entity. Returns false if the handle was already dead/invalid.
	 * Note: component removal will be added in Step 3 when pools exist.
	 */
	destroyEntity(entity: Entity): boolean;
	/**
	 * Checks if an entity handle is currently alive and matches generation.
	 */
	isAlive(entity: Entity): boolean;
	/** Extract the numeric entity id (index) from a handle */
	idOf(entity: Entity): number;
	/** Extract the generation/version from a handle */
	genOf(entity: Entity): number;
	/** Total allocated ids (includes dead). Useful for debugging. */
	capacity(): number;
	/**
	 * Clear all entities from the entity list
	 */
	clear(): void;
	private getPool;
	private assertAlive;
	/**
	 * Add or replace a component on an entity.
	 * Returns true if inserted, false if replaced.
	 */
	set<T>(entity: Entity, type: ComponentType<T>, component: T): boolean;
	has<T>(entity: Entity, type: ComponentType<T>): boolean;
	get<T>(entity: Entity, type: ComponentType<T>): T;
	tryGet<T>(entity: Entity, type: ComponentType<T>): T | undefined;
	remove<T>(entity: Entity, type: ComponentType<T>): boolean;
	/**
	 * Expose a pool for view iteration
	 */
	pool<T>(type: ComponentType<T>): Pool<T>;
	private pack;
	entityFromId(entityId: number): Entity;
	/**
	 * Create or get a cached view for the given component types.
	 *
	 * Important: this cache works best if systems store the tuple
	 *
	 * If you inline `[Position, Velocity] as const` each frame, you’ll create a new array, so caching won’t help.
	 * @example
	  const MOVEMENT_QUERY = [Position, Velocity] as const;
	  entityList.each(MOVEMENT_QUERY, ...);
	 */
	view<TTypes extends AnyTypes>(types: TTypes): View<TTypes>;
	each<TTypes extends readonly ComponentType<any>[]>(types: TTypes, fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void): void;
	forEachChild(parent: Entity, fn: (child: Entity) => void): void;
	addChild(parent: Entity, child: Entity): void;
	removeChild(parent: Entity, child: Entity): void;
	private detachFromParent;
	private destroyChildrenRecursive;
}
export type EventType<T> = symbol & {
	__eventType?: T;
};
/**
 * Defines an event type. As with components, the name is the identity: two
 * calls with the same name return the same type. Prefix names with a namespace
 * for your game or library. Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const PlayerDied = defineEvent<{ entity: Entity }>("myGame.playerDied");
 */
export declare function defineEvent<T>(name: string): EventType<T>;
export type EventReader<T> = {
	read(): readonly T[];
};
export declare class EventQueue<T> {
	private nextSequence;
	private current;
	private previous;
	private combined;
	private combinedDirty;
	send(ev: T): void;
	/** called once per frame, after all stages */
	update(): void;
	/** returns stable array until next send/update */
	read(): readonly T[];
	/** A reader has its own cursor over the queue's two retained frame buffers. */
	createReader(): EventReader<T>;
	clearAll(): void;
}
/**
 * An immediate listener: called synchronously inside `send`, with the payload and the context
 * of the run that is going. It may be async; the promise is not awaited, and a rejection is
 * logged like a throw.
 */
export type EventHandler<T> = (payload: T, ctx: SystemCtx) => void;
export declare class EventBus {
	private queues;
	private listeners;
	private ctx?;
	private depth;
	private getQueue;
	/**
	 * Buffers the event for readers, then calls the immediate listeners in registration order.
	 * Listeners are called only while a run is going; outside one the event is only buffered.
	 */
	send<T>(type: EventType<T>, ev: T): void;
	/**
	 * Calls `handler` at every `send` of `type` for the rest of the current run, and removes it
	 * when the run stops. Call it from a system. Returns a function that removes it sooner.
	 * For a listener that outlives a run, use `game.on`.
	 */
	on<T>(type: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void;
	private listen;
	read<T>(type: EventType<T>): readonly T[];
	createReader<T>(type: EventType<T>): EventReader<T>;
	update(): void;
	clear(): void;
}
/**
 * A typed handle to a resource: one value of type `T` per game. Made by `defineResource`.
 * The name is the identity: two handles with the same name read and write the same value.
 */
export interface ResourceType<T> {
	readonly name: string;
	/** Carries `T` in the type only. There is no value at runtime. */
	readonly __resource?: (value: T) => T;
}
/**
 * Defines a resource: a single value of type `T` that one game owns. Read it with
 * `ctx.resources.get(Resource)` and replace it with `ctx.resources.set(Resource, value)`.
 *
 * `factory` runs once per game, on the first `get`, and again after the engine resets.
 * Without a factory, `get` throws until a value is set.
 *
 * As with components, the name is the identity: two calls with the same name share one value
 * in each game. Prefix names with a namespace for your game or library. Names starting with
 * `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
 * export const Seed = defineResource<number>("myGame.seed"); // set before use
 */
export declare function defineResource<T>(name: string, factory?: () => T): ResourceType<T>;
/**
 * The resources of one game: `game.resources` and `ctx.resources` are the same object.
 * Values are kept until the engine resets; stopping and running again keeps them.
 */
export declare class Resources {
	private readonly values;
	private readonly creating;
	/** Returns the resource's value, running its factory on first use. */
	get<T>(resource: ResourceType<T>): T;
	/** Replaces the resource's value. Works before `game.run()` and from any system. */
	set<T>(resource: ResourceType<T>, value: NoInfer<T>): void;
}
export type LogMeta = Record<string, unknown>;
export interface ILogger {
	trace(message: string, meta?: LogMeta): void;
	debug(message: string, meta?: LogMeta): void;
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, meta?: LogMeta): void;
}
/**
 * A named set of entities. `fenrir-ts/3d` adds the skybox members (`skybox`, `setSkybox`,
 * `removeSkybox`, `hasSkybox`) when it is imported.
 */
export declare class Scene {
	name: string;
	readonly entityList: EntityList;
	constructor(name: string);
}
export declare class SceneManager {
	private scenes;
	private activeSceneIndex;
	private readonly logger?;
	constructor(logger?: ILogger);
	getActiveScene(): Scene;
	changeActiveScene(name: string): void;
	createScene(name: string): Scene;
	destroyScene(name: string): void;
	getScene(name: string): Scene;
	listScenes(): readonly Scene[];
}
/**
 * Where the engine reads time. `Time` reads only its clock, never `performance.now()` or
 * `Date.now()` directly, so a test can pass a clock it controls.
 *
 * Two readings, because they are different quantities:
 * - `monotonic()` measures intervals: frame deltas and `time.elapsed`. It never jumps when the
 *   system clock is adjusted. The real clock uses `performance.now()`.
 * - `now()` is the wall clock in epoch milliseconds, what `Date.now()` returns, for timestamps
 *   that must survive a reload. The real clock uses `Date.now()`.
 *
 * One clock supplies both, so moving a test clock moves both together.
 */
export interface Clock {
	/** Milliseconds from an arbitrary origin. Never goes backwards. */
	monotonic(): number;
	/** Wall-clock milliseconds since the Unix epoch. */
	now(): number;
}
/**
 * A seeded random source: `ctx.random` and `game.random`. The same seed gives the same
 * sequence, so a game that draws only from here replays exactly in a test.
 *
 * The generator is mulberry32 (Tommy Ettinger, 2017): 32 bits of state, period 2^32,
 * good enough statistically for gameplay. Not for cryptography.
 */
export declare class Random {
	/** The 32-bit seed this source started from. Log it to replay a run. */
	readonly seed: number;
	private state;
	/** @param seed A safe integer. It is reduced to 32 bits, so `seed` and `seed + 2 ** 32` match. */
	constructor(seed: number);
	/** A float in [0, 1). */
	next(): number;
	/**
	 * An integer from `min` to `max`, both included. Unbiased: draws are rejected rather than
	 * folded with `%`. `max - min` may be at most 2^32 - 1.
	 */
	int(min: number, max: number): number;
	/** One item of `items`, each equally likely. Throws on an empty list. */
	pick<T>(items: readonly T[]): T;
	private nextUint32;
}
/**
 * A state machine's definition: its name, its values and the value each run starts at.
 * Made by `defineState`. `V` is the union of the value strings.
 */
export interface StateType<V extends string> {
	readonly name: string;
	readonly values: readonly V[];
	readonly initial: V;
}
/** The current value of each state, for one game. `game.states` and `ctx.states` are the same object. */
export interface States {
	/** The current value. A change queued with `set` is not visible until it is applied. */
	get<V extends string>(state: StateType<V>): V;
	/**
	 * Queues a change, applied after the current system returns: exit hooks for the old value,
	 * then enter hooks for the new value, then the next system. Setting the current value does nothing.
	 */
	set<V extends string>(state: StateType<V>, value: NoInfer<V>): void;
	/** Seconds of game time since the current value was entered. Pauses do not count. */
	timeIn(state: StateType<string>): number;
}
/**
 * Defines a state machine. As with components and events, the name is the identity: every game
 * keeps one current value per name. Prefix names with a namespace for your game or library.
 * Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Phase = defineState("myGame.Phase", { values: ["idle", "casting"], initial: "idle" });
 */
export declare function defineState<V extends string>(name: string, options: {
	readonly values: readonly V[];
	readonly initial: NoInfer<V>;
}): StateType<V>;
/**
 * A `runIf` condition: true while `state` has one of `values`.
 *
 * @example
 * game.addSystem(Schedule.Update, meter, { runIf: inState(Phase, "casting") });
 */
export declare function inState<V extends string>(state: StateType<V>, ...values: [
	NoInfer<V>,
	...NoInfer<V>[]
]): (ctx: SystemCtx) => boolean;
/**
 * Frame and game time: `ctx.time`. Reads only the clock it is given, which defaults to the
 * real one, so tests can control every reading.
 */
export declare class Time {
	/** Seconds per fixed tick. Settable; defaults to 1/60. */
	fixedDelta: number;
	/**
	 * Seconds of frame time not yet consumed by fixed ticks, below `fixedDelta` after each frame.
	 * `accumulator / fixedDelta` is the interpolation factor between the last two ticks.
	 */
	accumulator: number;
	private readonly clock;
	private frameDelta;
	private startTime;
	private prevTime;
	private paused;
	private pauseStartTime;
	private totalPausedTime;
	constructor(clock?: Clock);
	/** Seconds since the last frame, clamped to the engine's maximum frame delta. */
	get delta(): number;
	/** Seconds of game time since the run started, excluding pauses. */
	get elapsed(): number;
	/** Wall-clock milliseconds since the Unix epoch. Use instead of `Date.now()`. */
	now(): number;
	/**
	 * Starts a frame: sets `delta`, clamped to `maxDelta`, and adds it to the accumulator.
	 * Without `frameSeconds`, the frame lasted since the last update, read from the clock. With
	 * it, the frame lasted exactly that long, which is how `game.step(dt)` runs frames: the delta
	 * is `dt` itself, not a clock difference, so fixed ticks add up without rounding. A frame
	 * stepped while paused counts towards `elapsed`.
	 */
	update(maxDelta?: number, frameSeconds?: number): void;
	pause(): void;
	resume(): void;
	reset(): void;
}
export type KeyLetter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
export type KeyDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type KeyFunction = `F${Exclude<KeyDigit, "0">}` | `F1${KeyDigit}` | `F2${"0" | "1" | "2" | "3" | "4"}`;
/**
 * A `KeyboardEvent.code` value: the physical key, whatever the layout. These are the standard
 * sections of the UI Events "KeyboardEvent code Values" spec: the writing-system keys, the
 * functional keys, the control and arrow pads, the numpad and the function row. Media and
 * browser keys are left out.
 */
export type KeyCode = `Key${KeyLetter}` | `Digit${KeyDigit}` | "Backquote" | "Backslash" | "BracketLeft" | "BracketRight" | "Comma" | "Equal" | "IntlBackslash" | "IntlRo" | "IntlYen" | "Minus" | "Period" | "Quote" | "Semicolon" | "Slash" | "AltLeft" | "AltRight" | "Backspace" | "CapsLock" | "ContextMenu" | "ControlLeft" | "ControlRight" | "Enter" | "MetaLeft" | "MetaRight" | "ShiftLeft" | "ShiftRight" | "Space" | "Tab" | "Convert" | "KanaMode" | "NonConvert" | "Delete" | "End" | "Help" | "Home" | "Insert" | "PageDown" | "PageUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | `Numpad${KeyDigit}` | "NumLock" | "NumpadAdd" | "NumpadComma" | "NumpadDecimal" | "NumpadDivide" | "NumpadEnter" | "NumpadEqual" | "NumpadMultiply" | "NumpadSubtract" | "Escape" | KeyFunction | "PrintScreen" | "ScrollLock" | "Pause";
/** The primary pointer (left mouse button, a finger, a pen tip) or the secondary one (right mouse button, pen barrel). */
export type PointerBinding = "pointer.primary" | "pointer.secondary";
/** What an action can be bound to: a key by `KeyboardEvent.code`, or a pointer button. */
export type InputBinding = KeyCode | PointerBinding;
/** A named action and the inputs that drive it. Made by `defineAction`. */
export interface ActionType {
	readonly name: string;
	readonly bindings: readonly InputBinding[];
}
/**
 * Defines an action: something the player does, bound to keys and pointer buttons. Read it with
 * `ctx.input.pressed(Action)`, `released` and `held`. The action is held while any of its
 * bindings is down.
 *
 * Keys are `KeyboardEvent.code` values, which name the physical key: `"KeyA"`, `"Space"`,
 * `"ArrowLeft"`, `"Enter"`. Pointers are `"pointer.primary"` (mouse left button, a finger or a
 * pen) and `"pointer.secondary"` (mouse right button). Prefix names with a namespace for your
 * game or library; names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
 */
export declare function defineAction(name: string, bindings: readonly InputBinding[]): ActionType;
/** The primary pointer as of the start of this frame. */
export interface InputPointer {
	/** Logical x of the last pointer position: design units with `pixi2d({ design })`, else CSS pixels from the canvas's left edge. */
	readonly x: number;
	/** Logical y of the last pointer position. */
	readonly y: number;
	/** The primary pointer is down: left mouse button, a finger or a pen tip. `consumePointer` does not change it. */
	readonly down: boolean;
	/** The pointer is over the canvas. False after a finger lifts or the mouse leaves. */
	readonly inside: boolean;
	/**
	 * The primary pointer went up this frame without being lifted: the browser cancelled it
	 * (`pointercancel` or lost pointer capture), the canvas lost focus, or the page was hidden.
	 * `released` still reports the release; check this to ignore a cancelled press.
	 */
	readonly cancelled: boolean;
}
/** One press or release of an action, from `input.edges(actions)`. */
export interface InputEdge {
	readonly action: ActionType;
	readonly kind: "pressed" | "released";
}
/** The DOM event an input handler runs inside: a `keydown`, or a `pointerdown` or `pointerup`. */
export type InputDomEvent = KeyboardEvent | PointerEvent;
/**
 * Runs inside the DOM event that pressed one of an action's bindings, with the current run's
 * ctx. Return `true` to claim the event: the engine calls `preventDefault()` on it. `event` is
 * `undefined` when a test game's input stands in for the player without one.
 */
export type InputDownHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => boolean | void;
/** Runs inside a user gesture on the canvas, with the current run's ctx. `event` is `undefined` in a test game. */
export type InputGestureHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => void;
/**
 * Actions and the pointer, latched when each frame starts: every system in a frame, in every
 * stage, reads the same answers. `game.input` and `ctx.input` are the same object.
 */
export interface Input {
	/**
	 * The action went down this frame: none of its bindings was held last frame and one is now.
	 * True for exactly one frame, even for a tap that went down and up between two frames. In the
	 * `Tick` stage it is true in exactly one tick: the first that runs after the press.
	 */
	pressed(action: ActionType): boolean;
	/** The action went up this frame: it was held last frame and no binding is down now. In `Tick`, true in exactly one tick. */
	released(action: ActionType): boolean;
	/** Any of the action's bindings is down. A tap is held for the one frame it is pressed in. */
	held(action: ActionType): boolean;
	readonly pointer: InputPointer;
	/** The canvas had keyboard focus when this frame started. Keys reach the game only while it has. */
	readonly focused: boolean;
	/**
	 * This frame's presses and releases of `actions`, in the order they happened, every one kept:
	 * two presses of one key between two frames are two `pressed` edges. An action is pressed
	 * when its first binding goes down and released when its last goes up, as for `pressed` and
	 * `released`. The list is what arrived since the last frame, so a quick tap is `pressed`
	 * then `released` here in the frame where `pressed()` is true. Bindings hidden by `consume`
	 * or `consumePointer` are left out. In `Tick` it is the frame's list in every tick: read it
	 * in `PreUpdate` or `Update`.
	 */
	edges(actions: readonly ActionType[]): readonly InputEdge[];
	/**
	 * Stops this frame's pointer press reaching actions: for UI that handled the tap. Systems that
	 * run after this call see no `pressed`, `held` or `released` from the pointer bindings until
	 * the pointer is lifted; keys bound to the same action still count. Systems that ran earlier
	 * in the frame already saw the press, so the UI system must run first. `pointer.down` still
	 * reports the pointer. Does nothing in a frame with no new pointer press.
	 */
	consumePointer(): void;
	/**
	 * Stops this frame's press of `action` reaching later systems, whichever binding pressed it:
	 * for UI that handled the press. It hides the bindings that went down this frame as
	 * `consumePointer` hides the pointer: until they lift, systems that run after the call see no
	 * `pressed`, `held`, `released` or edges from them, for this action or any other bound to the
	 * same key or button. Does nothing when no binding of the action went down this frame.
	 */
	consume(action: ActionType): void;
	/**
	 * Calls `handler` synchronously inside each DOM event that presses one of `action`'s
	 * bindings, before the press is latched: every `keydown` of a bound key, auto-repeats
	 * included, and the `pointerdown` that presses a bound pointer button. Return `true` to claim
	 * the event and the engine calls `preventDefault()` on it, for example to keep Tab on the
	 * canvas while a canvas control can still take focus. The press is latched either way.
	 *
	 * Setup, like `game.on`: register once, not in a system. A handler stays across `stop()` and
	 * `run()` and is called only while the game runs. Returns a function that removes it. A
	 * handler that throws is logged and does not claim.
	 */
	onDown(action: ActionType, handler: InputDownHandler): () => void;
	/**
	 * Calls `handler` synchronously inside every user gesture on the canvas: each `keydown` that
	 * is not an auto-repeat, `pointerdown` and `pointerup`. Some browser calls work only inside a
	 * gesture, such as `audioContext.resume()` on iOS Safari, where a touch counts on `pointerup`.
	 * Setup, like `onDown`: stays across runs, called only while the game runs. Returns a function
	 * that removes it. A handler that throws is logged.
	 */
	onGesture(handler: InputGestureHandler): () => void;
}
/**
 * `game.input` in a test game: `Input`, plus calls that stand in for the player. Each takes
 * effect when the next frame starts, as a DOM event would. Handlers (`onDown`, `onGesture`) run
 * at the call, as they would inside the DOM event, while the game runs.
 */
export interface TestInput extends Input {
	/**
	 * Presses the action's first binding, as if that key or pointer button went down. Calls the
	 * `onDown` handlers of every action bound to it, then the `onGesture` handlers, passing
	 * `event`. Returns whether a handler claimed the press. A pointer binding also focuses the
	 * canvas, as a press on it does.
	 */
	press(action: ActionType, event?: InputDomEvent): boolean;
	/** Releases every binding of the action. */
	release(action: ActionType): void;
	/**
	 * Moves the primary pointer to logical `x`, `y` over the canvas and presses it. Calls the
	 * handlers and focuses the canvas as `press` does, and returns whether a handler claimed it.
	 */
	pointerDown(x: number, y: number): boolean;
	/** Moves the primary pointer to logical `x`, `y` over the canvas. */
	pointerMove(x: number, y: number): void;
	/** Lifts the primary pointer where it is. A gesture: calls the `onGesture` handlers. */
	pointerUp(): void;
	/** The browser cancels the primary pointer: it goes up, with `pointer.cancelled` in the frame that releases it. */
	pointerCancel(): void;
	/** The canvas gains keyboard focus. */
	focus(): void;
	/** The canvas loses keyboard focus, which releases everything held, as in the browser. */
	blur(): void;
}
/**
 * Services a game shares between `Game` and every `SystemCtx`: `game.x` and `ctx.x` are the
 * same object. `createGame` builds them and passes them to the engine.
 *
 * A new service adds its field here and builds its object in `createServices` (src/core/Game.ts).
 */
export interface GameServices {
	/** Singleton values this game owns. See `defineResource`. */
	readonly resources: Resources;
	/** The current value of each state. See `defineState`. */
	readonly states: States;
	/** Seeded random numbers. Use instead of `Math.random()`. Seeded by `createGame({ seed })`. */
	readonly random: Random;
	/** Actions and the pointer, latched when each frame starts. See `defineAction`. */
	readonly input: Input;
	/** Loaded assets by key, and the loaders for each kind. A manifest loads into it: see `defineAssets`. */
	readonly assets: AssetStore;
}
/**
 * What every system receives. An interface so that entry points can add fields:
 * `fenrir-ts/physics` adds `physics`.
 */
export interface SystemCtx extends GameServices {
	time: Time;
	events: EventBus;
	logger: ILogger;
	scenes: SceneManager;
	readonly scene: Scene;
	readonly entities: EntityList;
	/** Aborted when the engine run that owns this context stops or rolls back. */
	readonly signal: AbortSignal;
	/** Registers cleanup for this run. Cleanups run in reverse order of registration. */
	onCleanup(cleanup: () => void | Promise<void>): void;
	stop(): void;
}
export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
/** How a system is registered. Every field is optional. */
export interface SystemOptions {
	/** The system's name. Defaults to the function's name. Unique within a stage. */
	name?: string;
	/** Run before these systems in the same stage. */
	before?: string | readonly string[];
	/** Run after these systems in the same stage. */
	after?: string | readonly string[];
	/** Checked each time the system would run. The system is skipped when it returns false. */
	runIf?: (ctx: SystemCtx) => boolean;
}
/** A registered system, in the order its stage runs it. */
export interface ScheduledSystem {
	readonly name: string;
	readonly stage: ScheduleStage;
	readonly system: SyncSystemFn | AsyncSystemFn;
	readonly before: readonly string[];
	readonly after: readonly string[];
	readonly runIf?: (ctx: SystemCtx) => boolean;
}
/**
 * Holds the systems of each stage and runs them.
 *
 * Order is resolved when a run begins (`beginRun`). While a run is active, adding, replacing
 * or removing a system is checked at once, so a bad change throws at the call, and takes effect
 * at the next `flush`, which the engine calls before each frame and between startup stages.
 */
export declare class Scheduler {
	private readonly entries;
	private readonly resolved;
	private readonly active;
	private readonly functions;
	private running;
	addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
	addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
	addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	/**
	 * Swaps the function of every system called `name`, keeping its stage, position and options.
	 * While running, the new function runs from the next frame.
	 */
	replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
	/** Removes every system called `name`. While running, it stops running from the next frame. */
	removeSystem(name: string): this;
	/** The system functions of a stage, in the order they run. */
	getSystems<S extends SyncStage>(stage: S): readonly SyncSystemFn[];
	getSystems<S extends AsyncStage>(stage: S): readonly AsyncSystemFn[];
	getSystems(stage: ScheduleStage): readonly (SyncSystemFn | AsyncSystemFn)[];
	/** The systems of a stage with their names and options, in the order they run. */
	getSchedule(stage: ScheduleStage): readonly ScheduledSystem[];
	/** The whole schedule as text, one stage per line: `update: movePlayer, applyDamage`. */
	describe(): string;
	/**
	 * Resolves the order of every stage and starts applying changes at `flush` only.
	 * Throws, naming the systems involved, if a constraint is unknown or cyclic.
	 */
	beginRun(): void;
	/** Applies changes made since the last flush. Called by the engine between frames. */
	flush(): void;
	/** Ends the run: changes apply immediately again and are checked when the next run begins. */
	endRun(): void;
	/** The systems a stage runs now, as of the last flush while running. */
	current(stage: ScheduleStage): readonly ScheduledSystem[];
	/**
	 * Runs a stage's systems in order. State changes queued by a system are applied after it
	 * returns, before the next system's `runIf`; changes made outside a system, before the first.
	 */
	runSyncStage<S extends SyncStage>(stage: S, ctx: SystemCtx): void;
	/** As `runSyncStage`, awaiting each system. Stops before the next system once `ctx.signal` aborts. */
	runAsyncStage<S extends AsyncStage>(stage: S, ctx: SystemCtx): Promise<void>;
	private stagesWith;
	/** Replaces a stage's entries. While running, the new order is resolved now so errors throw here. */
	private change;
}
export type EngineOptions = {
	scheduler: Scheduler;
	sceneManager: SceneManager;
	events: EventBus;
	logger?: ILogger | null;
	/** Maximum simulation delta in seconds. Defaults to 0.25. */
	maxFrameDelta?: number;
	/** Maximum fixed updates per animation frame. Defaults to 8. */
	maxTicksPerFrame?: number;
	/**
	 * Fields added to every SystemCtx. `createGame` passes the game's services here. Without
	 * them, the engine makes its own, with `random` seeded from the clock.
	 */
	services?: GameServices;
	/** Where `ctx.time` reads time. Defaults to the real clock; pass one you control in tests. */
	clock?: Clock;
	/**
	 * What drives frames once startup finishes. `"animationFrame"`, the default, schedules them
	 * with `requestAnimationFrame`. `"step"` schedules none: the engine stays paused after
	 * startup, frames run only through `step(dt)`, and `resume()` throws. `createTestGame` uses
	 * `"step"`.
	 */
	loop?: "animationFrame" | "step";
	/** Called before each frame that `step` runs, with its `dt`. The test game advances its clock here. */
	beforeStep?: (dt: number) => void;
};
export declare class Engine {
	private readonly time;
	private readonly scheduler;
	private readonly maxFrameDelta;
	private readonly maxTicksPerFrame;
	private readonly events;
	private readonly sceneManager;
	private readonly logger;
	private readonly services;
	private readonly loop;
	private readonly beforeStep?;
	private activeRun?;
	private rafId;
	private stepping;
	/** Frames run this run, and `time.elapsed` at the latest one's start. Read by `inspect`. */
	private frames;
	constructor(opts: EngineOptions);
	private createSystemCtx;
	run(): Promise<void>;
	private start;
	private scheduleFrame;
	/**
	 * One frame. The browser loop calls it with `live` "running"; `step` calls it with "paused"
	 * and an exact `dt`. A system that stops or pauses the run ends the frame early.
	 */
	private frame;
	private cancelFrame;
	private shutdown;
	stop(): Promise<void>;
	pause(): void;
	resume(): void;
	/**
	 * Runs `frames` whole frames now, each `dt` seconds long, through the same frame body as the
	 * browser loop: PreUpdate, as many Tick stages as the accumulator holds (at most
	 * `maxTicksPerFrame`, the rest dropped), Update, PostUpdate, then the event buffers advance.
	 *
	 * Runs only while paused: after `pause()`, or after startup with `loop: "step"`. `dt` is in
	 * seconds, from 0 up to `maxFrameDelta` (0.25 by default); a longer `dt` throws instead of
	 * being clamped, because a clamped step would silently simulate less time than asked for.
	 * If a system stops the run, the remaining frames are skipped. If a system throws, the run
	 * stops, as in the browser loop, and the error propagates.
	 */
	step(dt?: number, frames?: number): void;
	reset(): Promise<void>;
	private get input();
	getTime(): Time;
	isRunning(): boolean;
	/** Whether startup finished and the run has not begun to stop: running or paused. */
	isActive(): boolean;
	addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
	addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
	addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	/** Swaps the function of the system called `name`, keeping its position and options. */
	replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
	/** Removes the system called `name`. While running, it stops from the next frame. */
	removeSystem(name: string): this;
	getScheduler(): Scheduler;
}
/** A value that `JSON.stringify` writes and `JSON.parse` reads back unchanged. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | {
	readonly [key: string]: JsonValue;
};
/** One entity of the active scene, as `game.inspect()` reports it. */
export interface EntitySnapshot {
	/** The entity handle: the value `entities.get` and `entities.set` take. */
	readonly id: number;
	/** From the engine's `fenrir.Name` component. */
	readonly name: string;
	/** The parent's handle, from the engine's `fenrir.Relationship` component; null for a root. */
	readonly parent: number | null;
	/** Every other component, `fenrir.Transform` included, by the name given to `defineComponent`. */
	readonly components: Readonly<Record<string, JsonValue>>;
}
/** What a game is doing, as plain JSON. Returned by `game.inspect()`. */
export interface GameSnapshot {
	/** Frames run since the current run started. 0 during startup; kept after `stop()` until the next `run()`. */
	readonly frame: number;
	/** `time.elapsed` and `time.delta` as of the start of the latest frame. */
	readonly time: {
		readonly elapsed: number;
		readonly delta: number;
	};
	/** System names per stage, in run order. */
	readonly schedule: Readonly<Record<ScheduleStage, readonly string[]>>;
	/** Each state's current value and seconds in it, by the name given to `defineState`. */
	readonly states: Readonly<Record<string, {
		readonly value: string;
		readonly timeIn: number;
	}>>;
	/** Each resource that has a value, by the name given to `defineResource`. */
	readonly resources: Readonly<Record<string, JsonValue>>;
	/** The active scene's entities, by id. */
	readonly entities: readonly EntitySnapshot[];
}
/**
 * Something that attaches to a game: a renderer, and later physics, audio or UI.
 *
 * `install` runs once, inside `createGame`, before the game runs. It registers systems and
 * may read `game.canvas`, `game.logger`, `game.assets` and `game.events`. It should not acquire
 * resources such as GPU contexts or listeners: do that in an `Init` system, and release them
 * with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.
 *
 * `createTestGame` installs plugins too, but a test game has no canvas: reading `game.canvas`
 * there throws, so a renderer plugin such as `pixi2d` fails to install and says so. A plugin
 * that only adds systems, resources or listeners installs in both.
 */
interface Plugin$1 {
	/** Namespaced, for example `fenrir.pixi2d` or `myGame.audio`. One plugin per name per game. */
	readonly name: string;
	install(game: Game): void | Promise<void>;
}
export interface GameOptions {
	/** The canvas the game draws to. Renderer plugins read it from `game.canvas`. */
	canvas: HTMLCanvasElement;
	/** Installed in order. An async `install` is awaited before the next plugin installs. */
	plugins?: readonly Plugin$1[];
	/** Defaults to a ConsoleLogger. */
	logger?: ILogger;
	/**
	 * Seeds `game.random` and `ctx.random`: a safe integer. Without one, the seed comes from the
	 * clock, and `game.random.seed` reports it. Stopping and running the game again continues
	 * the sequence; it does not restart it.
	 */
	seed?: number;
	/**
	 * Puts `inspect` on `window.__FENRIR__` for browser tests and agents. Off by default. With two
	 * debug games on one page, the last one created owns it. It stays after the game stops.
	 */
	debug?: boolean;
}
/**
 * What a `Game` and a `TestGame` share: registration, services, `stop`, `step` and `inspect`. Systems,
 * hooks and listeners written against it run unchanged in both.
 */
export interface GameBase extends GameServices {
	readonly logger: ILogger;
	readonly assets: AssetStore;
	readonly events: EventBus;
	addSystem(stage: SyncStage, system: SyncSystemFn, options?: SystemOptions): this;
	addSystem(stage: AsyncStage, system: AsyncSystemFn, options?: SystemOptions): this;
	/** Removes every system called `name`. While running, it stops running from the next frame. */
	removeSystem(name: string): this;
	/** Swaps the function of every system called `name`, keeping its position and options. */
	replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
	/** Runs Exit systems, then cleanups in reverse order. */
	stop(): Promise<void>;
	/**
	 * Whether the game is running: startup finished and `stop()` has not been called since,
	 * paused included. False before `run()` (or `start()` on a test game), during startup, and
	 * from the moment `stop()` is called. `run()` resolves without throwing when the game is
	 * stopped during startup, so check this after `await game.run()` to know gameplay started.
	 */
	isRunning(): boolean;
	/**
	 * Runs `frames` whole frames now, each `dt` seconds of game time (default 1/60), through the
	 * same frame body as the browser loop: PreUpdate, the Tick stages the accumulator holds (at
	 * most 8 a frame, the rest dropped, as after a long browser frame), Update, PostUpdate, then
	 * the event buffers advance. Fixed ticks accumulate from `dt` exactly.
	 *
	 * `dt` is at most 0.25 s, the frame-delta clamp; a longer `dt` throws rather than silently
	 * simulating less: write `step(1 / 60, 60)` for a second. On a `Game`, `step` runs only while
	 * paused (`pause()` first) and advances by `dt` whatever the real time; the game's systems
	 * all run, so a renderer draws each stepped frame. On a `TestGame`, it runs after `start()`.
	 * A system that throws stops the game and the error propagates from `step`.
	 */
	step(dt?: number, frames?: number): void;
	/**
	 * Runs `system` each time `state` changes to `value`, after the exit hooks of the old value.
	 * Each run starts every state at its initial value and runs its enter hooks before the first PreInit system.
	 */
	onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
	/** Runs `system` each time `state` changes away from `value`, before the enter hooks of the new value. */
	onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
	/**
	 * Calls `handler(payload, ctx)` synchronously at every `send` of `event` while the game runs,
	 * in registration order. Setup, like `addSystem`: it stays across `stop()` and `run()` until
	 * the returned function removes it. For a listener that belongs to one run, call
	 * `ctx.events.on` from a system.
	 */
	on<T>(event: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void;
	/**
	 * What the game is doing, as plain JSON: frame, time, schedule, states, resources and the active
	 * scene's entities. Works before the game runs, while paused and after `stop()`; never throws.
	 * The serialisation rules are in README.md under "Inspecting a game".
	 */
	inspect(): GameSnapshot;
}
/** A running game. Built by `createGame`. */
export interface Game extends GameBase {
	readonly canvas: HTMLCanvasElement;
	/** Runs PreInit, Init and PostInit, then resolves when the first frame is scheduled. */
	run(): Promise<void>;
	/** Stops scheduling frames. `step(dt)` runs frames while paused. */
	pause(): void;
	resume(): void;
}
/**
 * Builds a game: scheduler, scene manager, event bus, logger and asset store, then installs
 * each plugin in order, awaiting async installs. Rejects with the plugin's error if an install
 * throws; nothing has run yet, so there is nothing to roll back.
 *
 * ```ts
 * const game = await createGame({ canvas, plugins: [pixi2d()] });
 * game.addSystem(Schedule.Update, movePlayer);
 * await game.run();
 * ```
 */
export declare function createGame(options: GameOptions): Promise<Game>;
export interface TestGameOptions {
	/** Seeds `game.random` and `ctx.random`: a safe integer. Required, so every run draws the same numbers. */
	seed: number;
	/** Wall-clock epoch milliseconds that `time.now()` starts at. Defaults to 0. */
	now?: number;
	/**
	 * Installed in order, as in `createGame`. A test game has no canvas, so a plugin that reads
	 * `game.canvas`, such as `pixi2d`, throws when it installs.
	 */
	plugins?: readonly Plugin$1[];
	/** Defaults to a ConsoleLogger, as in `createGame`. */
	logger?: ILogger;
}
/** The test game's clock. It moves only when told to. */
export interface TestClock {
	/** Moves `time.now()` forward by `ms` milliseconds without running a frame. */
	advance(ms: number): void;
}
/**
 * A game with no renderer, no canvas and no frame loop, built by `createTestGame`. Frames run
 * only when `step(dt)` is called, on a clock that moves only with `step` and `clock.advance`.
 *
 * It has `start()` where a `Game` has `run()`, because `run()` hands frames to
 * `requestAnimationFrame` and a test game has none. It has no `pause` or `resume`: it is never
 * running between steps, so there is nothing to pause.
 */
export interface TestGame extends GameBase {
	readonly clock: TestClock;
	/**
	 * Runs PreInit, Init and PostInit, as `run()` does on a `Game`, with the same rollback when a
	 * startup system throws. Schedules no frame: call `step(dt)`.
	 */
	start(): Promise<void>;
	/**
	 * The same `Input` that systems read as `ctx.input`, plus `press`, `release`, `pointerDown`,
	 * `pointerMove` and `pointerUp`, which stand in for the player and take effect on the next `step`.
	 */
	readonly input: TestInput;
}
/**
 * Builds a game for tests and tools: the same scheduler, services, states, events and plugins
 * as `createGame`, with no canvas and no `requestAnimationFrame`. Nothing reads
 * `performance.now()` or `Date.now()`: time moves only with `step` and `clock.advance`.
 *
 * ```ts
 * const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
 * game.addSystem(Schedule.Update, movePlayer);
 * await game.start();
 * game.step(1 / 60, 60); // one second
 * await game.stop();
 * ```
 */
export declare function createTestGame(options: TestGameOptions): Promise<TestGame>;
/** Maps progress `t` from 0 to 1 onto eased progress, 0 at 0 and 1 at 1. */
export type Easing = (t: number) => number;
/**
 * The built-in easings, by the name a tween's `ease` takes. Each is a plain function, so code
 * can also call one directly: `easings.quadOut(0.5)`.
 */
export declare const easings: {
	linear: (t: number) => number;
	quadIn: (t: number) => number;
	quadOut: (t: number) => number;
	quadInOut: (t: number) => number;
	cubicIn: (t: number) => number;
	cubicOut: (t: number) => number;
	cubicInOut: (t: number) => number;
	sineIn: (t: number) => number;
	sineOut: (t: number) => number;
	sineInOut: (t: number) => number;
	/** Overshoots the end by about 10% and settles back. */
	backOut: (t: number) => number;
};
/** The name of a built-in easing. */
export type EasingName = keyof typeof easings;
/**
 * Adds an easing that tweens can name in `ease`, so tween data stays plain JSON. Prefix the
 * name with your game's namespace (`myGame.bounce`); the built-in names cannot be redefined.
 * Defining the same name again replaces the function.
 *
 * @example
 * defineEasing("myGame.steps", (t) => Math.floor(t * 4) / 4);
 * addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 1, ease: "myGame.steps" });
 */
export declare function defineEasing(name: string, easing: Easing): void;
/**
 * One timer, as plain data in an entity's `Timers`. Times are seconds of game time. The motion
 * system advances it each frame and sends `TimerFired` each time `elapsed` reaches `duration`.
 * Edit `paused` directly to pause and resume it.
 */
export interface Timer {
	/** Seconds from the start of the current period to the next firing. */
	duration: number;
	/** Seconds into the current period. */
	elapsed: number;
	/** `duration - elapsed`, kept up to date by the motion system. */
	remaining: number;
	/** Firings after the first: 0 fires once, `Infinity` repeats until cancelled. */
	repeat: number;
	/** Times it has fired. */
	fired: number;
	paused: boolean;
	/** Paused with every other timer and tween of its group by `MotionSettings.paused[group]`. */
	group: string | null;
	/** While set, the timer exists only while that state has that value; it is removed, unfired, once it has not. */
	state: {
		name: string;
		value: string;
	} | null;
}
/** The timers of one entity, by name. */
export type Timers = Record<string, Timer>;
export declare const Timers: ComponentType<Timers>;
/**
 * One tween, as plain data in an entity's `Tweens`: numeric fields of one component on the same
 * entity, from `from` to `to`. The motion system writes the fields each frame and removes the
 * tween when it finishes, sending `TweenDone`. Edit `paused` directly to pause and resume it.
 */
export interface Tween {
	/** The component's name, as given to `defineComponent`, for example `fenrir.Transform2D`. */
	component: string;
	/** Start values. Fields not given are read from the component when the delay ends. */
	from: Record<string, number>;
	/** End values, by field. */
	to: Record<string, number>;
	/** Seconds per play. */
	duration: number;
	/** Seconds before the first play starts. */
	delay: number;
	/** An easing name: a built-in (`EasingName`) or one added with `defineEasing`. */
	ease: string;
	/** Plays after the first: 0 plays once, `Infinity` repeats until cancelled. */
	repeat: number;
	/** Every second play runs from `to` back to `from`. */
	yoyo: boolean;
	/** Seconds since the tween was added, delay included, pauses excluded. */
	elapsed: number;
	/** True once the delay has ended and `from` holds every field. */
	started: boolean;
	paused: boolean;
	/** Paused with every other timer and tween of its group by `MotionSettings.paused[group]`. */
	group: string | null;
}
/** The tweens of one entity, by name. */
export type Tweens = Record<string, Tween>;
export declare const Tweens: ComponentType<Tweens>;
/** Sent each time a timer fires, in the frame it fires. `last` is true when the timer is gone. */
export declare const TimerFired: EventType<{
	entity: Entity;
	name: string;
	count: number;
	last: boolean;
}>;
/** Sent when a tween ends on its end values, in the frame it ends. Not sent when it is cancelled or replaced. */
export declare const TweenDone: EventType<{
	entity: Entity;
	name: string;
}>;
/** Settings for every timer and tween of a game. Set by the `motion()` plugin; edit the fields. */
export interface MotionSettings {
	/** Groups whose timers and tweens are paused: `paused.ambient = true`. Remove or set false to resume. */
	paused: Record<string, boolean>;
	/**
	 * When true, every tween jumps to its end values at the next frame and sends `TweenDone`,
	 * including tweens added later and repeating ones (which end where their last play would).
	 * Timers are not affected: they measure game time, not motion.
	 */
	reducedMotion: boolean;
}
export declare const MotionSettings: ResourceType<MotionSettings>;
/** What the helpers need: a `SystemCtx`, or anything with the game's `entities` and `resources`. */
export type MotionCtx = {
	readonly entities: EntityList;
	readonly resources: Resources;
};
/** The keys of `T` whose values are numbers. */
export type NumericKeys<T> = {
	[K in keyof T]-?: T[K] extends number ? K : never;
}[keyof T] & string;
export interface TweenOptions<T> {
	/** End values of numeric fields of the component. */
	to: Partial<Record<NumericKeys<T>, number>>;
	/** Start values. Fields left out start from the component's value when the delay ends. */
	from?: Partial<Record<NumericKeys<T>, number>>;
	/** Seconds per play, at least 0. */
	duration: number;
	/** Seconds before the first play. Defaults to 0. */
	delay?: number;
	/** Defaults to `"linear"`. */
	ease?: EasingName | (string & {});
	/** Plays after the first. Defaults to 0; `Infinity` repeats until cancelled. */
	repeat?: number;
	/** Every second play runs back to the start. Defaults to false. */
	yoyo?: boolean;
	/**
	 * Adding a tween with a running tween's name replaces it. Defaults to the component's name and
	 * the fields, such as `fenrir.Transform2D:x,y`, so tweening the same fields again replaces.
	 */
	name?: string;
	group?: string;
}
export interface TimerOptions {
	/** Seconds until it fires, and between firings. */
	duration: number;
	/** Firings after the first. Defaults to 0; `Infinity` repeats until cancelled. Needs a duration above 0. */
	repeat?: number;
	group?: string;
	/** Removes the timer, unfired, once `state` no longer has `value`. Pass the state and its value. */
	state?: [
		StateType<string>,
		string
	];
}
/**
 * Starts a timer called `name` on `entity`, replacing a timer of that name. It fires
 * `TimerFired` after `duration` seconds of game time, then `repeat` more times, each a
 * `duration` later, and is then removed. Cancel it with `cancelTimer`, by removing `Timers`, or
 * by destroying the entity. Needs the `motion()` plugin.
 *
 * For how long a state has had its value, read `states.timeIn` instead: a timer is for
 * something that must happen once, or again and again, at a time.
 *
 * @example
 * addTimer(ctx, entity, "myGame.toResults", { duration: 1.5, state: [Phase, "over"] });
 */
export declare function addTimer(ctx: MotionCtx, entity: Entity, name: string, options: TimerOptions): Timer;
/** Removes the timer called `name` from `entity`, unfired. Returns whether there was one. */
export declare function cancelTimer(ctx: MotionCtx, entity: Entity, name: string): boolean;
/**
 * Tweens numeric fields of `component` on `entity` to `to` over `duration` seconds of game time.
 * The entity must have the component. A tween with the same name is replaced, and fields this
 * tween drives are taken from any other tween of that component on the entity, so the newest
 * tween of a field wins. Returns the tween's name. Needs the `motion()` plugin.
 *
 * @example
 * addTween(ctx, fish, Transform2D, { to: { x: 300, rotation: Math.PI }, duration: 0.6, ease: "quadOut" });
 * addTween(ctx, fish, Display2D, { from: { alpha: 0 }, to: { alpha: 1 }, duration: 0.3 });
 */
export declare function addTween<T>(ctx: MotionCtx, entity: Entity, component: ComponentType<T>, options: TweenOptions<T>): string;
/** Removes the tween called `name` from `entity`, leaving its fields where they are. Returns whether there was one. */
export declare function cancelTween(ctx: MotionCtx, entity: Entity, name: string): boolean;
/**
 * Runs timers and tweens: `addTimer` and `addTween` need it. It adds the `MotionSettings`
 * resource and one system, `fenrir.motion.preUpdate`, which advances every timer and tween of
 * the active scene by `time.delta`. Plugins install before the game adds its systems, so it runs
 * before the game's `PreUpdate` systems, and the game's `Update` systems and the renderer see
 * this frame's values. A game without it ships none of this code.
 *
 * @example
 * const game = await createGame({ canvas, plugins: [motion(), pixi2d()] });
 */
export declare function motion(): Plugin$1;
/**
 * Where stored values go. Synchronous, like `localStorage`, so systems can read every frame.
 * Each method may throw: the storage functions catch it, keep the value in memory and report it.
 */
export interface StorageBackend {
	/** Shown in `StorageStatus.backend`, such as `"localStorage"` or `"memory"`. */
	readonly name: string;
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
	/**
	 * For a backend whose real store is asynchronous, such as a host app's bridge in a webview:
	 * loads it into memory before the first run. The plugin awaits it in `PreInit`, so systems
	 * read hydrated values; `getItem` and `setItem` then work on that copy, and the backend
	 * writes it through on its own. If it rejects, the game carries on with memory only.
	 */
	hydrate?(): Promise<void>;
}
/** A typed storage key, made by `defineStorageKey`. Plain data apart from `parse` and `migrate`. */
export interface StorageKey<T> {
	/** Namespaced, such as `myGame.muted`. Also the key in the backend, after the plugin's `prefix`. */
	readonly name: string;
	readonly default: T;
	/** The format version written with each value. */
	readonly version: number;
	/** Turns a stored JSON value into `T`, or returns `undefined` (or throws) if it is not one. */
	readonly parse: (value: unknown) => T | undefined;
	/** Turns a value written by an older `version` into this version's shape, before `parse`. */
	readonly migrate?: (value: unknown, from: number) => unknown;
}
export interface StorageKeyOptions<T> {
	/** What a read returns when nothing valid is stored. Objects are copied, so mutating one is safe. */
	default: T;
	/**
	 * Checks a stored value and returns it as `T`, or `undefined` (or throws) if it is invalid.
	 * Defaults to a check that the value has the default's `typeof` (and is an array when the
	 * default is), which is enough for primitives. Pass one for objects.
	 */
	parse?: (value: unknown) => NoInfer<T> | undefined;
	/** A whole number, 1 or more. Defaults to 1. Raise it when the shape changes, with `migrate`. */
	version?: number;
	/**
	 * Upgrades a value written by an older version: `from` is its version, or 0 for a value not
	 * written by Fenrir (a game's own `localStorage.setItem` from before), as JSON if it parses and
	 * as the raw string if not. Its result goes through `parse`; throwing means "use the default".
	 */
	migrate?: (value: unknown, from: number) => unknown;
}
/** Where storage stands, as plain data: `game.inspect()` shows it under `fenrir.StorageStatus`. */
export interface StorageStatus {
	/** The backend in use: `"localStorage"`, `"memory"`, or an injected backend's name. */
	backend: string;
	/** False when values live only in memory for this session: storage was unavailable or failed to hydrate. */
	persistent: boolean;
	/** The latest failure: an unavailable store, a write that threw (quota), or a value that did not parse. */
	lastError: {
		key: string | null;
		message: string;
	} | null;
}
export declare const StorageStatus: ResourceType<StorageStatus>;
/** What the storage functions need: a `SystemCtx`, or the `Game` or `TestGame` itself. */
export type StorageCtx = {
	readonly resources: Resources;
	readonly logger: ILogger;
};
export interface StorageOptions {
	/** Defaults to `localStorage`, or to memory when it is unavailable (private mode, blocked in a webview). */
	backend?: StorageBackend;
	/** Put before every key name in the backend, such as a player or save slot: `"slot2:"`. Defaults to none. */
	prefix?: string;
}
/**
 * A backend that keeps values in a `Map`: the fallback when `localStorage` is unavailable, and
 * the backend for tests. `items` is the map, so a test can seed it or assert on what was written.
 *
 * @example
 * const store = memoryStorage({ "myGame.muted": '{"v":1,"value":true}' });
 * const game = await createTestGame({ seed: 1, plugins: [storage({ backend: store })] });
 */
export declare function memoryStorage(items?: Record<string, string>): StorageBackend & {
	readonly items: Map<string, string>;
};
/**
 * Defines a stored value: its key, its default and how to check what is read back. As with
 * components, the name is the identity and is namespaced: `myGame.muted`. Values are stored as
 * JSON with their version: `{"v":1,"value":true}`.
 *
 * @example
 * const Muted = defineStorageKey("myGame.muted", { default: false });
 * const Best = defineStorageKey("myGame.best", {
 *   default: { score: 0, level: 1 },
 *   version: 2,
 *   parse: (v) => (isRecord(v) && typeof v.score === "number" && typeof v.level === "number" ? { score: v.score, level: v.level } : undefined),
 *   migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v, level: 1 } : v), // v1 stored a bare number
 * });
 */
export declare function defineStorageKey<T>(name: string, options: StorageKeyOptions<T>): StorageKey<T>;
/**
 * The stored value of `key`: what was set this session, else what the backend holds if it is
 * valid, else the default. Never throws. A value that cannot be read, is not JSON, is from a
 * newer version or does not parse gives the default, logged once per key. Cached after the first
 * read, so reading every frame is cheap. Mutating a returned object changes the cached value
 * only: call `setStored` to save it.
 */
export declare function getStored<T>(ctx: StorageCtx, key: StorageKey<T>): T;
/**
 * Stores `value` under `key`. Never throws: if the backend refuses it (quota, blocked, or a
 * value JSON cannot hold), the value is kept in memory, so `getStored` returns it for the rest
 * of the session, and the failure is logged once per key and set in `StorageStatus.lastError`.
 * Returns whether the backend took it.
 */
export declare function setStored<T>(ctx: StorageCtx, key: StorageKey<T>, value: NoInfer<T>): boolean;
/** Stores `update(current)` under `key` and returns it. As `setStored`, it never throws. */
export declare function updateStored<T>(ctx: StorageCtx, key: StorageKey<T>, update: (current: T) => NoInfer<T>): T;
/** Removes `key` from the backend and from memory, so the next read gives the default. Never throws. */
export declare function removeStored(ctx: StorageCtx, key: StorageKey<unknown>): void;
/**
 * Stores typed values: `getStored`, `setStored`, `updateStored` and `removeStored` need it. It
 * adds the `StorageStatus` resource and uses `localStorage` unless given a `backend`. When
 * `localStorage` is unavailable (private mode, storage blocked in a webview or sandboxed frame),
 * it falls back to memory, logs one warning and sets `StorageStatus.persistent` to false: the
 * game keeps working, and values last for the session.
 *
 * A backend with `hydrate` is awaited once, in `fenrir.storage.preInit`, before the first run's
 * other startup systems. Values are not tied to a run: they stay across `stop()` and `run()`.
 * Changes made by another tab are not seen while a value is cached.
 *
 * @example
 * const game = await createGame({ canvas, plugins: [storage(), pixi2d()] });
 * const test = await createTestGame({ seed: 1, plugins: [storage({ backend: memoryStorage() })] });
 */
export declare function storage(options?: StorageOptions): Plugin$1;
export declare class ConsoleLogger implements ILogger {
	trace(message: string, meta?: LogMeta): void;
	debug(message: string, meta?: LogMeta): void;
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, meta?: LogMeta): void;
}
export declare class NullLogger implements ILogger {
	trace(_m: string, _meta?: LogMeta): void;
	debug(_m: string, _meta?: LogMeta): void;
	info(_m: string, _meta?: LogMeta): void;
	warn(_m: string, _meta?: LogMeta): void;
	error(_m: string, _meta?: LogMeta): void;
}
/** A 3D vector as the core reads it. Three's `Vector3` satisfies it. */
export type Vec3Like = {
	x: number;
	y: number;
	z: number;
};
/** A rotation quaternion as the core reads it. Three's `Quaternion` satisfies it. */
export type QuatLike = {
	x: number;
	y: number;
	z: number;
	w: number;
};
export type Name = {
	name: string;
};
export declare const Name: ComponentType<Name>;
export type Relationship = {
	parent: Entity;
	firstChild: Entity;
	nextSibling: Entity;
	prevSibling: Entity;
};
export declare const Relationship: ComponentType<Relationship>;
/**
 * Position, rotation and scale in 2D, as plain numbers: logical units for `x` and `y`,
 * radians for `rotation`. Opt in per entity; entities still get the default `Transform`.
 * The 2D renderer writes it to an entity's `PixiNode` and `Renderable2D` each frame and
 * prefers it over `Transform` when an entity has both. It is plain data, so game logic and
 * `createTestGame` tests use it with no renderer.
 */
export type Transform2D = {
	x: number;
	y: number;
	rotation: number;
	scaleX: number;
	scaleY: number;
};
export declare const Transform2D: ComponentType<Transform2D>;
/**
 * How an entity's 2D node or `Renderable2D` view is shown: `alpha` from 0 to 1 and `visible`.
 * Opt in per entity. The 2D renderer writes it each frame, with `Transform2D`, and it wins over
 * a `Renderable2D`'s `flags.alpha` and `flags.visible`. Without it the renderer leaves the
 * node's own `alpha` and `visible` alone; removing it leaves the last values written.
 */
export type Display2D = {
	alpha: number;
	visible: boolean;
};
export declare const Display2D: ComponentType<Display2D>;
export type ValueOrFactory<T> = T | ((e: Entity, entities: EntityList) => T);
export declare class EntityBuilder {
	private readonly ops;
	private readonly children;
	private constructor();
	static create(): EntityBuilder;
	with<T>(type: ComponentType<T>, value: ValueOrFactory<T>): this;
	/**
	 * Modify an existing component on the entity.
	 * If the component doesn't exist, it will be created with the modifier function.
	 */
	modify<T>(type: ComponentType<T>, modifier: (existing: T | undefined, e: Entity, entities: EntityList) => T): this;
	/**
	 * Add a child prefab.
	 * You can pass an existing EntityBuilder or a builder callback.
	 */
	child(child: EntityBuilder | ((p: EntityBuilder) => void)): this;
	/**
	 * Spawns a root entity (no parent)
	 */
	spawn(entities: EntityList): Entity;
	/**
	 * Spawns and parents under an existing entity
	 */
	spawnInto(entities: EntityList, parent: Entity): Entity;
	private applyTo;
	static extend<T extends Record<string, any>>(methods: T): void;
}
export interface EntityBuilder {
	transform(pos?: Vec3Like, rot?: QuatLike, scale?: Vec3Like): EntityBuilder;
	name(value: string): EntityBuilder;
	/** Adds `Transform2D`: `x`, `y` in logical units, `rotation` in radians, scale 1 unless given. */
	transform2D(x?: number, y?: number, options?: {
		rotation?: number;
		scaleX?: number;
		scaleY?: number;
	}): EntityBuilder;
	/** Adds `Display2D`: `alpha` 1 and `visible` true unless given. */
	display2D(options?: {
		alpha?: number;
		visible?: boolean;
	}): EntityBuilder;
}
/** One asset of a manifest: its kind, where it loads from, and optionally a fallback. */
export interface AssetDeclaration<Name extends string = string> {
	/** An asset kind this program knows, such as `"texture2d"` from `fenrir-ts/2d`. */
	readonly kind: AssetKind;
	/** The URL the kind's loader reads, chosen by its extension. */
	readonly src: string;
	/**
	 * Another asset of the same manifest and kind, used in this one's place if it fails to load.
	 * Every bundle that lists this asset also loads the fallback. A fallback has no fallback.
	 */
	readonly fallback?: Name;
}
/** The assets of a manifest, by name. */
export type AssetDeclarations = {
	readonly [name: string]: AssetDeclaration;
};
/** Where one asset of a manifest stands. `fallback`: it failed and its fallback is shown instead. */
export type AssetStatus = "unloaded" | "loading" | "loaded" | "fallback" | "failed";
/** Where one bundle stands. `failed`: an asset without a fallback failed; the others loaded. */
export type BundleStatus = "unloaded" | "loading" | "loaded" | "failed";
/** One asset in `AssetProgress`. */
export interface AssetState {
	status: AssetStatus;
	/** Why it failed, when its status is `failed` or `fallback`. */
	error: string | null;
	/** The loading or loaded bundles of this manifest that hold it. It is unloaded when none do. */
	bundles: string[];
}
/** Counts over a set of assets. `fraction` is `loaded / total`, or 1 when `total` is 0. */
export interface AssetCounts {
	/** Assets ready to read: loaded, or showing their fallback. */
	loaded: number;
	/** Assets that failed with no fallback. */
	failed: number;
	total: number;
	fraction: number;
}
/** One bundle in `AssetProgress`. Its counts include the fallbacks it loads. */
export interface BundleProgress extends AssetCounts {
	status: BundleStatus;
}
/**
 * A manifest's progress, as plain data: the value of `manifest.progress`, a resource, so a HUD
 * reads it each frame with `ctx.resources.get(manifest.progress)` and `game.inspect()` shows it.
 * The top-level counts are over every asset a loading or loaded bundle holds.
 */
export interface AssetProgress<A extends string = string, B extends string = string> extends AssetCounts {
	bundles: Record<B, BundleProgress>;
	assets: Record<A, AssetState>;
}
/** A manifest, made by `defineAssets`. Plain data apart from `progress`, which is a resource handle. */
export interface AssetManifest<A extends AssetDeclarations = AssetDeclarations, B extends string = string> {
	/** Namespaced, such as `myGame.assets`. Also the name of `progress`. */
	readonly name: string;
	readonly assets: A;
	/** Asset names per bundle, as declared. */
	readonly bundles: {
		readonly [K in B]: readonly (keyof A & string)[];
	};
	/** The resource that holds this manifest's `AssetProgress` in each game. */
	readonly progress: ResourceType<AssetProgress<keyof A & string, B>>;
}
/** The name of an asset of `M`. */
export type AssetName<M extends AssetManifest<any, any>> = keyof M["assets"] & string;
/** The name of a bundle of `M`. */
export type BundleName<M extends AssetManifest<any, any>> = keyof M["bundles"] & string;
/** The loaded type of asset `N` of `M`, from its kind. */
export type ManifestAsset<A extends AssetDeclarations, N extends keyof A> = AssetKinds[A[N]["kind"]];
/** What the manifest functions need: a `SystemCtx`, or the `Game` or `TestGame` itself. */
export type AssetCtx = {
	readonly assets: AssetStore;
	readonly resources: Resources;
	readonly events: EventBus;
	readonly logger: ILogger;
};
/** One asset that failed with no fallback. */
export interface AssetFailure {
	asset: string;
	src: string;
	error: string;
}
/** Sent when a bundle has loaded, every asset ready or showing its fallback. */
export declare const AssetBundleLoaded: EventType<{
	manifest: string;
	bundle: string;
	fallbacks: string[];
}>;
/** Sent when a bundle has settled with at least one asset failed and no fallback for it. */
export declare const AssetBundleFailed: EventType<{
	manifest: string;
	bundle: string;
	failures: AssetFailure[];
}>;
/** The rejection of `loadAssets` when a bundle failed. Every asset of the bundle was tried first. */
export declare class AssetBundleError extends Error {
	readonly manifest: string;
	readonly bundle: string;
	readonly failures: readonly AssetFailure[];
	constructor(manifest: string, bundle: string, failures: readonly AssetFailure[], cause: unknown);
}
/** Loads manifest assets in place of the store's loaders. See `setAssetLoader`. */
export interface ManifestLoader {
	load(asset: {
		readonly name: string;
		readonly kind: AssetKind;
		readonly src: string;
	}): Promise<unknown>;
	/** Called with the loaded value when the last bundle holding an asset is unloaded. */
	unload?(asset: {
		readonly name: string;
		readonly kind: AssetKind;
		readonly src: string;
	}, value: unknown): void;
}
/**
 * Declares a game's assets once, by name, and groups them into bundles: `boot`, and one per level
 * or location. Plain data: `manifest.assets` and `manifest.bundles` are what was passed, so a
 * tool or a test can read them. An asset in two bundles is loaded once and kept until the last
 * bundle holding it is unloaded.
 *
 * An asset's name is its key in `game.assets`, so `getTexture2D(name)` and `renderSprite(name)`
 * read it too. Two manifests that use one name must declare the same kind and source.
 *
 * Throws if a bundle lists an unknown asset, a fallback is unknown, of another kind or has its
 * own fallback, or two assets of one kind share a source.
 *
 * @example
 * const GameAssets = defineAssets("myGame.assets", {
 *   assets: {
 *     logo: { kind: "texture2d", src: "img/logo.png" },
 *     missing: { kind: "texture2d", src: "img/missing.png" },
 *     reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
 *   },
 *   bundles: { boot: ["logo"], reef: ["reef", "logo"] },
 * });
 */
export declare function defineAssets<const A extends AssetDeclarations, const B extends {
	readonly [bundle: string]: readonly (keyof A & string)[];
}>(name: string, manifest: {
	readonly assets: A & {
		readonly [N in keyof A]: {
			readonly fallback?: keyof A & string;
		};
	};
	readonly bundles: B;
}): AssetManifest<A, keyof B & string>;
/**
 * Loads one or more bundles of `manifest` into the game's asset store, with progress in
 * `manifest.progress`. Call it from a system (without awaiting in a sync stage) or from setup
 * code. Safe to call again: a loading or loaded bundle returns the same promise, and an asset
 * shared with another bundle is loaded once. Calling it on a failed bundle retries the assets
 * that failed.
 *
 * Every asset of a bundle is tried. An asset that fails shows its fallback if it declares one;
 * one that fails without a fallback fails the bundle, which is logged, sends `AssetBundleFailed`
 * and rejects with an `AssetBundleError` naming each asset and source. The assets that loaded
 * stay loaded. A bundle with no failure sends `AssetBundleLoaded` and resolves.
 *
 * To hold `run()` until a bundle is ready, await it in a `PreInit` system: a failure then rolls
 * startup back and `run()` rejects with it.
 */
export declare function loadAssets<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, bundles: NoInfer<B> | readonly NoInfer<B>[]): Promise<void>;
/**
 * Unloads bundles of `manifest`. Each asset no other bundle (of any manifest) still holds is
 * dropped from the asset store, and its loader's `unload` runs: for a 2D texture that is Pixi's
 * `Assets.unload`, which destroys the texture. Remove the entities that show a bundle's assets
 * before unloading it; a sprite still showing a destroyed texture draws nothing or fails to render.
 * A bundle still loading is unloaded too, and its `loadAssets` promise rejects.
 */
export declare function unloadAssets<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, bundles: NoInfer<B> | readonly NoInfer<B>[]): void;
/**
 * The loaded asset `name` of `manifest`, typed by its kind: a Pixi `Texture` for `texture2d`.
 * Its fallback's value if it failed and has one. Throws if no bundle holding it has loaded it yet;
 * read `manifest.progress`, or wait for `AssetBundleLoaded`, to know when it has.
 */
export declare function getAsset<A extends AssetDeclarations, N extends keyof A & string>(ctx: AssetCtx, manifest: AssetManifest<A, string>, name: N): ManifestAsset<A, N>;
/**
 * Makes every manifest of this game load through `loader` instead of the asset store's loaders,
 * so a test or tool decides when each asset resolves or fails, with no network. `null` restores
 * the store's loaders. Affects loads that start afterwards.
 */
export declare function setAssetLoader(target: Pick<AssetCtx, "assets">, loader: ManifestLoader | null): void;
export type SkyboxType = "cubemap" | "equirectangular" | "color";
/**
 * Cube map texture configuration for skybox.
 * Uses standard cube map face naming convention.
 */
export type SkyboxCubemapTextures = {
	readonly posX: AssetKey;
	readonly negX: AssetKey;
	readonly posY: AssetKey;
	readonly negY: AssetKey;
	readonly posZ: AssetKey;
	readonly negZ: AssetKey;
};
/**
 * Equirectangular texture configuration for HDR skyboxes.
 */
export type SkyboxEquirectangularTextures = {
	readonly texture: AssetKey;
};
/**
 * Color configuration for solid color skyboxes.
 */
export type SkyboxColorTextures = {
	readonly color: number;
};
/**
 * Union type for different skybox texture configurations.
 */
export type SkyboxTextures = SkyboxCubemapTextures | SkyboxEquirectangularTextures | SkyboxColorTextures;
/**
 * Scene-level skybox descriptor, stored on the scene with `scene.setSkybox` from
 * `fenrir-ts/3d`, not as an ECS component.
 */
export type SkyboxDescriptor = {
	readonly type: SkyboxType;
	readonly textures: SkyboxTextures;
	readonly enabled?: boolean;
};
/**
 * The engine's `fenrir.Transform` component, typed with Three's classes.
 *
 * It is the same component as `Transform` from `fenrir-ts`: identity is the name,
 * so both keys read and write the same storage. Loading this module makes every
 * default transform out of Three objects, which the 3D renderer, camera and
 * physics rely on.
 */
export type Transform = {
	position: Vector3;
	rotation: Quaternion;
	scale: Vector3;
};
export declare const Transform: ComponentType<Transform>;
export interface Scene {
	/** This scene's skybox, read by the skybox system. Set it with `setSkybox`. */
	skybox?: SkyboxDescriptor;
	/** Sets the skybox for this scene, or removes it with `undefined`. */
	setSkybox(skybox: SkyboxDescriptor | undefined): void;
	/** Removes the skybox from this scene. */
	removeSkybox(): void;
	/** Whether this scene has a skybox that is not disabled. */
	hasSkybox(): boolean;
}
export type LoadedModel = {
	geometry: THREE.Object3D;
	animations: THREE.AnimationClip[];
	materials: THREE.Material[];
};
export type ModelLoaderConfig = LoaderConfig<LoadedModel>;
export type TextureLoaderConfig = LoaderConfig<THREE.Texture>;
export interface AssetKinds {
	model: LoadedModel;
	texture3d: THREE.Texture;
}
export interface AssetStoreConfig {
	modelLoaders?: {
		[name: string]: ModelLoaderConfig;
	};
	textureLoaders?: {
		[name: string]: TextureLoaderConfig;
	};
}
export interface IAssetStore {
	loadModel(key: AssetKey, url: string): Promise<void>;
	loadTexture(key: AssetKey, url: string): Promise<void>;
	getGeometry(key: AssetKey): Promise<THREE.Object3D>;
	getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
	getMaterials(key: AssetKey): Promise<THREE.Material[]>;
	getTexture(key: AssetKey): Promise<THREE.Texture>;
	registerModelLoader(name: string, config: ModelLoaderConfig): void;
	registerTextureLoader(name: string, config: TextureLoaderConfig): void;
	getSupportedModelExtensions(): string[];
	getSupportedTextureExtensions(): string[];
}
export interface AssetStore {
	loadModel(key: AssetKey, url: string): Promise<void>;
	loadTexture(key: AssetKey, url: string): Promise<void>;
	getGeometry(key: AssetKey): Promise<THREE.Object3D>;
	getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
	getMaterials(key: AssetKey): Promise<THREE.Material[]>;
	getTexture(key: AssetKey): Promise<THREE.Texture>;
	registerModelLoader(name: string, config: ModelLoaderConfig): void;
	registerTextureLoader(name: string, config: TextureLoaderConfig): void;
	getSupportedModelExtensions(): string[];
	getSupportedTextureExtensions(): string[];
}
export type GeometryDesc = {
	kind: "box";
	size?: [
		number,
		number,
		number
	];
} | {
	kind: "plane";
	size?: [
		number,
		number
	];
} | {
	kind: "sphere";
	radius?: number;
	widthSeg?: number;
	heightSeg?: number;
} | {
	kind: "model";
	key: AssetKey;
};
export type MaterialDesc = {
	kind: "standard";
	color?: number;
	roughness?: number;
	metalness?: number;
} | {
	kind: "lambert";
	color?: number;
} | {
	kind: "basic";
	color?: number;
} | {
	kind: "asset";
	key: AssetKey;
} | {
	kind: "none";
};
export type RenderFlags = {
	visible?: boolean;
	castShadow?: boolean;
	receiveShadow?: boolean;
	layer?: number;
};
/**
 * Primary renderable component — purely data.
 * `id` allows renderer to keep a stable mapping even if you later allow multiple renderables per entity.
 */
export type Renderable = {
	id: number;
	geometry: GeometryDesc;
	material: MaterialDesc;
	flags?: RenderFlags;
	/**
	 * Optional hint for future batching/instancing:
	 * entities with same batchKey could be merged/instanced.
	 */
	batchKey?: string;
};
export declare const Renderable: ComponentType<Renderable>;
export type ModelRenderableOpts = {
	readonly id?: number;
	readonly flags?: RenderFlags;
};
export type PrimitiveRenderableOpts = {
	readonly id?: number;
	readonly material?: MaterialDesc;
	readonly flags?: RenderFlags;
};
export interface EntityBuilder {
	model(key: AssetKey, opts?: ModelRenderableOpts): EntityBuilder;
	renderBox(size?: [
		number,
		number,
		number
	], opts?: PrimitiveRenderableOpts): EntityBuilder;
	renderSphere(radius?: number, widthSeg?: number, heightSeg?: number, opts?: PrimitiveRenderableOpts): EntityBuilder;
	renderPlane(size?: [
		number,
		number
	], opts?: PrimitiveRenderableOpts): EntityBuilder;
}
export type AnimateOpts = Partial<{
	animationName: string;
	animationIndex: number;
	playing: boolean;
	loop: boolean;
	speed: number;
	timeScale: number;
	autoPlay: boolean;
	weight: number;
	fadeDuration: number;
}>;
export interface EntityBuilder {
	animate(assetKey: AssetKey, opts?: AnimateOpts): EntityBuilder;
	play(): EntityBuilder;
	pause(): EntityBuilder;
}
export type CameraProjectionType = "perspective" | "orthographic";
export type CameraViewport = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};
export type CameraClearFlags = {
	readonly color: boolean;
	readonly depth: boolean;
	readonly stencil: boolean;
};
export type Camera = {
	readonly fov: number;
	readonly near: number;
	readonly far: number;
	readonly aspectRatio?: number;
	readonly projectionType: CameraProjectionType;
	readonly orthoSize?: number;
	readonly orthoLeft?: number;
	readonly orthoRight?: number;
	readonly orthoTop?: number;
	readonly orthoBottom?: number;
	readonly viewport?: CameraViewport;
	readonly priority: number;
	readonly clearFlags: CameraClearFlags;
	readonly clearColor?: number;
	readonly enabled: boolean;
};
export declare const Camera: ComponentType<Camera>;
/**
 * Marks an entity as the active camera for the scene.
 * Only one entity should have this component at a time per scene.
 */
export type ActiveCamera = {
	readonly priority: number;
};
export declare const ActiveCamera: ComponentType<ActiveCamera>;
/**
 * Optional component for cameras that should look at a specific target.
 * This is a helper component - user systems can use this to implement look-at behavior.
 */
export type CameraTarget = {
	readonly target: Vector3;
	readonly up: Vector3;
};
export declare const CameraTarget: ComponentType<CameraTarget>;
/**
 * Runtime component managed by the camera system.
 * Contains the actual Three.js camera instance.
 */
export type CameraInstance = {
	readonly threeCamera: PerspectiveCamera | OrthographicCamera;
	readonly lastUpdateFrame: number;
};
export declare const CameraInstance: ComponentType<CameraInstance>;
export declare function createPerspectiveCamera(opts: {
	fov?: number;
	near?: number;
	far?: number;
	aspectRatio?: number;
	viewport?: CameraViewport;
	priority?: number;
	clearColor?: number;
	enabled?: boolean;
}): Camera;
export declare function createOrthographicCamera(opts: {
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
}): Camera;
export declare function createCameraTarget(target: Vector3, up?: Vector3): CameraTarget;
export declare function defaultViewport(): CameraViewport;
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
export interface EntityBuilder {
	perspectiveCamera(options?: PerspectiveCameraOptions): EntityBuilder;
	orthographicCamera(options?: OrthographicCameraOptions): EntityBuilder;
	lookAt(target: Vector3, up?: Vector3): EntityBuilder;
	lookAt(x: number, y: number, z: number): EntityBuilder;
	activeCamera(priority?: number): EntityBuilder;
	mainCamera(options?: PerspectiveCameraOptions): EntityBuilder;
	uiCamera(options?: OrthographicCameraOptions): EntityBuilder;
}
export type DomInputOptions = {
	target?: Window | HTMLElement;
	preventDefaults?: boolean;
};
export declare function createDomInputSystems(opts?: DomInputOptions): {
	readonly init: SyncSystemFn;
	readonly exit: SyncSystemFn;
};
export declare class InputState {
	private down;
	private pressed;
	private released;
	mouseX: number;
	mouseY: number;
	mouseDX: number;
	mouseDY: number;
	wheelDX: number;
	wheelDY: number;
	hasFocus: boolean;
	beginFrame(): void;
	isDown(code: string): boolean;
	wasPressed(code: string): boolean;
	wasReleased(code: string): boolean;
	_setKeyDown(code: string): void;
	_setKeyUp(code: string): void;
	clearAll(): void;
}
export declare function createInputStateSystem(): {
	state: InputState;
	preUpdate: SyncSystemFn;
};
/**
 * Runtime skybox instance managed by the skybox system.
 * Uses Three.js scene.background for proper skybox rendering.
 * This is the recommended approach per Three.js documentation.
 */
export type SkyboxInstance = {
	readonly background: Texture | CubeTexture | Color;
};
/**
 * Create a cube map skybox configuration.
 * Follows standard cube map face naming convention.
 */
export declare function createCubemapSkybox(opts: {
	posX: AssetKey;
	negX: AssetKey;
	posY: AssetKey;
	negY: AssetKey;
	posZ: AssetKey;
	negZ: AssetKey;
	enabled?: boolean;
}): SkyboxDescriptor;
/**
 * Create an equirectangular skybox configuration.
 * Used for HDR environment maps or panoramic images.
 */
export declare function createEquirectangularSkybox(opts: {
	texture: AssetKey;
	enabled?: boolean;
}): SkyboxDescriptor;
/**
 * Utility function to check if textures are cube map type.
 */
export declare function isCubemapTextures(textures: SkyboxTextures): textures is SkyboxCubemapTextures;
/**
 * Utility function to check if textures are equirectangular type.
 */
export declare function isEquirectangularTextures(textures: SkyboxTextures): textures is SkyboxEquirectangularTextures;
/**
 * Utility function to check if textures are color type.
 */
export declare function isColorTextures(textures: SkyboxTextures): textures is SkyboxColorTextures;
/**
 * Create a color skybox configuration.
 * Uses a solid color background instead of textures.
 */
export declare function createColorSkybox(opts: {
	color: number;
	enabled?: boolean;
}): SkyboxDescriptor;
export type RendererType = "webgl" | "webgpu";
export interface ThreeRendererOptions {
	canvas?: HTMLCanvasElement;
	logger: ILogger;
	width?: number;
	height?: number;
	clearColor?: number;
	assets: IAssetStore;
	rendererType?: RendererType;
}
export type AnyRenderer = THREE.WebGLRenderer | THREE_WEBGPU.WebGPURenderer;
/** True when the WebGPU globals that `three/webgpu` reads at load time exist. */
export declare function isWebGPUAvailable(): boolean;
export declare class ThreeRenderer {
	readonly scene: THREE.Scene<THREE.Object3DEventMap>;
	readonly camera: THREE.PerspectiveCamera;
	private readonly objects;
	private readonly geomCache;
	private readonly matCache;
	private readonly assets;
	private readonly logger;
	private readonly canvas;
	private readonly clearColor;
	private width;
	private height;
	private currentSkybox;
	private isInitialized;
	private initPromise;
	/** Requested renderer type. See `rendererType` for the one in use. */
	readonly requestedRendererType: RendererType;
	private activeRendererType;
	private threeRenderer;
	constructor(opts: ThreeRendererOptions);
	/**
	 * The underlying three.js renderer. For `"webgpu"` it exists only after `init()` resolves.
	 */
	get renderer(): AnyRenderer;
	/**
	 * Renderer type in use. Starts as the requested type and becomes `"webgl"`
	 * after init() if WebGPU was requested but is unavailable.
	 */
	get rendererType(): RendererType;
	/**
	 * Initialize the renderer. For `"webgpu"` this loads `three/webgpu` and creates
	 * the renderer; without WebGPU it logs a warning and uses WebGL instead.
	 */
	init(): Promise<void>;
	private doInit;
	private createWebGPUOrFallback;
	private createWebGLRenderer;
	private configure;
	/**
	 * Check if renderer is initialized
	 */
	get initialized(): boolean;
	resize(width: number, height: number): void;
	/** Call when Renderable is added or replaced (if geometry/material can change). */
	upsertRenderable(entities: EntityList, e: Entity, r: Renderable): Promise<void>;
	/** Call when Renderable is removed or entity destroyed. */
	removeRenderable(e: Entity, renderId: number): void;
	/** Sync transforms for all renderables each frame. */
	syncTransforms(entities: EntityList): void;
	/**
	 * Render with cameras
	 */
	renderWithCameras(cameras: Array<[
		Entity,
		CameraInstance
	]>, _ecsScene?: Scene, skyboxInstance?: SkyboxInstance | null): void;
	/**
	 * Legacy render method (kept for backward compatibility)
	 */
	render(skyboxInstance: SkyboxInstance | null): void;
	/**
	 * Render with a specific camera
	 */
	renderWithCamera(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void;
	/** Get the rendered Three.js object for an entity/renderable ID */
	getRenderedObject(entity: Entity, renderableId: number): THREE.Object3D | undefined;
	dispose(): void;
	private getGeometry;
	private getMaterial;
	private applyFlags;
	private applyWorldTransform;
	/**
	 * Update skybox in the scene using Three.js recommended scene.background approach
	 */
	private updateSkybox;
	/**
	 * Get the current skybox instance
	 */
	getCurrentSkybox(): SkyboxInstance | null;
	/**
	 * Force remove skybox from scene
	 */
	removeSkybox(): void;
}
export type CameraSystemOptions = {
	defaultCanvasWidth?: number;
	defaultCanvasHeight?: number;
};
/**
 * Factory function that creates a camera system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export declare function createCameraSystem(options?: CameraSystemOptions): {
	readonly init: SyncSystemFn;
	readonly preUpdate: SyncSystemFn;
	readonly update: SyncSystemFn;
	readonly exit: SyncSystemFn;
	readonly getActiveCamera: (entities: EntityList) => number | null;
	readonly getCamerasSortedByPriority: (entities: EntityList) => [
		number,
		Camera,
		CameraInstance
	][];
	readonly getCameraInstance: (entities: EntityList, entity: Entity) => PerspectiveCamera | OrthographicCamera | null;
	readonly getCurrentFrame: () => number;
	readonly getCanvasSize: () => {
		width: number;
		height: number;
	};
};
export type SkyboxSystemOptions = {
	assets: IAssetStore;
};
/**
 * Factory function that creates a skybox system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export declare function createSkyboxSystem(options: SkyboxSystemOptions): {
	readonly init: AsyncSystemFn;
	readonly preUpdate: AsyncSystemFn;
	readonly exit: AsyncSystemFn;
	readonly getSkyboxInstance: (scene: Scene) => SkyboxInstance | null;
};
export type CameraSystemInstance = ReturnType<typeof createCameraSystem>;
export type SkyboxSystemInstance = ReturnType<typeof createSkyboxSystem>;
export declare function createThreeRendererSystem(opts: {
	logger: ILogger;
	canvas?: HTMLCanvasElement;
	clearColor?: number;
	assets: IAssetStore;
	cameraSystem: CameraSystemInstance | undefined;
	skyboxSystem: SkyboxSystemInstance | undefined;
	rendererType: RendererType | undefined;
}): {
	readonly init: AsyncSystemFn;
	readonly update: SyncSystemFn;
	readonly postUpdate: SyncSystemFn;
	readonly exit: SyncSystemFn;
	readonly renderer: ThreeRenderer;
};
type Animation$1 = {
	/** The asset key containing the animations */
	assetKey: AssetKey;
	/** Name of the animation to play (from the GLTF animations array) */
	animationName?: string;
	/** Animation index to play (alternative to name) */
	animationIndex?: number;
	/** Whether the animation is currently playing */
	playing: boolean;
	/** Loop the animation */
	loop: boolean;
	/** Animation speed multiplier */
	speed: number;
	/** Time scale for the animation */
	timeScale: number;
	/** Whether to auto-play on component add */
	autoPlay: boolean;
	/** Animation weight (for blending multiple animations) */
	weight: number;
	/** Fade in/out duration in seconds */
	fadeDuration?: number;
};
declare const Animation$1: ComponentType<Animation$1>;
export declare function createAnimationSystem(opts: {
	assets: IAssetStore;
	logger: ILogger;
	renderer: ThreeRenderer;
}): {
	readonly init: SyncSystemFn;
	readonly preUpdate: SyncSystemFn;
	readonly exit: SyncSystemFn;
};
export declare function createStatsSystem(parent: HTMLElement): {
	readonly postUpdate: SyncSystemFn;
};
/**
 * The systems bootstrapEngine registers for physics. `createPhysicsSystem()` from
 * `fenrir-ts/physics` returns one. Typed here by shape so the 3D entry does not
 * import Jolt.
 */
export type BootstrapPhysicsSystem = {
	init: AsyncSystemFn;
	tick: SyncSystemFn;
	exit: AsyncSystemFn;
};
export type BootstrapConfig = {
	canvas: HTMLCanvasElement;
	/** Physics to register, for example `createPhysicsSystem()` from `fenrir-ts/physics`. */
	physics?: BootstrapPhysicsSystem;
	enableAnimations?: boolean;
	enableStats?: boolean;
	domInput?: DomInputOptions | false;
	statsParent?: HTMLElement;
	rendererType?: "webgl" | "webgpu";
	clearColor?: number;
};
export type BootstrapResult = {
	assets: AssetStore;
	systems: {
		input: ReturnType<typeof createInputStateSystem>;
		renderer: ReturnType<typeof createThreeRendererSystem>;
		camera: ReturnType<typeof createCameraSystem>;
		skybox: ReturnType<typeof createSkyboxSystem>;
		animations?: ReturnType<typeof createAnimationSystem>;
		physics?: BootstrapPhysicsSystem;
		stats?: ReturnType<typeof createStatsSystem>;
	};
};
/**
 * Bootstrap the 3D engine systems with sensible defaults
 *
 * This creates and configures the systems a 3D game needs:
 * - Input handling
 * - Rendering (WebGL/WebGPU through Three.js)
 * - Camera management
 * - Skybox rendering
 * - Optional: Physics, Animations, Performance stats
 *
 * A 2D game does not use this: it registers the systems from `fenrir-ts/2d` itself.
 */
export declare function bootstrapEngine(engine: Engine, logger: ILogger, config: BootstrapConfig): BootstrapResult;
export declare function createGltfLoader(opts?: {
	loader?: GLTFLoader;
}): AssetLoader<LoadedModel>;
export declare function createObjLoader(opts?: {
	loader?: OBJLoader;
}): AssetLoader<LoadedModel>;
export declare function createTextureLoader(opts?: {
	loader?: TextureLoader;
}): AssetLoader<THREE.Texture>;
export declare function createHdrTextureLoader(opts?: {
	loader?: HDRLoader;
}): AssetLoader<THREE.Texture>;
/**
 * Utility functions for skybox management and common skybox configurations
 */
export declare class SkyboxUtils {
	private constructor();
	/**
	 * Load and set up a cube map skybox for a scene using individual face textures
	 */
	static setupCubemapSkybox(scene: Scene, assets: IAssetStore, options?: {
		basePath?: string;
		faces?: {
			posX?: string;
			negX?: string;
			posY?: string;
			negY?: string;
			posZ?: string;
			negZ?: string;
		};
		enabled?: boolean;
	}): Promise<void>;
	/**
	 * Load and set up an HDR equirectangular skybox for a scene
	 */
	static setupHdrSkybox(scene: Scene, assets: IAssetStore, texturePath: string, options?: {
		enabled?: boolean;
	}): Promise<void>;
	/**
	 * Set up the default skybox using embedded asset textures
	 */
	static setupDefaultSkybox(scene: Scene, assets: IAssetStore, options?: {
		enabled?: boolean;
	}): Promise<void>;
	/**
	 * Validate skybox descriptor
	 */
	static validateSkyboxDescriptor(descriptor: SkyboxDescriptor): {
		isValid: boolean;
		errors: string[];
	};
	/**
	 * Clone a skybox descriptor
	 */
	static cloneSkyboxDescriptor(descriptor: SkyboxDescriptor): SkyboxDescriptor;
}
export type KeyEvent = {
	code: string;
	key: string;
	repeat: boolean;
	altKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
};
export type MouseButtonEvent = {
	button: number;
	buttons: number;
	x: number;
	y: number;
	altKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
};
export type MouseMoveEvent = {
	x: number;
	y: number;
	dx: number;
	dy: number;
	buttons: number;
	altKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
};
export type MouseWheelEvent = {
	dx: number;
	dy: number;
	dz: number;
	ctrlKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	metaKey: boolean;
};
type FocusEvent$1 = {
	hasFocus: boolean;
};
declare const InputEvent$1: {
	readonly KeyDown: EventType<KeyEvent>;
	readonly KeyUp: EventType<KeyEvent>;
	readonly MouseDown: EventType<MouseButtonEvent>;
	readonly MouseUp: EventType<MouseButtonEvent>;
	readonly MouseMove: EventType<MouseMoveEvent>;
	readonly MouseWheel: EventType<MouseWheelEvent>;
	readonly Focus: EventType<FocusEvent$1>;
};
/**
 * 32-bit collision layer system similar to Godot
 * Each layer is represented as a single bit (1, 2, 4, 8, etc.)
 * Collision masks are bitwise combinations of layers
 */
export type CollisionLayer = number;
export type CollisionMask = number;
/**
 * Default layer definitions (users can define their own)
 */
export declare const DefaultLayers: {
	readonly LAYER_1: number;
	readonly LAYER_2: number;
	readonly LAYER_3: number;
	readonly LAYER_4: number;
	readonly LAYER_5: number;
	readonly LAYER_6: number;
	readonly LAYER_7: number;
	readonly LAYER_8: number;
};
/**
 * Commonly used layer presets for convenience
 */
export declare const CommonLayers: {
	readonly STATIC: number;
	readonly DYNAMIC: number;
	readonly KINEMATIC: number;
	readonly CHARACTER: number;
	readonly TRIGGER: number;
	readonly PROJECTILE: number;
	readonly DEBRIS: number;
	readonly VEHICLE: number;
};
/**
 * Layer naming system for user customization
 */
export declare class PhysicsLayerManager {
	private static layerNames;
	private static layerDescriptions;
	/**
	 * Set a custom name for a layer
	 */
	static setLayerName(layerIndex: number, name: string): void;
	/**
	 * Set a description for a layer
	 */
	static setLayerDescription(layerIndex: number, description: string): void;
	/**
	 * Get the name of a layer by index
	 */
	static getLayerName(layerIndex: number): string;
	/**
	 * Get the description of a layer by index
	 */
	static getLayerDescription(layerIndex: number): string;
	/**
	 * Get all configured layers
	 */
	static getAllLayers(): Array<{
		index: number;
		name: string;
		description: string;
		bit: number;
	}>;
	/**
	 * Get layer index from layer bit value
	 */
	static getLayerIndex(layer: CollisionLayer): number;
	/**
	 * Setup common layer names for convenience
	 */
	static setupCommonLayers(): void;
}
/**
 * Bitwise collision utilities for fast layer operations
 */
export declare class CollisionUtils {
	/**
	 * Check if a layer is present in a collision mask
	 */
	static hasLayer(mask: CollisionMask, layer: CollisionLayer): boolean;
	/**
	 * Add a layer to a collision mask
	 */
	static addLayer(mask: CollisionMask, layer: CollisionLayer): CollisionMask;
	/**
	 * Remove a layer from a collision mask
	 */
	static removeLayer(mask: CollisionMask, layer: CollisionLayer): CollisionMask;
	/**
	 * Check if two objects can collide based on layer and mask
	 */
	static canCollide(layer1: CollisionLayer, mask1: CollisionMask, layer2: CollisionLayer, mask2: CollisionMask): boolean;
	/**
	 * Create a collision mask from multiple layers
	 */
	static createMask(...layers: CollisionLayer[]): CollisionMask;
	/**
	 * Get all layers present in a collision mask
	 */
	static getLayersFromMask(mask: CollisionMask): CollisionLayer[];
	/**
	 * Convert a collision mask to human-readable layer names
	 */
	static maskToNames(mask: CollisionMask): string[];
	/**
	 * Create a collision mask that collides with all layers
	 */
	static allLayersMask(): CollisionMask;
	/**
	 * Create an empty collision mask (collides with nothing)
	 */
	static emptyMask(): CollisionMask;
}
/**
 * Helper to create common collision mask combinations
 */
export declare const CollisionMasks: {
	/**
	 * Static objects: collide with dynamic, kinematic, character, projectile, vehicle
	 */
	readonly static: () => CollisionMask;
	/**
	 * Dynamic objects: collide with everything except triggers and debris
	 */
	readonly dynamic: () => CollisionMask;
	/**
	 * Character controllers: collide with static, kinematic, triggers, vehicles
	 */
	readonly character: () => CollisionMask;
	/**
	 * Triggers: collide with character, dynamic, projectile
	 */
	readonly trigger: () => CollisionMask;
	/**
	 * Projectiles: collide with static, dynamic, character
	 */
	readonly projectile: () => CollisionMask;
	/**
	 * Collide with all layers
	 */
	readonly all: () => CollisionMask;
	/**
	 * Collide with nothing (sensor objects)
	 */
	readonly none: () => CollisionMask;
};
/**
 * Runtime module type (what you get back from `await initJolt()`).
 * Keep this if you pass the loaded module around.
 */
export type JoltModule = Awaited<ReturnType<typeof initJolt>>;
export type JoltVec3 = Jolt.Vec3;
export type JoltRVec3 = Jolt.RVec3;
export type JoltQuat = Jolt.Quat;
export type JoltBody = Jolt.Body;
export type JoltBodyID = Jolt.BodyID;
export type JoltBodyInterface = Jolt.BodyInterface;
export type JoltPhysicsSystem = Jolt.PhysicsSystem;
export type JoltBodyCreationSettings = Jolt.BodyCreationSettings;
export type JoltShape = Jolt.Shape;
export type JoltBoxShape = Jolt.BoxShape;
export type JoltSphereShape = Jolt.SphereShape;
export type JoltCapsuleShape = Jolt.CapsuleShape;
export type JoltCylinderShape = Jolt.CylinderShape;
export type JoltInterface = Jolt.JoltInterface;
export type JoltSettings = Jolt.JoltSettings;
export type JoltEMotionType = Jolt.EMotionType;
export type JoltEActivation = Jolt.EActivation;
export type JoltRMat44 = Jolt.RMat44;
export type JoltAllowedDOFs = Jolt.EAllowedDOFs;
/**
 * Color class used by debug renderer
 */
export interface JoltColor {
	mU32: number;
}
/**
 * Extended types for debug renderer (only available in debug builds)
 * These properties are not in the standard Jolt type definitions
 */
export interface JoltDebugModule extends JoltModule {
	readonly DebugRendererJS: new () => JoltDebugRendererJS;
	readonly DebugRendererVertexTraits: {
		prototype: {
			mPositionOffset: number;
			mNormalOffset: number;
			mUVOffset: number;
			mSize: number;
		};
	};
	readonly DebugRendererTriangleTraits: {
		prototype: {
			mVOffset: number;
			mSize: number;
		};
	};
	readonly EDrawMode_Wireframe: number;
	readonly ECullMode_Off: number;
	readonly ECullMode_CullBackFace: number;
	readonly ECullMode_CullFrontFace: number;
	readonly Color: {
		new (): JoltColor;
	};
	readonly HEAPF32: Float32Array;
	readonly HEAPU32: Uint32Array;
}
export interface JoltDebugRendererJS {
	Initialize(): void;
	DrawBodies(physicsSystem: JoltPhysicsSystem, drawSettings: unknown): void;
	DrawConstraints(physicsSystem: JoltPhysicsSystem): void;
	DrawConstraintLimits(physicsSystem: JoltPhysicsSystem): void;
	DrawLine: (inFrom: number, inTo: number, inColor: number) => void;
	DrawTriangle: (inV1: number, inV2: number, inV3: number, inColor: number, inCastShadow: number) => void;
	DrawText3D: (inPosition: number, inStringPtr: number, inStringLen: number, inColor: number, inHeight: number) => void;
	DrawGeometryWithID: (inModelMatrix: number, inWorldSpaceBounds: number, inLODScaleSq: number, inModelColor: number, inGeometryID: number, inCullMode: number, inCastShadow: number, inDrawMode: number) => void;
	CreateTriangleBatchID: (inTriangles: number, inTriangleCount: number) => number;
	CreateTriangleBatchIDWithIndex: (inVertices: number, inVertexCount: number, inIndices: number, inIndexCount: number) => number;
}
/**
 * Type guard to check if Jolt module has debug renderer
 */
export declare function isDebugJolt(jolt: JoltModule): jolt is JoltDebugModule;
/**
 * Wrapper utilities for converting between Three.js and Jolt types
 *
 */
export declare class JoltUtils {
	static vec3ToJolt(jolt: JoltModule, vec: Vector3): JoltVec3;
	static vec3ToJoltR(jolt: JoltModule, vec: Vector3): JoltRVec3;
	static quatToJolt(jolt: JoltModule, quat: Quaternion): JoltQuat;
	static joltVec3ToThree(joltVec: JoltVec3, out: Vector3): Vector3;
	static joltRVec3ToThree(joltVec: JoltRVec3, out: Vector3): Vector3;
	static joltQuatToThree(joltQuat: JoltQuat, out: Quaternion): Quaternion;
}
/**
 * Motion types for physics bodies
 */
export declare const MotionType: {
	readonly Static: 0;
	readonly Kinematic: 1;
	readonly Dynamic: 2;
};
export type MotionType = (typeof MotionType)[keyof typeof MotionType];
/**
 * Synchronization strategies between physics and transform components
 */
export declare const SyncMode: {
	readonly None: 0;
	readonly PhysicsToTransform: 1;
	readonly TransformToPhysics: 2;
	readonly Bidirectional: 3;
};
export type SyncMode = (typeof SyncMode)[keyof typeof SyncMode];
/**
 * Core physics body component that stores Jolt body reference and metadata
 */
export type PhysicsBody = {
	readonly motionType: MotionType;
	readonly collisionLayer: CollisionLayer;
	readonly collisionMask: CollisionMask;
	readonly syncMode: SyncMode;
	readonly mass?: number;
	readonly gravityFactor?: number;
	readonly allowSleeping?: boolean;
	readonly isSensor?: boolean;
	readonly lockRotation?: [
		boolean,
		boolean,
		boolean
	];
	bodyId?: JoltBodyID;
	joltBody?: JoltBody;
};
export declare const PhysicsBody: ComponentType<PhysicsBody>;
/**
 * Helper function to create a physics body configuration
 */
export declare function createPhysicsBody(config: {
	bodyId?: JoltBodyID;
	motionType: MotionType;
	collisionLayer?: CollisionLayer;
	collisionMask?: CollisionMask;
	syncMode?: SyncMode;
	mass?: number;
	gravityFactor?: number;
	allowSleeping?: boolean;
	isSensor?: boolean;
	lockRotation?: [
		boolean,
		boolean,
		boolean
	];
}): PhysicsBody;
/**
 * Supported physics shape types
 */
export declare const ShapeType: {
	readonly Box: "box";
	readonly Sphere: "sphere";
	readonly Capsule: "capsule";
	readonly Cylinder: "cylinder";
	readonly ConvexHull: "convexHull";
	readonly Compound: "compound";
	readonly Mesh: "mesh";
	readonly HeightField: "heightField";
};
export type ShapeType = (typeof ShapeType)[keyof typeof ShapeType];
/**
 * Box shape parameters
 */
export type BoxShapeParams = {
	readonly halfExtents: Vector3;
};
/**
 * Sphere shape parameters
 */
export type SphereShapeParams = {
	readonly radius: number;
};
/**
 * Capsule shape parameters
 */
export type CapsuleShapeParams = {
	readonly halfHeight: number;
	readonly radius: number;
};
/**
 * Cylinder shape parameters
 */
export type CylinderShapeParams = {
	readonly halfHeight: number;
	readonly radius: number;
};
/**
 * Convex hull shape parameters
 */
export type ConvexHullShapeParams = {
	readonly points: readonly Vector3[];
	readonly maxConvexRadius?: number;
};
/**
 * Compound shape parameters
 */
export type CompoundShapeParams = {
	readonly subShapes: readonly {
		readonly shape: PhysicsShape;
		readonly position: Vector3;
		readonly rotation: {
			x: number;
			y: number;
			z: number;
			w: number;
		};
	}[];
};
/**
 * Mesh shape parameters (for static complex geometry)
 */
export type MeshShapeParams = {
	readonly vertices: readonly number[];
	readonly indices: readonly number[];
};
/**
 * Height field shape parameters (for terrain)
 */
export type HeightFieldShapeParams = {
	readonly heights: readonly number[];
	readonly sampleCount: number;
	readonly scale: Vector3;
	readonly offset?: number;
};
/**
 * Union of all shape parameter types
 */
export type ShapeParams = BoxShapeParams | SphereShapeParams | CapsuleShapeParams | CylinderShapeParams | ConvexHullShapeParams | CompoundShapeParams | MeshShapeParams | HeightFieldShapeParams;
/**
 * Physics shape component that defines collision geometry
 */
export type PhysicsShape = {
	readonly shapeType: ShapeType;
	readonly parameters: ShapeParams;
	readonly convexRadius?: number;
	readonly centerOfMass?: Vector3;
	readonly userData?: unknown;
};
export declare const PhysicsShape: ComponentType<PhysicsShape>;
/**
 * Helper functions to create specific shape types
 */
export declare const ShapeBuilder: {
	readonly box: (halfExtents: Vector3, convexRadius?: number) => PhysicsShape;
	readonly sphere: (radius: number) => PhysicsShape;
	readonly capsule: (halfHeight: number, radius: number, convexRadius?: number) => PhysicsShape;
	readonly cylinder: (halfHeight: number, radius: number, convexRadius?: number) => PhysicsShape;
	readonly convexHull: (points: Vector3[], maxConvexRadius?: number) => PhysicsShape;
	readonly mesh: (vertices: number[], indices: number[]) => PhysicsShape;
	readonly heightField: (heights: number[], sampleCount: number, scale: Vector3, offset?: number) => PhysicsShape;
};
/**
 * Material combine modes for how two materials interact
 */
export declare const CombineMode: {
	readonly Average: 0;
	readonly Min: 1;
	readonly Multiply: 2;
	readonly Max: 3;
};
export type CombineMode = (typeof CombineMode)[keyof typeof CombineMode];
/**
 * Physics material component that defines surface properties
 */
export type PhysicsMaterial = {
	readonly restitution: number;
	readonly friction: number;
	readonly density: number;
	readonly restitutionCombineMode?: CombineMode;
	readonly frictionCombineMode?: CombineMode;
	readonly linearDamping?: number;
	readonly angularDamping?: number;
	readonly userData?: unknown;
};
export declare const PhysicsMaterial: ComponentType<PhysicsMaterial>;
/**
 * Helper function to create a physics material with sensible defaults
 */
export declare function createPhysicsMaterial(config: {
	restitution?: number;
	friction?: number;
	density?: number;
	restitutionCombineMode?: CombineMode;
	frictionCombineMode?: CombineMode;
	linearDamping?: number;
	angularDamping?: number;
	userData?: unknown;
}): PhysicsMaterial;
/**
 * Predefined common materials for convenience
 */
export declare const CommonMaterials: {
	/**
	 * Default material with balanced properties
	 */
	readonly default: () => PhysicsMaterial;
	/**
	 * Bouncy ball material
	 */
	readonly rubber: () => PhysicsMaterial;
	/**
	 * Metal material - heavy, low bounce, medium friction
	 */
	readonly metal: () => PhysicsMaterial;
	/**
	 * Wood material - medium properties
	 */
	readonly wood: () => PhysicsMaterial;
	/**
	 * Ice material - slippery, medium bounce
	 */
	readonly ice: () => PhysicsMaterial;
	/**
	 * Stone/concrete material - heavy, no bounce, high friction
	 */
	readonly stone: () => PhysicsMaterial;
	/**
	 * Foam material - light, high bounce, high friction
	 */
	readonly foam: () => PhysicsMaterial;
	/**
	 * Glass material - medium-heavy, low bounce, medium friction
	 */
	readonly glass: () => PhysicsMaterial;
};
export interface SystemCtx {
	/** Physics helpers, set by the physics system's init. Added by `fenrir-ts/physics`. */
	physics?: PhysicsHelpers;
}
/**
 * Physics helper class for manipulating physics bodies
 *
 * This class is instantiated by PhysicsSystem and provided via SystemCtx
 */
export declare class PhysicsHelpers {
	private readonly jolt;
	private readonly bodyInterface;
	constructor(jolt: JoltModule, bodyInterface: JoltBodyInterface);
	/**
	 * Apply an impulse to a physics body (instantaneous velocity change)
	 * Automatically wakes up sleeping bodies
	 */
	applyImpulse(physicsBody: PhysicsBody, impulse: Vector3): void;
	/**
	 * Add force to a physics body (continuous acceleration)
	 * Automatically wakes up sleeping bodies
	 */
	addForce(physicsBody: PhysicsBody, force: Vector3): void;
	/**
	 * Add torque to a physics body (rotational force)
	 * Automatically wakes up sleeping bodies
	 */
	addTorque(physicsBody: PhysicsBody, torque: Vector3): void;
	/**
	 * Apply an angular impulse to a physics body
	 * Automatically wakes up sleeping bodies
	 */
	applyAngularImpulse(physicsBody: PhysicsBody, impulse: Vector3): void;
	/**
	 * Get the current linear velocity of a physics body
	 */
	getVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3;
	/**
	 * Set the linear velocity of a physics body
	 * Automatically wakes up sleeping bodies
	 */
	setVelocity(physicsBody: PhysicsBody, velocity: Vector3): void;
	/**
	 * Get the current angular velocity of a physics body
	 */
	getAngularVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3;
	/**
	 * Set the angular velocity of a physics body
	 * Automatically wakes up sleeping bodies
	 */
	setAngularVelocity(physicsBody: PhysicsBody, velocity: Vector3): void;
	/**
	 * Check if the physics body is active (not sleeping)
	 */
	isActive(physicsBody: PhysicsBody): boolean;
	/**
	 * Activate (wake up) a physics body
	 * Useful to force a body awake before applying physics operations
	 */
	activate(physicsBody: PhysicsBody): void;
	/**
	 * Get the mass of a physics body
	 */
	getMass(physicsBody: PhysicsBody): number;
	/**
	 * Set friction for a physics body
	 */
	setFriction(physicsBody: PhysicsBody, friction: number): void;
	/**
	 * Set restitution (bounciness) for a physics body
	 */
	setRestitution(physicsBody: PhysicsBody, restitution: number): void;
}
/**
 * Simplified PhysicsWorld interface for the new system
 */
export interface SimplePhysicsWorld {
	readonly jolt: JoltModule;
	readonly joltInterface: JoltInterface;
	readonly physicsSystem: JoltPhysicsSystem;
	readonly bodyInterface: JoltBodyInterface;
	readonly config: {
		gravity: Vector3;
	};
	readonly utils: {
		vec3ToJolt: (jolt: JoltModule, vec: Vector3) => JoltVec3;
		vec3ToJoltR: (jolt: JoltModule, vec: Vector3) => JoltRVec3;
		quatToJolt: (jolt: JoltModule, quat: Quaternion) => JoltQuat;
		joltVec3ToThree: (joltVec: JoltVec3, out: Vector3) => Vector3;
		joltRVec3ToThree: (joltVec: JoltRVec3, out: Vector3) => Vector3;
		joltQuatToThree: (joltQuat: JoltQuat, out: Quaternion) => Quaternion;
	};
	readonly isInitialized: boolean;
}
/**
 * Factory function that creates a physics system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export declare function createPhysicsSystem(): {
	readonly init: AsyncSystemFn;
	readonly tick: SyncSystemFn;
	readonly exit: AsyncSystemFn;
	/**
	 * Get physics helpers instance
	 * Available after init() has been called
	 */
	readonly getPhysics: () => PhysicsHelpers | null;
};
/**
 * Helper functions for creating physics body configurations
 */
export declare const PhysicsBodyPresets: {
	/**
	 * Create a static box (like demo's createFloor)
	 */
	readonly createFloor: (_size?: number) => {
		motionType: 0;
	};
	/**
	 * Create a dynamic box (like demo's createBox)
	 */
	readonly createDynamicBox: (mass?: number) => {
		motionType: 2;
		mass: number;
	};
	/**
	 * Create a dynamic sphere (like demo's createSphere)
	 */
	readonly createDynamicSphere: (mass?: number) => {
		motionType: 2;
		mass: number;
	};
};
export interface EntityBuilder {
	/**
	 * Adds a physics body with the specified motion type and collision layers
	 */
	physicsBody(config: {
		motionType: MotionType;
		collisionLayer?: CollisionLayer;
		collisionMask?: CollisionMask;
		syncMode?: SyncMode;
		mass?: number;
		gravityFactor?: number;
		allowSleeping?: boolean;
		isSensor?: boolean;
	}): EntityBuilder;
	/**
	 * Set collision layer for physics body (Godot-style)
	 */
	collisionLayer(layer: CollisionLayer): EntityBuilder;
	/**
	 * Set collision mask for physics body (Godot-style)
	 */
	collisionMask(mask: CollisionMask): EntityBuilder;
	/**
	 * Set which layers this body can collide with (convenience method)
	 */
	collidesWith(...layers: CollisionLayer[]): EntityBuilder;
	/**
	 * Adds a box physics shape
	 */
	physicsBox(halfExtents: Vector3, convexRadius?: number): EntityBuilder;
	/**
	 * Adds a sphere physics shape
	 */
	physicsSphere(radius: number): EntityBuilder;
	/**
	 * Adds a capsule physics shape
	 */
	physicsCapsule(halfHeight: number, radius: number): EntityBuilder;
	/**
	 * Adds a cylinder physics shape
	 */
	physicsCylinder(halfHeight: number, radius: number, convexRadius?: number): EntityBuilder;
	/**
	 * Adds a physics material
	 */
	physicsMaterial(preset?: keyof typeof CommonMaterials): EntityBuilder;
	/**
	 * Creates a dynamic physics body with box shape (common pattern)
	 */
	dynamicBox(halfExtents: Vector3, mass?: number): EntityBuilder;
	/**
	 * Creates a dynamic physics body with sphere shape (common pattern)
	 */
	dynamicSphere(radius: number, mass?: number): EntityBuilder;
	/**
	 * Creates a static physics body with box shape (common pattern)
	 */
	staticBox(halfExtents: Vector3): EntityBuilder;
	/**
	 * Creates a static physics body with sphere shape (common pattern)
	 */
	staticSphere(radius: number): EntityBuilder;
	/**
	 * Creates a kinematic physics body with box shape (common pattern)
	 */
	kinematicBox(halfExtents: Vector3): EntityBuilder;
}

export {
	Animation$1 as Animation,
	InputEvent$1 as InputEvent,
	Plugin$1 as Plugin,
};

export {};

import * as THREE from 'three';
import { Color, CubeTexture, OrthographicCamera, PerspectiveCamera, Quaternion, Texture, Vector3 } from 'three';
import type { Texture as PixiTexture } from 'pixi.js';
import * as THREE_WEBGPU from 'three/webgpu';

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
	/**
	 * Alias fror set<T>
	 */
	add<T>(entity: Entity, type: ComponentType<T>, component: T): boolean;
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
export declare class EventQueue<T> {
	private current;
	private previous;
	private combined;
	private combinedDirty;
	send(ev: T): void;
	/** called once per frame, after all stages */
	update(): void;
	/** returns stable array until next send/update */
	read(): readonly T[];
	clearAll(): void;
}
export declare class EventBus {
	private queues;
	private getQueue;
	send<T>(type: EventType<T>, ev: T): void;
	read<T>(type: EventType<T>): readonly T[];
	update(): void;
	clear(): void;
}
export type LogMeta = Record<string, unknown>;
export interface ILogger {
	trace(message: string, meta?: LogMeta): void;
	debug(message: string, meta?: LogMeta): void;
	info(message: string, meta?: LogMeta): void;
	warn(message: string, meta?: LogMeta): void;
	error(message: string, meta?: LogMeta): void;
}
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
export type LoadedModel = {
	geometry: THREE.Object3D;
	animations: THREE.AnimationClip[];
	materials: THREE.Material[];
};
export type LoadedAsset = LoadedModel | THREE.Texture | PixiTexture;
export interface ModelLoaderConfig {
	loader: AssetLoader<LoadedModel>;
	extensions: string[];
}
export interface TextureLoaderConfig {
	loader: AssetLoader<THREE.Texture>;
	extensions: string[];
}
export interface PixiTextureLoaderConfig {
	loader: AssetLoader<PixiTexture>;
	extensions: string[];
}
export interface IAssetStore {
	loadModel(key: AssetKey, url: string): Promise<void>;
	loadTexture(key: AssetKey, url: string): Promise<void>;
	loadTexture2D(key: AssetKey, url: string): Promise<void>;
	getGeometry(key: AssetKey): Promise<THREE.Object3D>;
	getAnimations(key: AssetKey): Promise<THREE.AnimationClip[]>;
	getMaterials(key: AssetKey): Promise<THREE.Material[]>;
	getTexture(key: AssetKey): Promise<THREE.Texture>;
	getTexture2D(key: AssetKey): Promise<PixiTexture>;
	get(key: AssetKey): Promise<LoadedAsset>;
	registerModelLoader(name: string, config: ModelLoaderConfig): void;
	registerTextureLoader(name: string, config: TextureLoaderConfig): void;
	registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
	getSupportedModelExtensions(): string[];
	getSupportedTextureExtensions(): string[];
	getSupportedTexture2DExtensions(): string[];
	clear(): void;
}
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
 * Scene-level skybox descriptor.
 * This is stored directly on Scene objects, not as ECS components.
 */
export type SkyboxDescriptor = {
	readonly type: SkyboxType;
	readonly textures: SkyboxTextures;
	readonly enabled?: boolean;
};
/**
 * Runtime skybox instance managed by the skybox system.
 * Uses Three.js scene.background for proper skybox rendering.
 * This is the recommended approach per Three.js documentation.
 */
export type SkyboxInstance = {
	readonly background: Texture | CubeTexture | Color;
};
export declare class Scene {
	name: string;
	readonly entityList: EntityList;
	skybox?: SkyboxDescriptor;
	constructor(name: string);
	/**
	 * Set the skybox for this scene
	 */
	setSkybox(skybox: SkyboxDescriptor | undefined): void;
	/**
	 * Remove the skybox from this scene
	 */
	removeSkybox(): void;
	/**
	 * Check if this scene has a skybox
	 */
	hasSkybox(): boolean;
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
export declare class Time {
	deltaTime: number;
	tickRate: number;
	accumulator: number;
	private startTime;
	private prevTime;
	private paused;
	private pauseStartTime;
	private totalPausedTime;
	constructor();
	update(): void;
	pause(): void;
	resume(): void;
	reset(): void;
	get delta(): number;
	get elapsed(): number;
}
export type SystemCtx = {
	time: Time;
	events: EventBus;
	logger: ILogger;
	scenes: SceneManager;
	readonly scene: Scene;
	readonly entities: EntityList;
	stop(): void;
};
export type SyncSystemFn = (ctx: SystemCtx) => void;
export type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
export type SystemFn = SyncSystemFn;
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
export declare class Scheduler {
	private readonly stages;
	addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn): this;
	addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn): this;
	addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	getSystems(stage: ScheduleStage): SyncSystemFn[] | AsyncSystemFn[];
	replaceSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	replaceSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	clearSystems(stage: ScheduleStage): this;
	runSyncStage<S extends SyncStage>(stage: S, ctx: SystemCtx): void;
	runAsyncStage<S extends AsyncStage>(stage: S, ctx: SystemCtx): Promise<void>;
}
export type EngineOptions = {
	scheduler: Scheduler;
	sceneManager: SceneManager;
	events: EventBus;
	logger?: ILogger | null;
};
export declare class Engine {
	private readonly time;
	private readonly scheduler;
	private readonly events;
	private readonly sceneManager;
	private readonly logger;
	private running;
	private rafId;
	constructor(opts: EngineOptions);
	private createSystemCtx;
	run(): Promise<void>;
	stop(): Promise<void>;
	pause(): void;
	resume(): void;
	reset(): Promise<void>;
	getTime(): Time;
	isRunning(): boolean;
	addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn): this;
	addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn): this;
	addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	replaceSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
	replaceSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
	getScheduler(): Scheduler;
}
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
declare function createInputStateSystem(): {
	state: InputState;
	preUpdate: SystemFn;
};
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
declare const Renderable: ComponentType<Renderable>;
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
 * Runtime component managed by the camera system.
 * Contains the actual Three.js camera instance.
 */
export type CameraInstance = {
	readonly threeCamera: PerspectiveCamera | OrthographicCamera;
	readonly lastUpdateFrame: number;
};
declare const CameraInstance: ComponentType<CameraInstance>;
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
declare class ThreeRenderer {
	readonly scene: THREE.Scene<THREE.Object3DEventMap>;
	readonly renderer: THREE.WebGLRenderer | THREE_WEBGPU.WebGPURenderer;
	readonly camera: THREE.PerspectiveCamera;
	readonly rendererType: RendererType;
	private readonly objects;
	private readonly geomCache;
	private readonly matCache;
	private readonly assets;
	private currentSkybox;
	private isInitialized;
	constructor(opts: ThreeRendererOptions);
	/**
	 * Initialize the renderer (required for WebGPU, no-op for WebGL)
	 */
	init(): Promise<void>;
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
declare function createCameraSystem(options?: CameraSystemOptions): {
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
declare function createSkyboxSystem(options: SkyboxSystemOptions): {
	readonly init: AsyncSystemFn;
	readonly preUpdate: AsyncSystemFn;
	readonly exit: AsyncSystemFn;
	readonly getSkyboxInstance: (scene: Scene) => SkyboxInstance | null;
};
export type CameraSystemInstance = ReturnType<typeof createCameraSystem>;
export type SkyboxSystemInstance = ReturnType<typeof createSkyboxSystem>;
declare function createThreeRendererSystem(opts: {
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
declare function createAnimationSystem(opts: {
	assets: IAssetStore;
	logger: ILogger;
	renderer: ThreeRenderer;
}): {
	readonly init: SyncSystemFn;
	readonly preUpdate: SyncSystemFn;
	readonly exit: SyncSystemFn;
};
declare function createPhysicsSystem(): {
	readonly init: AsyncSystemFn;
	readonly tick: SyncSystemFn;
	readonly exit: AsyncSystemFn;
};
declare function createStatsSystem(parent: HTMLElement): {
	readonly postUpdate: SyncSystemFn;
};
export type BootstrapConfig = {
	canvas: HTMLCanvasElement;
	enablePhysics?: boolean;
	enableAnimations?: boolean;
	enableStats?: boolean;
	statsParent?: HTMLElement;
	rendererType?: "webgl" | "webgpu";
	clearColor?: number;
};
export type BootstrapResult = {
	assets: IAssetStore;
	systems: {
		input: ReturnType<typeof createInputStateSystem>;
		renderer: ReturnType<typeof createThreeRendererSystem>;
		camera: ReturnType<typeof createCameraSystem>;
		skybox: ReturnType<typeof createSkyboxSystem>;
		animations?: ReturnType<typeof createAnimationSystem>;
		physics?: ReturnType<typeof createPhysicsSystem>;
		stats?: ReturnType<typeof createStatsSystem>;
	};
};
/**
 * Bootstrap core engine systems with sensible defaults
 *
 * This creates and configures the essential systems needed for most games:
 * - Input handling
 * - Rendering (WebGL/WebGPU)
 * - Camera management
 * - Skybox rendering
 * - Optional: Physics, Animations, Performance stats
 */
export declare function bootstrapEngine(engine: Engine, logger: ILogger, config: BootstrapConfig): BootstrapResult;
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
export type Transform = {
	position: Vector3;
	rotation: Quaternion;
	scale: Vector3;
};
export declare const Transform: ComponentType<Transform>;
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
	transform(pos?: Vector3, rot?: Quaternion, scale?: Vector3): EntityBuilder;
	name(value: string): EntityBuilder;
}
export type ModelRenderableOpts = {
	id?: number;
	flags?: RenderFlags;
};
export type PrimitiveRenderableOpts = {
	id?: number;
	material?: MaterialDesc;
	flags?: RenderFlags;
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
/**
 * 32-bit collision layer system similar to Godot
 * Each layer is represented as a single bit (1, 2, 4, 8, etc.)
 * Collision masks are bitwise combinations of layers
 */
export type CollisionLayer = number;
export type CollisionMask = number;
declare const MotionType: {
	readonly Static: 0;
	readonly Kinematic: 1;
	readonly Dynamic: 2;
};
export type MotionType = (typeof MotionType)[keyof typeof MotionType];
declare const SyncMode: {
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
	readonly bodyId?: number;
	readonly motionType: MotionType;
	readonly collisionLayer: CollisionLayer;
	readonly collisionMask: CollisionMask;
	readonly syncMode: SyncMode;
	readonly mass?: number;
	readonly gravityFactor?: number;
	readonly allowSleeping?: boolean;
	readonly isSensor?: boolean;
};
export declare const PhysicsBody: ComponentType<PhysicsBody>;
declare const ShapeType: {
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
declare const CombineMode: {
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
declare const CommonMaterials: {
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
	 * Set up the default skybox using the existing textures in public/textures/skybox/
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

export {
	InputEvent$1 as InputEvent,
};

export {};

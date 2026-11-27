# `fenrir-ts` API reference

Generated from the TSDoc in the source by `scripts/api-reference.mjs`. Do not edit: run `pnpm api:reference`.

The core: games, systems, ECS, events, resources, states, time, input, timers and tweens, asset manifests, storage, test games and inspection.

Peer packages: none. Import from `fenrir-ts` only, never from `dist/` or a source path.

## Contents

- Functions: [`addTimer`](#addtimer), [`addTween`](#addtween), [`cancelTimer`](#canceltimer), [`cancelTween`](#canceltween), [`createGame`](#creategame), [`createTestGame`](#createtestgame), [`defineAction`](#defineaction), [`defineAssets`](#defineassets), [`defineComponent`](#definecomponent), [`defineEasing`](#defineeasing), [`defineEvent`](#defineevent), [`defineResource`](#defineresource), [`defineState`](#definestate), [`defineStorageKey`](#definestoragekey), [`defineStorageKeyFamily`](#definestoragekeyfamily), [`exposeInspector`](#exposeinspector), [`getAsset`](#getasset), [`getStored`](#getstored), [`inspect`](#inspect), [`inState`](#instate), [`loadAsset`](#loadasset), [`loadAssets`](#loadassets), [`memoryStorage`](#memorystorage), [`motion`](#motion), [`persistResource`](#persistresource), [`removeStored`](#removestored), [`setAssetLoader`](#setassetloader), [`setStored`](#setstored), [`storage`](#storage), [`unloadAsset`](#unloadasset), [`unloadAssets`](#unloadassets), [`updateStored`](#updatestored)
- Classes: [`AssetBundleError`](#assetbundleerror), [`AssetLoadError`](#assetloaderror), [`AssetStore`](#assetstore), [`ConsoleLogger`](#consolelogger), [`Engine`](#engine), [`EntityBuilder`](#entitybuilder), [`EntityList`](#entitylist), [`EventBus`](#eventbus), [`EventQueue`](#eventqueue), [`NullLogger`](#nulllogger), [`Pool`](#pool), [`Random`](#random), [`Resources`](#resources), [`Scene`](#scene), [`SceneManager`](#scenemanager), [`Scheduler`](#scheduler), [`Time`](#time), [`View`](#view)
- Constants: [`AssetBundleFailed`](#assetbundlefailed), [`AssetBundleLoaded`](#assetbundleloaded), [`AssetFailed`](#assetfailed), [`assetKey`](#assetkey), [`AssetLoaded`](#assetloaded), [`Display2D`](#display2d), [`easings`](#easings), [`MotionSettings`](#motionsettings), [`Name`](#name), [`Relationship`](#relationship), [`Schedule`](#schedule), [`StorageStatus`](#storagestatus), [`TimerFired`](#timerfired), [`Timers`](#timers), [`Transform`](#transform), [`Transform2D`](#transform2d), [`TweenDone`](#tweendone), [`Tweens`](#tweens)
- Types: [`ActionType`](#actiontype), [`Asset`](#asset), [`AssetCounts`](#assetcounts), [`AssetCtx`](#assetctx), [`AssetDeclaration`](#assetdeclaration), [`AssetDeclarations`](#assetdeclarations), [`AssetFailure`](#assetfailure), [`AssetKey`](#assetkey), [`AssetKind`](#assetkind), [`AssetKinds`](#assetkinds), [`AssetLoader`](#assetloader), [`AssetManifest`](#assetmanifest), [`AssetName`](#assetname), [`AssetProgress`](#assetprogress), [`AssetSource`](#assetsource), [`AssetState`](#assetstate), [`AssetStatus`](#assetstatus), [`AssetStoreConfig`](#assetstoreconfig), [`AsyncStage`](#asyncstage), [`AsyncSystemFn`](#asyncsystemfn), [`BundleName`](#bundlename), [`BundleProgress`](#bundleprogress), [`BundleStatus`](#bundlestatus), [`Clock`](#clock), [`ComponentType`](#componenttype), [`DebugGlobal`](#debugglobal), [`Easing`](#easing), [`EasingName`](#easingname), [`EngineOptions`](#engineoptions), [`Entity`](#entity), [`EntitySnapshot`](#entitysnapshot), [`EventHandler`](#eventhandler), [`EventReader`](#eventreader), [`EventType`](#eventtype), [`Game`](#game), [`GameBase`](#gamebase), [`GameOptions`](#gameoptions), [`GameServices`](#gameservices), [`GameSnapshot`](#gamesnapshot), [`IAssetStore`](#iassetstore), [`ILogger`](#ilogger), [`Input`](#input), [`InputBinding`](#inputbinding), [`InputDomEvent`](#inputdomevent), [`InputDownHandler`](#inputdownhandler), [`InputEdge`](#inputedge), [`InputGestureHandler`](#inputgesturehandler), [`InputPointer`](#inputpointer), [`JsonValue`](#jsonvalue), [`KeyCode`](#keycode), [`LoaderConfig`](#loaderconfig), [`ManifestAsset`](#manifestasset), [`ManifestLoader`](#manifestloader), [`MotionCtx`](#motionctx), [`NumericKeys`](#numerickeys), [`Plugin`](#plugin), [`PointerBinding`](#pointerbinding), [`QuatLike`](#quatlike), [`ResourceType`](#resourcetype), [`ScheduledSystem`](#scheduledsystem), [`ScheduleStage`](#schedulestage), [`SkyboxDescriptor`](#skyboxdescriptor), [`States`](#states), [`StateType`](#statetype), [`StorageBackend`](#storagebackend), [`StorageCtx`](#storagectx), [`StorageKey`](#storagekey), [`StorageKeyFamily`](#storagekeyfamily), [`StorageKeyOptions`](#storagekeyoptions), [`StorageOptions`](#storageoptions), [`SyncStage`](#syncstage), [`SyncSystemFn`](#syncsystemfn), [`SystemCtx`](#systemctx), [`SystemOptions`](#systemoptions), [`TestClock`](#testclock), [`TestGame`](#testgame), [`TestGameOptions`](#testgameoptions), [`TestInput`](#testinput), [`Timer`](#timer), [`TimerOptions`](#timeroptions), [`Tween`](#tween), [`TweenOptions`](#tweenoptions), [`Vec3Like`](#vec3like)

## Functions

### addTimer

```ts
function addTimer(ctx: MotionCtx, entity: Entity, name: string, options: TimerOptions): Timer;
```

Starts a timer called `name` on `entity`, replacing a timer of that name. It fires
`TimerFired` after `duration` seconds of game time, then `repeat` more times, each a
`duration` later, and is then removed. Cancel it with `cancelTimer`, by removing `Timers`, or
by destroying the entity. Needs the `motion()` plugin.

For how long a state has had its value, read `states.timeIn` instead: a timer is for
something that must happen once, or again and again, at a time.

```ts
addTimer(ctx, entity, "myGame.toResults", { duration: 1.5, state: [Phase, "over"] });
```

### addTween

```ts
function addTween<T>(ctx: MotionCtx, entity: Entity, component: ComponentType<T>, options: TweenOptions<T>): string;
```

Tweens numeric fields of `component` on `entity` to `to` over `duration` seconds of game time.
The entity must have the component. A tween with the same name is replaced, and fields this
tween drives are taken from any other tween of that component on the entity, so the newest
tween of a field wins. Returns the tween's name. Needs the `motion()` plugin.

```ts
addTween(ctx, fish, Transform2D, { to: { x: 300, rotation: Math.PI }, duration: 0.6, ease: "quadOut" });
addTween(ctx, fish, Display2D, { from: { alpha: 0 }, to: { alpha: 1 }, duration: 0.3 });
```

### cancelTimer

```ts
function cancelTimer(ctx: MotionCtx, entity: Entity, name: string): boolean;
```

Removes the timer called `name` from `entity`, unfired. Returns whether there was one.

### cancelTween

```ts
function cancelTween(ctx: MotionCtx, entity: Entity, name: string): boolean;
```

Removes the tween called `name` from `entity`, leaving its fields where they are. Returns whether there was one.

### createGame

```ts
function createGame(options: GameOptions): Promise<Game>;
```

Builds a game: scheduler, scene manager, event bus, logger and asset store, then installs
each plugin in order, awaiting async installs. Rejects with the plugin's error if an install
throws; nothing has run yet, so there is nothing to roll back.

```ts
const game = await createGame({ canvas, plugins: [pixi2d()] });
game.addSystem(Schedule.Update, movePlayer);
await game.run();
```

### createTestGame

```ts
function createTestGame(options: TestGameOptions): Promise<TestGame>;
```

Builds a game for tests and tools: the same scheduler, services, states, events and plugins
as `createGame`, with no canvas and no `requestAnimationFrame`. Nothing reads
`performance.now()` or `Date.now()`: time moves only with `step` and `clock.advance`.

```ts
const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
game.addSystem(Schedule.Update, movePlayer);
await game.start();
game.step(1 / 60, 60); // one second
await game.stop();
```

### defineAction

```ts
function defineAction(name: string, bindings: readonly InputBinding[]): ActionType;
```

Defines an action: something the player does, bound to keys and pointer buttons. Read it with
`ctx.input.pressed(Action)`, `released` and `held`. The action is held while any of its
bindings is down.

Keys are `KeyboardEvent.code` values, which name the physical key: `"KeyA"`, `"Space"`,
`"ArrowLeft"`, `"Enter"`. Pointers are `"pointer.primary"` (mouse left button, a finger or a
pen) and `"pointer.secondary"` (mouse right button). Prefix names with a namespace for your
game or library; names starting with `fenrir.` are reserved for the engine.

```ts
export const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
```

### defineAssets

```ts
function defineAssets<const A extends AssetDeclarations, const B extends {
    readonly [bundle: string]: readonly (keyof A & string)[];
}>(name: string, manifest: {
    readonly assets: A & {
        readonly [N in keyof A]: {
            readonly fallback?: keyof A & string;
        };
    };
    readonly bundles: B;
}): AssetManifest<A, keyof B & string>;
```

Declares a game's assets once, by name, and groups them into bundles: `boot`, and one per level
or location. Plain data: `manifest.assets` and `manifest.bundles` are what was passed, so a
tool or a test can read them. An asset in two bundles is loaded once and kept until the last
bundle holding it is unloaded.

An asset's name is its key in `game.assets`, so `getTexture2D(name)` and `renderSprite(name)`
read it too. Two manifests that use one name must declare the same kind and source.

Mark an asset `optional: true` when a failure is cosmetic: it is then `missing` (a warning, not
an error), its bundle still loads, and `getAsset` returns `undefined` for it. To load assets one
at a time rather than in bundles, use `loadAsset` and `unloadAsset`.

Throws if a bundle lists an unknown asset, a fallback is unknown, of another kind or has its
own fallback, or two assets of one kind share a source.

```ts
const GameAssets = defineAssets("myGame.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
    glow: { kind: "texture2d", src: "img/glow.png", optional: true },
  },
  bundles: { boot: ["logo"], reef: ["reef", "logo"] },
});
```

### defineComponent

```ts
function defineComponent<T>(name: string): ComponentType<T>;
```

Defines a component type. The name is the component's identity: two calls
with the same name return the same type and share storage. That keeps a
component stable across hot module reloads and across two copies of the
engine in one bundle.

Because identity is global, prefix names with a namespace for your game or
library. Names starting with `fenrir.` are reserved for the engine.

```ts
export type Health = { current: number; max: number };
export const Health = defineComponent<Health>("myGame.Health");
```

### defineEasing

```ts
function defineEasing(name: string, easing: Easing): void;
```

Adds an easing that tweens can name in `ease`, so tween data stays plain JSON. Prefix the
name with your game's namespace (`myGame.bounce`); the built-in names cannot be redefined.
Defining the same name again replaces the function.

```ts
defineEasing("myGame.steps", (t) => Math.floor(t * 4) / 4);
addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 1, ease: "myGame.steps" });
```

### defineEvent

```ts
function defineEvent<T>(name: string): EventType<T>;
```

Defines an event type. As with components, the name is the identity: two
calls with the same name return the same type. Prefix names with a namespace
for your game or library. Names starting with `fenrir.` are reserved for the engine.

```ts
export const PlayerDied = defineEvent<{ entity: Entity }>("myGame.playerDied");
```

### defineResource

```ts
function defineResource<T>(name: string, factory?: () => T): ResourceType<T>;
```

Defines a resource: a single value of type `T` that one game owns. Read it with
`ctx.resources.get(Resource)` and replace it with `ctx.resources.set(Resource, value)`.

`factory` runs once per game, on the first `get`, and again after the engine resets.
Without a factory, `get` throws until a value is set.

As with components, the name is the identity: two calls with the same name share one value
in each game. Prefix names with a namespace for your game or library. Names starting with
`fenrir.` are reserved for the engine.

```ts
export const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
export const Seed = defineResource<number>("myGame.seed"); // set before use
```

### defineState

```ts
function defineState<V extends string>(name: string, options: {
    readonly values: readonly V[];
    readonly initial: NoInfer<V>;
}): StateType<V>;
```

Defines a state machine. As with components and events, the name is the identity: every game
keeps one current value per name. Prefix names with a namespace for your game or library.
Names starting with `fenrir.` are reserved for the engine.

```ts
export const Phase = defineState("myGame.Phase", { values: ["idle", "casting"], initial: "idle" });
```

### defineStorageKey

```ts
function defineStorageKey<T>(name: string, options: StorageKeyOptions<T>): StorageKey<T>;
```

Defines a stored value: its key, its default and how to check what is read back. As with
components, the name is the identity and is namespaced: `myGame.muted`. Values are stored as
JSON with their version: `{"v":1,"value":true}`.

```ts
const Muted = defineStorageKey("myGame.muted", { default: false });
const Best = defineStorageKey("myGame.best", {
  default: { score: 0, level: 1 },
  version: 2,
  parse: (v) => (isRecord(v) && typeof v.score === "number" && typeof v.level === "number" ? { score: v.score, level: v.level } : undefined),
  migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v, level: 1 } : v), // v1 stored a bare number
});
```

### defineStorageKeyFamily

```ts
function defineStorageKeyFamily<T>(prefix: string, options: StorageKeyOptions<T>): StorageKeyFamily<T>;
```

Defines keys that share a default, parser, version and migration and differ by a suffix: one
per player, save slot or level. `family(suffix)` is the key named `prefix + suffix`, made on
first use and the same object every time after, so it can be called in a system each frame.
The prefix is used as given: end it with the separator, such as `myGame.best.`.

Throws, as `defineStorageKey` does, for invalid options, and for a suffix that is not a
non-empty string.

```ts
const BestTime = defineStorageKeyFamily("myGame.best.", { default: 0 });
setStored(ctx, BestTime(levelId), 42.5); // stored as "myGame.best.<levelId>"
getStored(ctx, BestTime(levelId));
```

### exposeInspector

```ts
function exposeInspector(game: GameBase): void;
```

Puts `inspect(game)` on `window.__FENRIR__.inspect` for browser tests and agents. The last
game exposed owns it, with a warning when it replaces another; it stays after the game stops.
Does nothing where there is no `window`. Call it only in builds that need it, such as a debug
or browser-tested build: a game that never calls it ships no inspection code.

### getAsset

```ts
function getAsset<A extends AssetDeclarations, N extends keyof A & string>(ctx: AssetCtx, manifest: AssetManifest<A, string>, name: N): ManifestAsset<A, N>;
```

The loaded asset `name` of `manifest`, typed by its kind: a Pixi `Texture` for `texture2d`.
`ctx` is a `SystemCtx`, the game, or anything with its `assets`, `resources`, `events` and
`logger` (`AssetCtx`).
Its fallback's value if it failed and has one. `undefined` for an `optional` asset that is
`missing` (its type includes `undefined` only for assets declared `optional: true`).
Throws if it is not loaded yet, or failed; read `manifest.progress`, or wait for
`AssetBundleLoaded` or `AssetLoaded`, to know when it has loaded.

### getStored

```ts
function getStored<T>(ctx: StorageCtx, key: StorageKey<T>): T;
```

The stored value of `key`: what was set this session, else what the backend holds if it is
valid, else the default. Never throws. A value that cannot be read, is not JSON, is from a
newer version or does not parse gives the default, logged once per key. Cached after the first
read, so reading every frame is cheap. Mutating a returned object changes the cached value
only: call `setStored` to save it.

### inspect

```ts
function inspect(game: GameBase): GameSnapshot;
```

What `game` is doing, as plain JSON: frame, time, schedule, states, resources and the active
scene's entities. Works on a `Game` and a `TestGame`, before the game runs, while paused and
after `stop()`; never throws. A function rather than a method, so a game that never calls it
ships none of the snapshot and JSON-encoding code. The serialisation rules are in skills/fenrir/references/testing.md
under "Inspecting a game".

```ts
const { entities, resources } = inspect(game);
```

### inState

```ts
function inState<V extends string>(state: StateType<V>, ...values: [
    NoInfer<V>,
    ...NoInfer<V>[]
]): (ctx: SystemCtx) => boolean;
```

A `runIf` condition: true while `state` has one of `values`.

```ts
game.addSystem(Schedule.Update, meter, { runIf: inState(Phase, "casting") });
```

### loadAsset

```ts
function loadAsset<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, names: NoInfer<keyof A & string> | readonly NoInfer<keyof A & string>[]): Promise<void>;
```

Loads assets of `manifest` by name, with no bundle: for a game that loads images one at a time
as they come into view. Each name is held like a one-asset bundle (with its fallback) until
`unloadAsset`, sharing the load with any bundle that lists it, and shows in `manifest.progress`
as `assets[name].direct` and in the top-level counts, not in `progress.bundles`.

Safe to call again: a loading or loaded asset returns the same promise, and a failed one is
retried. When an asset settles it sends `AssetLoaded` (status `loaded`, `fallback` or
`missing`) and the promise resolves; one that fails with no fallback and is not `optional` is
logged, sends `AssetFailed` and rejects with an `AssetLoadError`. With several names, the
promise resolves when all have and rejects with the first failure; every name is tried.
`setAssetLoader` replaces its loader as it does for bundles.

```ts
void loadAsset(ctx, Art, "portrait"); // from a sync system; read progress.assets.portrait.status
```

### loadAssets

```ts
function loadAssets<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, bundles: NoInfer<B> | readonly NoInfer<B>[]): Promise<void>;
```

Loads one or more bundles of `manifest` into the game's asset store, with progress in
`manifest.progress`. Call it from a system (without awaiting in a sync stage) or from setup
code. Safe to call again: a loading or loaded bundle returns the same promise, and an asset
shared with another bundle is loaded once. Calling it on a failed bundle retries the assets
that failed.

Every asset of a bundle is tried. An asset that fails shows its fallback if it declares one;
one that fails without a fallback fails the bundle, which is logged, sends `AssetBundleFailed`
and rejects with an `AssetBundleError` naming each asset and source. The assets that loaded
stay loaded. A bundle with no failure sends `AssetBundleLoaded` and resolves.

To hold `run()` until a bundle is ready, await it in a `PreInit` system: a failure then rolls
startup back and `run()` rejects with it.

### memoryStorage

```ts
function memoryStorage(items?: Record<string, string>): StorageBackend & {
    readonly items: Map<string, string>;
};
```

A backend that keeps values in a `Map`: the fallback when `localStorage` is unavailable, and
the backend for tests. `items` is the map, so a test can seed it or assert on what was written.

```ts
const store = memoryStorage({ "myGame.muted": '{"v":1,"value":true}' });
const game = await createTestGame({ seed: 1, plugins: [storage({ backend: store })] });
```

### motion

```ts
function motion(): Plugin;
```

Runs timers and tweens: `addTimer` and `addTween` need it. It adds the `MotionSettings`
resource and one system, `fenrir.motion.preUpdate`, which advances every timer and tween of
the active scene by `time.delta`. Plugins install before the game adds its systems, so it runs
before the game's `PreUpdate` systems, and the game's `Update` systems and the renderer see
this frame's values. A game without it ships none of this code.

A game system that pauses motion (`MotionSettings.pausedAll` or a group) and must stop this
frame's advance too runs before it: `{ before: "fenrir.motion.preUpdate" }` in `PreUpdate`.

```ts
const game = await createGame({ canvas, plugins: [motion(), pixi2d()] });
game.addSystem(Schedule.PreUpdate, function pauseMenu({ input, resources }) {
  if (input.pressed(Pause)) resources.get(MotionSettings).pausedAll = !resources.get(MotionSettings).pausedAll;
}, { before: "fenrir.motion.preUpdate" });
```

### persistResource

```ts
function persistResource<T extends object, K extends keyof T & string>(game: Pick<GameBase, "resources" | "logger" | "addSystem">, resource: ResourceType<T>, field: K, key: StorageKey<T[K]>): () => void;
```

Keeps `resource[field]` in the storage key `key`, so a setting such as `AudioState.muted` is
saved with no hand-written sync. Setup, like `game.on`: call it once, after `createGame` (the
resource must have a value, so after the plugin that adds it is installed).

- Load: the field is set from the key at once or, with a backend that hydrates, as soon as
  `fenrir.storage.preInit` has hydrated it, before the game's startup systems. With nothing
  valid stored, the field gets the key's default, so give the key the resource's default.
- Save: when the field's value has changed, it is written with `setStored` at the end of each
  frame (`fenrir.storage.postUpdate`) and when a run stops (`fenrir.storage.exit`). Objects
  are compared as JSON, so editing one in place counts as a change.
- The binding owns the key: change the field, not the key, or the field will not follow.
  Returns a function that ends the binding and leaves what is stored.

Nothing is persisted unless the game asks: the engine binds no field of its own.

Throws without the `storage()` plugin, when the resource has no value, or when the key is
already bound.

```ts
const Muted = defineStorageKey("myGame.muted", { default: false });
const game = await createGame({ canvas, plugins: [storage(), audio(), pixi2d()] });
persistResource(game, AudioState, "muted", Muted);
```

### removeStored

```ts
function removeStored(ctx: StorageCtx, key: StorageKey<unknown>): void;
```

Removes `key` from the backend and from memory, so the next read gives the default. Never throws.

### setAssetLoader

```ts
function setAssetLoader(target: Pick<AssetCtx, "assets">, loader: ManifestLoader | null): void;
```

Makes every manifest of this game load through `loader` instead of the asset store's loaders,
so a test or tool decides when each asset resolves or fails, with no network. `null` restores
the store's loaders. Affects loads that start afterwards.

### setStored

```ts
function setStored<T>(ctx: StorageCtx, key: StorageKey<T>, value: NoInfer<T>): boolean;
```

Stores `value` under `key`. Never throws: if the backend refuses it (quota, blocked, or a
value JSON cannot hold), the value is kept in memory, so `getStored` returns it for the rest
of the session, and the failure is logged once per key and set in `StorageStatus.lastError`.
Returns whether the backend took it.

### storage

```ts
function storage(options?: StorageOptions): Plugin;
```

Stores typed values: `getStored`, `setStored`, `updateStored` and `removeStored` need it. It
adds the `StorageStatus` resource and uses `localStorage` unless given a `backend`. When
`localStorage` is unavailable (private mode, storage blocked in a webview or sandboxed frame),
it falls back to memory, logs one warning and sets `StorageStatus.persistent` to false: the
game keeps working, and values last for the session.

A backend with `hydrate` is awaited once, in `fenrir.storage.preInit`, before the first run's
other startup systems. Values are not tied to a run: they stay across `stop()` and `run()`.
Changes made by another tab are not seen while a value is cached.

```ts
const game = await createGame({ canvas, plugins: [storage(), pixi2d()] });
const test = await createTestGame({ seed: 1, plugins: [storage({ backend: memoryStorage() })] });
```

### unloadAsset

```ts
function unloadAsset<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, names: NoInfer<keyof A & string> | readonly NoInfer<keyof A & string>[]): void;
```

Drops the holds `loadAsset` took on `names`. Each asset no bundle (of any manifest) still holds
is released as `unloadAssets` releases a bundle's: out of the store, and its loader's `unload`
runs. A name `loadAsset` does not hold is a no-op; an asset still loading is unloaded too, and
its `loadAsset` promise rejects.

### unloadAssets

```ts
function unloadAssets<A extends AssetDeclarations, B extends string>(ctx: AssetCtx, manifest: AssetManifest<A, B>, bundles: NoInfer<B> | readonly NoInfer<B>[]): void;
```

Unloads bundles of `manifest`. Each asset no other bundle (of any manifest) still holds is
dropped from the asset store, and its loader's `unload` runs: for a 2D texture that is Pixi's
`Assets.unload`, which destroys the texture. Remove the entities that show a bundle's assets
before unloading it; a sprite still showing a destroyed texture draws nothing or fails to render.
A bundle still loading is unloaded too, and its `loadAssets` promise rejects.

### updateStored

```ts
function updateStored<T>(ctx: StorageCtx, key: StorageKey<T>, update: (current: T) => NoInfer<T>): T;
```

Stores `update(current)` under `key` and returns it. As `setStored`, it never throws.

## Classes

### AssetBundleError

```ts
class AssetBundleError extends Error {
    readonly manifest: string;
    readonly bundle: string;
    readonly failures: readonly AssetFailure[];
    constructor(manifest: string, bundle: string, failures: readonly AssetFailure[], cause: unknown);
}
```

The rejection of `loadAssets` when a bundle failed. Every asset of the bundle was tried first.

### AssetLoadError

```ts
class AssetLoadError extends Error {
    readonly manifest: string;
    readonly asset: string;
    readonly src: string;
    constructor(manifest: string, failure: AssetFailure, cause: unknown);
}
```

The rejection of `loadAsset` when the asset failed, with no fallback and not optional.

### AssetStore

```ts
class AssetStore implements IAssetStore {
    static addInstaller(installer: AssetStoreInstaller): void;
    constructor(config: AssetStoreConfig);
    registerLoader<K extends AssetKind>(kind: K, name: string, config: LoaderConfig<AssetKinds[K]>, label?: string): void;
    getSupportedExtensions(kind: string): string[];
    resolveLoader<K extends AssetKind>(kind: K, url: string, label?: string): AssetLoader<AssetKinds[K]>;
    setAsset<K extends AssetKind>(key: AssetKey, kind: K, asset: Promise<AssetKinds[K]>): void;
    kindOf(key: AssetKey): AssetKind | undefined;
    peek<K extends AssetKind>(key: AssetKey, kind: K): Promise<AssetKinds[K]> | undefined;
    get(key: AssetKey): Promise<Asset>;
    get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;
    clear(): void;
}
```

Caches loaded assets by key and picks a loader by file extension.

Core knows nothing about textures or models. Each asset kind ("model",
"texture3d", "texture2d") is added by the entry point that renders it, which
registers its default loaders and typed methods when it loads.

Members:

- `addInstaller`: Adds default loaders to every store constructed from now on. The 2D and 3D entries call this when they load.
- `registerLoader`: Registers a loader for one asset kind. `label` names the kind in messages, for example "2D texture".
- `getSupportedExtensions`: Sorted extensions that loaders of this kind handle.
- `resolveLoader`: The loader of this kind for the URL's extension. Throws if none handles it.
- `setAsset`: Stores a pending or loaded asset under `key`, replacing whatever was there.
- `kindOf`: The kind of asset stored under `key`, if any.
- `peek`: The promise stored under `key` if it is of this kind, without awaiting it.

### ConsoleLogger

```ts
class ConsoleLogger implements ILogger {
    trace(message: string, meta?: LogMeta): void;
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string, meta?: LogMeta): void;
}
```

Logs to the browser console. The default logger of `createGame`.

### Engine

```ts
class Engine {
    constructor(opts: EngineOptions);
    run(): Promise<void>;
    stop(): Promise<void>;
    pause(): void;
    resume(): void;
    step(dt?: number, frames?: number): void;
    reset(): Promise<void>;
    getTime(): Time;
    isRunning(): boolean;
    isActive(): boolean;
    addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
    addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
    addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
    addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
    replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
    removeSystem(name: string): this;
    getScheduler(): Scheduler;
}
```

The frame loop and lifecycle under a `Game`. 2D games use `createGame`; `Engine` stays exported for the 3D path and the editor.

Members:

- `step`: Runs `frames` whole frames now, each `dt` seconds long, through the same frame body as the browser loop: PreUpdate, as many Tick stages as the accumulator holds (at most `maxTicksPerFrame`, the rest dropped), Update, PostUpdate, then the event buffers advance.
- `isActive`: Whether startup finished and the run has not begun to stop: running or paused.
- `replaceSystem`: Swaps the function of the system called `name`, keeping its position and options.
- `removeSystem`: Removes the system called `name`. While running, it stops from the next frame.

### EntityBuilder

```ts
class EntityBuilder {
    static create(): EntityBuilder;
    with<T>(type: ComponentType<T>, value: ValueOrFactory<T>): this;
    modify<T>(type: ComponentType<T>, modifier: (existing: T | undefined, e: Entity, entities: EntityList) => T): this;
    transform(pos?: Vec3Like, rot?: QuatLike, scale?: Vec3Like): this;
    name(value: string): this;
    transform2D(x?: number, y?: number, options?: {
        rotation?: number;
        scaleX?: number;
        scaleY?: number;
    }): this;
    display2D(options?: {
        alpha?: number;
        visible?: boolean;
    }): this;
    child(child: EntityBuilder | ((p: EntityBuilder) => void)): this;
    spawn(entities: EntityList): Entity;
    spawnInto(entities: EntityList, parent: Entity): Entity;
    static extend<T extends Record<string, any>>(methods: T): void;
}
```

Builds an entity from components, then `spawn(ctx.entities)`. Renderer entries add their own methods when imported, such as `pixiNode` from `fenrir-ts/2d`.

Members:

- `modify`: Modify an existing component on the entity. If the component doesn't exist, it will be created with the modifier function.
- `transform`: Adds the engine's `Transform`. Defaults come from the installed factory: Three objects once fenrir-ts/3d is loaded.
- `name`: Adds the engine's `Name`.
- `transform2D`: Adds `Transform2D`: `x`, `y` in logical units, `rotation` in radians, scale 1 unless given.
- `display2D`: Adds `Display2D`: `alpha` 1 and `visible` true unless given.
- `child`: Add a child prefab. You can pass an existing EntityBuilder or a builder callback.
- `spawn`: Spawns a root entity (no parent)
- `spawnInto`: Spawns and parents under an existing entity

### EntityList

```ts
class EntityList {
    readonly signals: ComponentSignals;
    nullEntity(): Entity;
    createEntity(): Entity;
    destroyEntity(entity: Entity);
    isAlive(entity: Entity);
    idOf(entity: Entity): number;
    genOf(entity: Entity): number;
    capacity(): number;
    clear(): void;
    set<T>(entity: Entity, type: ComponentType<T>, component: T): boolean;
    has<T>(entity: Entity, type: ComponentType<T>): boolean;
    get<T>(entity: Entity, type: ComponentType<T>): T;
    tryGet<T>(entity: Entity, type: ComponentType<T>): T | undefined;
    remove<T>(entity: Entity, type: ComponentType<T>): boolean;
    pool<T>(type: ComponentType<T>): Pool<T>;
    entityFromId(entityId: number): Entity;
    view<TTypes extends AnyTypes>(types: TTypes);
    each<TTypes extends readonly ComponentType<any>[]>(types: TTypes, fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void): void;
    forEachChild(parent: Entity, fn: (child: Entity) => void);
    addChild(parent: Entity, child: Entity);
    removeChild(parent: Entity, child: Entity);
}
```

EntityList manages entity lifetimes (create/destroy) and id recycling.
Component pools will be built on top of this.

Members:

- `createEntity`: Create a new entity (reuses a destroyed id if available).
- `destroyEntity`: Destroys an entity, its child entities first, and removes every component it had (each removal is signalled, so a `PixiNode`'s node is destroyed). Returns false if the handle was already dead or invalid.
- `isAlive`: Checks if an entity handle is currently alive and matches generation.
- `idOf`: Extract the numeric entity id (index) from a handle
- `genOf`: Extract the generation/version from a handle
- `capacity`: Total allocated ids (includes dead). Useful for debugging.
- `clear`: Clear all entities from the entity list
- `set`: Add or replace a component on an entity. Returns true if inserted, false if replaced.
- `pool`: Expose a pool for view iteration
- `view`: Create or get a cached view for the given component types.

### EventBus

```ts
class EventBus {
    send<T>(type: EventType<T>, ev: T);
    on<T>(type: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void;
    read<T>(type: EventType<T>);
    createReader<T>(type: EventType<T>);
    update();
    clear();
}
```

The game's events: `ctx.events` and `game.events`. Buffers each event for two frames for readers, and calls immediate listeners inside `send`.

Members:

- `send`: Buffers the event for readers, then calls the immediate listeners in registration order. Listeners are called only while a run is going; outside one the event is only buffered.
- `on`: Calls `handler` at every `send` of `type` for the rest of the current run, and removes it when the run stops. Call it from a system. Returns a function that removes it sooner. For a listener that outlives a run, use `game.on`.

### EventQueue

```ts
class EventQueue<T> {
    send(ev: T);
    update();
    read(): readonly T[];
    createReader(): EventReader<T>;
    clearAll();
}
```

Internal storage for one event type. Games use `EventBus` (`ctx.events`) instead.

Members:

- `update`: called once per frame, after all stages
- `read`: returns stable array until next send/update
- `createReader`: A reader has its own cursor over the queue's two retained frame buffers.

### NullLogger

```ts
class NullLogger implements ILogger {
    trace(_m: string, _meta?: LogMeta);
    debug(_m: string, _meta?: LogMeta);
    info(_m: string, _meta?: LogMeta);
    warn(_m: string, _meta?: LogMeta);
    error(_m: string, _meta?: LogMeta);
}
```

Drops every message. Extend it in tests to record what was logged.

### Pool

```ts
class Pool<T> {
    size();
    has(entityId: number);
    indexOf(entityId: number): number;
    get(entityId: number): T;
    tryGet(entityId: number): T | undefined;
    getAt(denseIndex: number): T;
    entityAt(denseIndex: number): number;
    entities(): readonly number[];
    components(): readonly T[];
    set(entityId: number, component: T);
    remove(entityId: number): T | undefined;
    forEach(fn: (entityId: number, component: T) => void);
}
```

Sparse-set component pool (EnTT-style).
- sparse[entityId] = denseIndex + 1 (0 means not present)
- denseEntities[denseIndex] = entityId
- dense[denseIndex] = component

Members:

- `indexOf`: Returns dense index, or -1 if missing
- `get`: Get component by entity id (sparse lookup)
- `getAt`: Get by dense index (fast path)
- `set`: Add or replace. Returns true if inserted, false if replaced.
- `remove`: Remove component for entityId. Returns true if removed, false if it wasn't present.
- `forEach`: Iterate all entries in packed order

### Random

```ts
class Random {
    readonly seed: number;
    constructor(seed: number);
    next(): number;
    int(min: number, max: number): number;
    pick<T>(items: readonly T[]): T;
}
```

A seeded random source: `ctx.random` and `game.random`. The same seed gives the same
sequence, so a game that draws only from here replays exactly in a test.

The generator is mulberry32 (Tommy Ettinger, 2017): 32 bits of state, period 2^32,
good enough statistically for gameplay. Not for cryptography.

Members:

- `seed`: The 32-bit seed this source started from. Log it to replay a run.
- `next`: A float in [0, 1).
- `int`: An integer from `min` to `max`, both included. Unbiased: draws are rejected rather than folded with `%`. `max - min` may be at most 2^32 - 1.
- `pick`: One item of `items`, each equally likely. Throws on an empty list.

### Resources

```ts
class Resources {
    get<T>(resource: ResourceType<T>): T;
    has<T>(resource: ResourceType<T>): boolean;
    set<T>(resource: ResourceType<T>, value: NoInfer<T>): void;
}
```

The resources of one game: `game.resources` and `ctx.resources` are the same object.
Values are kept until the engine resets; stopping and running again keeps them.

Members:

- `get`: Returns the resource's value, running its factory on first use.
- `has`: Whether the resource has a value: set, or made by its factory on an earlier `get`. Never runs the factory. A plugin's resource (`AudioState`, `MotionSettings`, `StorageStatus`) has a value once the plugin is installed, so this is how game code and tests ask whether an optional plugin is there before using it.
- `set`: Replaces the resource's value. Works before `game.run()` and from any system.

### Scene

```ts
class Scene {
    name: string;
    readonly entityList: EntityList;
    constructor(name: string);
}
```

A named set of entities. `fenrir-ts/3d` adds the skybox members (`skybox`, `setSkybox`,
`removeSkybox`, `hasSkybox`) when it is imported.

### SceneManager

```ts
class SceneManager {
    constructor(logger?: ILogger);
    getActiveScene(): Scene;
    changeActiveScene(name: string): void;
    createScene(name: string): Scene;
    destroyScene(name: string): void;
    getScene(name: string): Scene;
    listScenes(): readonly Scene[];
}
```

The game's scenes: `ctx.scenes`. Always holds at least one scene; `ctx.scene` and `ctx.entities` are the active one's.

### Scheduler

```ts
class Scheduler {
    addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
    addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
    addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
    addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
    replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
    removeSystem(name: string): this;
    getSystems<S extends SyncStage>(stage: S): readonly SyncSystemFn[];
    getSystems<S extends AsyncStage>(stage: S): readonly AsyncSystemFn[];
    getSystems(stage: ScheduleStage): readonly (SyncSystemFn | AsyncSystemFn)[];
    getSchedule(stage: ScheduleStage): readonly ScheduledSystem[];
    describe(): string;
    beginRun(): void;
    flush(): void;
    endRun(): void;
    current(stage: ScheduleStage): readonly ScheduledSystem[];
    runSyncStage<S extends SyncStage>(stage: S, ctx: SystemCtx): void;
    runAsyncStage<S extends AsyncStage>(stage: S, ctx: SystemCtx): Promise<void>;
}
```

Holds the systems of each stage and runs them.

Order is resolved when a run begins (`beginRun`). While a run is active, adding, replacing
or removing a system is checked at once, so a bad change throws at the call, and takes effect
at the next `flush`, which the engine calls before each frame and between startup stages.

Members:

- `replaceSystem`: Swaps the function of every system called `name`, keeping its stage, position and options. While running, the new function runs from the next frame.
- `removeSystem`: Removes every system called `name`. While running, it stops running from the next frame.
- `getSystems`: The system functions of a stage, in the order they run.
- `getSchedule`: The systems of a stage with their names and options, in the order they run.
- `describe`: The whole schedule as text, one stage per line: `update: movePlayer, applyDamage`.
- `beginRun`: Resolves the order of every stage and starts applying changes at `flush` only. Throws, naming the systems involved, if a constraint is unknown or cyclic.
- `flush`: Applies changes made since the last flush. Called by the engine between frames.
- `endRun`: Ends the run: changes apply immediately again and are checked when the next run begins.
- `current`: The systems a stage runs now, as of the last flush while running.
- `runSyncStage`: Runs a stage's systems in order. State changes queued by a system are applied after it returns, before the next system's `runIf`; changes made outside a system, before the first.
- `runAsyncStage`: As `runSyncStage`, awaiting each system. Stops before the next system once `ctx.signal` aborts.

### Time

```ts
class Time {
    fixedDelta: number;
    accumulator: number;
    constructor(clock: Clock);
    get delta(): number;
    get elapsed(): number;
    now(): number;
    update(maxDelta?: number, frameSeconds?: number);
    pause(): void;
    resume(): void;
    reset(): void;
}
```

Frame and game time: `ctx.time`. Reads only the clock it is given, which defaults to the
real one, so tests can control every reading.

Members:

- `fixedDelta`: Seconds per fixed tick. Settable; defaults to 1/60.
- `accumulator`: Seconds of frame time not yet consumed by fixed ticks, below `fixedDelta` after each frame. `accumulator / fixedDelta` is the interpolation factor between the last two ticks.
- `delta`: Seconds since the last frame, clamped to the engine's maximum frame delta.
- `elapsed`: Seconds of game time since the run started, excluding pauses.
- `now`: Wall-clock milliseconds since the Unix epoch. Use instead of `Date.now()`.
- `update`: Starts a frame: sets `delta`, clamped to `maxDelta`, and adds it to the accumulator. Without `frameSeconds`, the frame lasted since the last update, read from the clock. With it, the frame lasted exactly that long, which is how `game.step(dt)` runs frames: the delta is `dt` itself, not a clock difference, so fixed ticks add up without rounding. A frame stepped while paused counts towards `elapsed`.

### View

```ts
class View<TTypes extends readonly ComponentType<any>[]> {
    readonly types: TTypes;
    constructor(entityList: EntityList, types: TTypes);
    each(fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void): void;
}
```

A cached query over entities with every component in `types`. `entities.each(QUERY, fn)` uses one; keep each query tuple in a module-level constant.

## Constants

### AssetBundleFailed

```ts
const AssetBundleFailed: EventType<{ manifest: string; bundle: string; failures: AssetFailure[]; }>;
```

Sent when a bundle has settled with at least one asset failed and no fallback for it.

### AssetBundleLoaded

```ts
const AssetBundleLoaded: EventType<{ manifest: string; bundle: string; fallbacks: string[]; missing: string[]; }>;
```

Sent when a bundle has loaded: every asset ready, showing its fallback (`fallbacks`), or an
optional asset that is missing (`missing`).

### AssetFailed

```ts
const AssetFailed: EventType<{ manifest: string; } & AssetFailure>;
```

Sent when an asset requested by name with `loadAsset` failed, with no fallback and not optional.

### assetKey

```ts
const assetKey: (k: string) => AssetKey;
```

Brands a string as an `AssetKey`.

### AssetLoaded

```ts
const AssetLoaded: EventType<{ manifest: string; asset: string; status: "loaded" | "fallback" | "missing"; }>;
```

Sent when an asset requested by name with `loadAsset` has settled without failing. `status` is
`loaded`, `fallback` (its fallback is shown) or `missing` (optional, nothing to show).

### Display2D

```ts
type Display2D = {
    alpha: number;
    visible: boolean;
};
const Display2D: ComponentType<Display2D>;
```

How an entity's 2D node or `Renderable2D` view is shown: `alpha` from 0 to 1 and `visible`.
Opt in per entity. The 2D renderer writes it each frame, with `Transform2D`, and it wins over
a `Renderable2D`'s `flags.alpha` and `flags.visible`. Without it the renderer leaves the
node's own `alpha` and `visible` alone; removing it leaves the last values written.

### easings

```ts
const easings: { linear: (t: number) => number; quadIn: (t: number) => number; quadOut: (t: number) => number; quadInOut: (t: number) => number; cubicIn: (t: number) => number; cubicOut: (t: number) => number; cubicInOut: (t: number) => number; sineIn: (t: number) => number; sineOut: (t: number) => number; sineInOut: (t: number) => number; backOut: (t: number) => number; };
```

The built-in easings, by the name a tween's `ease` takes. Each is a plain function, so code
can also call one directly: `easings.quadOut(0.5)`.

### MotionSettings

```ts
interface MotionSettings {
    paused: Record<string, boolean>;
    pausedAll?: boolean;
    reducedMotion: boolean;
}
const MotionSettings: ResourceType<MotionSettings>;
```

Settings for every timer and tween of a game. Set by the `motion()` plugin; edit the fields.

They are read when `fenrir.motion.preUpdate` runs, first in `PreUpdate`. A change made by a
game system that runs after it (any later `PreUpdate` system, or `Update`) takes effect at the
next frame. To have a pause take effect in the frame that decides it, decide it in a system
ordered before the motion system: `{ before: "fenrir.motion.preUpdate" }` in `PreUpdate`,
where this frame's input is already latched.

Members:

- `paused`: Groups whose timers and tweens are paused: `paused.ambient = true`. Remove or set false to resume.
- `pausedAll`: Pauses every timer and tween, grouped or not, as if each were paused: a pause menu. Set it back to false to resume. Defaults to false. Optional so settings written by hand before it existed still type-check.
- `reducedMotion`: When true, every tween jumps to its end values at the next frame and sends `TweenDone`, including tweens added later and repeating ones (which end where their last play would). Timers are not affected: they measure game time, not motion.

### Name

```ts
type Name = {
    name: string;
};
const Name: ComponentType<Name>;
```

The engine's name component (`fenrir.Name`), set by `EntityBuilder.name()`. `inspect()` shows it as the entity's `name`.

### Relationship

```ts
type Relationship = {
    parent: Entity;
    firstChild: Entity;
    nextSibling: Entity;
    prevSibling: Entity;
};
const Relationship: ComponentType<Relationship>;
```

The engine's parent and sibling links (`fenrir.Relationship`), set by `EntityBuilder.child()` and `spawnInto`. `inspect()` shows it as `parent`.

### Schedule

```ts
const Schedule: { readonly PreInit: "preInit"; readonly Init: "init"; readonly PostInit: "postInit"; readonly PreUpdate: "preUpdate"; readonly Tick: "tick"; readonly Update: "update"; readonly PostUpdate: "postUpdate"; readonly Exit: "exit"; };
```

The stage names for `addSystem`. `PreInit`, `Init`, `PostInit` and `Exit` may be async and are awaited; `PreUpdate`, `Tick` (fixed step), `Update` and `PostUpdate` run every frame and must be sync.

### StorageStatus

```ts
interface StorageStatus {
    backend: string;
    persistent: boolean;
    lastError: {
        key: string | null;
        message: string;
    } | null;
}
const StorageStatus: ResourceType<StorageStatus>;
```

Where storage stands, as plain data: `inspect(game)` shows it under `fenrir.StorageStatus`.

Members:

- `backend`: The backend in use: `"localStorage"`, `"memory"`, or an injected backend's name.
- `persistent`: False when values live only in memory for this session: storage was unavailable or failed to hydrate.
- `lastError`: The latest failure: an unavailable store, a write that threw (quota), or a value that did not parse.

### TimerFired

```ts
const TimerFired: EventType<{ entity: Entity; name: string; count: number; last: boolean; }>;
```

Sent each time a timer fires, in the frame it fires. `last` is true when the timer is gone.

### Timers

```ts
type Timers = Record<string, Timer>;
const Timers: ComponentType<Timers>;
```

The timers of one entity, by name.

### Transform

```ts
type Transform = {
    position: Vec3Like;
    rotation: QuatLike;
    scale: Vec3Like;
};
const Transform: ComponentType<Transform>;
```

Position, rotation and scale. Core and the 2D renderer only read the fields.
`fenrir-ts/3d` exports the same component typed with Three's classes, and once
it is loaded every default transform is made of Three objects.

### Transform2D

```ts
type Transform2D = {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
};
const Transform2D: ComponentType<Transform2D>;
```

Position, rotation and scale in 2D, as plain numbers: logical units for `x` and `y`,
radians for `rotation`. Opt in per entity; entities still get the default `Transform`.
The 2D renderer writes it to an entity's `PixiNode` and `Renderable2D` each frame and
prefers it over `Transform` when an entity has both. It is plain data, so game logic and
`createTestGame` tests use it with no renderer.

### TweenDone

```ts
const TweenDone: EventType<{ entity: Entity; name: string; }>;
```

Sent when a tween ends on its end values, in the frame it ends. Not sent when it is cancelled or replaced.

### Tweens

```ts
type Tweens = Record<string, Tween>;
const Tweens: ComponentType<Tweens>;
```

The tweens of one entity, by name.

## Types

### ActionType

```ts
interface ActionType {
    readonly name: string;
    readonly bindings: readonly InputBinding[];
}
```

A named action and the inputs that drive it. Made by `defineAction`.

### Asset

```ts
type Asset = AssetKinds[AssetKind];
```

Any loaded asset: the union of every kind this program knows. `never` when
no kind is known, because then nothing can be stored.

### AssetCounts

```ts
interface AssetCounts {
    loaded: number;
    missing: number;
    failed: number;
    total: number;
    fraction: number;
}
```

Counts over a set of assets. `fraction` is `(loaded + missing) / total`, or 1 when `total` is 0.

Members:

- `loaded`: Assets ready to read: loaded, or showing their fallback.
- `missing`: Optional assets that failed with nothing to show. They count as done, not failed.
- `failed`: Assets that failed with no fallback and are not optional.

### AssetCtx

```ts
type AssetCtx = {
    readonly assets: AssetStore;
    readonly resources: Resources;
    readonly events: EventBus;
    readonly logger: ILogger;
};
```

What the manifest functions need: a `SystemCtx`, or the `Game` or `TestGame` itself.

### AssetDeclaration

```ts
interface AssetDeclaration<Name extends string = string> {
    readonly kind: AssetKind;
    readonly src: string;
    readonly fallback?: Name;
    readonly optional?: boolean;
}
```

One asset of a manifest: its kind, where it loads from, and optionally a fallback.

Members:

- `kind`: An asset kind this program knows, such as `"texture2d"` from `fenrir-ts/2d`.
- `src`: The URL the kind's loader reads, chosen by its extension.
- `fallback`: Another asset of the same manifest and kind, used in this one's place if it fails to load. Every bundle that lists this asset also loads the fallback. A fallback has no fallback.
- `optional`: `true`: a failure is cosmetic. If it fails (and its fallback, if any, fails too) it is `missing`: logged as a warning, counted in `missing`, and its bundle still loads. `getAsset` returns `undefined` for it. Default `false`: a failure fails the bundle.

### AssetDeclarations

```ts
type AssetDeclarations = {
    readonly [name: string]: AssetDeclaration;
};
```

The assets of a manifest, by name.

### AssetFailure

```ts
interface AssetFailure {
    asset: string;
    src: string;
    error: string;
}
```

One asset that failed with no fallback.

### AssetKey

```ts
type AssetKey = string & {
    __assetKey?: true;
};
```

A key in the asset store: an asset's name. Make one with `assetKey(name)`.

### AssetKind

```ts
type AssetKind = keyof AssetKinds & string;
```

The name of an asset kind this program knows.

### AssetKinds

```ts
interface AssetKinds {
}
```

The asset kinds this program can load, mapped to the type a loaded asset of
that kind has. Empty in core: `fenrir-ts/2d` adds `texture2d`, and
`fenrir-ts/3d` adds `model` and `texture3d`. A game adds its own kinds the
same way, with `declare module "fenrir-ts" { interface AssetKinds { ... } }`.

### AssetLoader

```ts
type AssetLoader<T> = (src: AssetSource) => Promise<T>;
```

Loads one asset from a source. Registered per kind and extension on the asset store.

### AssetManifest

```ts
interface AssetManifest<A extends AssetDeclarations = AssetDeclarations, B extends string = string> {
    readonly name: string;
    readonly assets: A;
    readonly bundles: {
        readonly [K in B]: readonly (keyof A & string)[];
    };
    readonly progress: ResourceType<AssetProgress<keyof A & string, B>>;
}
```

A manifest, made by `defineAssets`. Plain data apart from `progress`, which is a resource handle.

Members:

- `name`: Namespaced, such as `myGame.assets`. Also the name of `progress`.
- `bundles`: Asset names per bundle, as declared.
- `progress`: The resource that holds this manifest's `AssetProgress` in each game.

### AssetName

```ts
type AssetName<M extends AssetManifest<any, any>> = keyof M["assets"] & string;
```

The name of an asset of `M`.

### AssetProgress

```ts
interface AssetProgress<A extends string = string, B extends string = string> extends AssetCounts {
    bundles: Record<B, BundleProgress>;
    assets: Record<A, AssetState>;
}
```

A manifest's progress, as plain data: the value of `manifest.progress`, a resource, so a HUD
reads it each frame with `ctx.resources.get(manifest.progress)` and `inspect(game)` shows it.
The top-level counts are over every asset a loading or loaded bundle, or `loadAsset`, holds.

### AssetSource

```ts
type AssetSource = {
    url: string;
} | {
    url: string;
    format?: string;
};
```

Where an asset loads from.

### AssetState

```ts
interface AssetState {
    status: AssetStatus;
    error: string | null;
    bundles: string[];
    direct: boolean;
}
```

One asset in `AssetProgress`.

Members:

- `error`: Why it failed, when its status is `failed` or `fallback`.
- `bundles`: The loading or loaded bundles of this manifest that hold it. It is unloaded when none do and `direct` is false.
- `direct`: Whether `loadAsset` holds it by name (until `unloadAsset`), apart from any bundle.

### AssetStatus

```ts
type AssetStatus = "unloaded" | "loading" | "loaded" | "fallback" | "missing" | "failed";
```

Where one asset of a manifest stands. `fallback`: it failed and its fallback is shown instead.
`missing`: an `optional` asset that failed with no fallback to show; `getAsset` returns `undefined`.

### AssetStoreConfig

```ts
interface AssetStoreConfig {
}
```

Constructor options. Empty in core: `fenrir-ts/2d` adds `texture2DLoaders`,
and `fenrir-ts/3d` adds `modelLoaders` and `textureLoaders`.

### AsyncStage

```ts
type AsyncStage = typeof Schedule.PreInit | typeof Schedule.Init | typeof Schedule.PostInit | typeof Schedule.Exit;
```

The stages whose systems may return a promise, which is awaited: `PreInit`, `Init`, `PostInit` and `Exit`.

### AsyncSystemFn

```ts
type AsyncSystemFn = (ctx: SystemCtx) => void | Promise<void>;
```

A system for a startup or `Exit` stage; a returned promise is awaited.

### BundleName

```ts
type BundleName<M extends AssetManifest<any, any>> = keyof M["bundles"] & string;
```

The name of a bundle of `M`.

### BundleProgress

```ts
interface BundleProgress extends AssetCounts {
    status: BundleStatus;
}
```

One bundle in `AssetProgress`. Its counts include the fallbacks it loads.

### BundleStatus

```ts
type BundleStatus = "unloaded" | "loading" | "loaded" | "failed";
```

Where one bundle stands. `failed`: an asset without a fallback failed; the others loaded.

### Clock

```ts
interface Clock {
    monotonic(): number;
    now(): number;
}
```

Where the engine reads time. `Time` reads only its clock, never `performance.now()` or
`Date.now()` directly, so a test can pass a clock it controls.

Two readings, because they are different quantities:
- `monotonic()` measures intervals: frame deltas and `time.elapsed`. It never jumps when the
  system clock is adjusted. The real clock uses `performance.now()`.
- `now()` is the wall clock in epoch milliseconds, what `Date.now()` returns, for timestamps
  that must survive a reload. The real clock uses `Date.now()`.

One clock supplies both, so moving a test clock moves both together.

Members:

- `monotonic`: Milliseconds from an arbitrary origin. Never goes backwards.
- `now`: Wall-clock milliseconds since the Unix epoch.

### ComponentType

```ts
type ComponentType<T> = symbol & {
    __component?: T;
};
```

A typed component key, made by `defineComponent<T>(name)`.

### DebugGlobal

```ts
interface DebugGlobal {
    inspect(): GameSnapshot;
}
```

What `exposeInspector(game)` puts on `window.__FENRIR__`.

### Easing

```ts
type Easing = (t: number) => number;
```

Maps progress `t` from 0 to 1 onto eased progress, 0 at 0 and 1 at 1.

### EasingName

```ts
type EasingName = keyof typeof easings;
```

The name of a built-in easing.

### EngineOptions

```ts
type EngineOptions = {
    scheduler: Scheduler;
    sceneManager: SceneManager;
    events: EventBus;
    logger?: ILogger | null;
    maxFrameDelta?: number;
    maxTicksPerFrame?: number;
    services?: GameServices;
    clock?: Clock;
    loop?: "animationFrame" | "step";
    beforeStep?: (dt: number) => void;
};
```

What `new Engine(options)` takes. 2D games use `createGame` instead.

### Entity

```ts
type Entity = number;
```

An entity handle. Plain number: store it, compare it, never do arithmetic on it.

### EntitySnapshot

```ts
interface EntitySnapshot {
    readonly id: Entity;
    readonly name: string;
    readonly parent: Entity | null;
    readonly components: Readonly<Record<string, JsonValue>>;
}
```

One entity of the active scene, as `inspect(game)` reports it.

Members:

- `id`: The entity handle: the value `entities.get` and `entities.set` take.
- `name`: From the engine's `fenrir.Name` component.
- `parent`: The parent's handle, from the engine's `fenrir.Relationship` component; null for a root.
- `components`: Every other component, `fenrir.Transform` included, by the name given to `defineComponent`.

### EventHandler

```ts
type EventHandler<T> = (payload: T, ctx: SystemCtx) => void;
```

An immediate listener: called synchronously inside `send`, with the payload and the context
of the run that is going. It may be async; the promise is not awaited, and a rejection is
logged like a throw.

### EventReader

```ts
type EventReader<T> = {
    read(): readonly T[];
};
```

What `events.createReader(Type)` returns: `read()` gives the events it has not returned before. Create one per consumer, once.

### EventType

```ts
type EventType<T> = symbol & {
    __eventType?: T;
};
```

A typed event key, made by `defineEvent<T>(name)`.

### Game

```ts
interface Game extends GameBase {
    readonly canvas: HTMLCanvasElement;
    run(): Promise<void>;
    pause(): void;
    resume(): void;
}
```

A running game. Built by `createGame`.

Members:

- `run`: Runs PreInit, Init and PostInit, then resolves when the first frame is scheduled.
- `pause`: Stops scheduling frames. `step(dt)` runs frames while paused.

### GameBase

```ts
interface GameBase extends GameServices {
    readonly logger: ILogger;
    readonly assets: AssetStore;
    readonly events: EventBus;
    addSystem(stage: SyncStage, system: SyncSystemFn, options?: SystemOptions): this;
    addSystem(stage: AsyncStage, system: AsyncSystemFn, options?: SystemOptions): this;
    removeSystem(name: string): this;
    replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this;
    stop(): Promise<void>;
    isRunning(): boolean;
    step(dt?: number, frames?: number): void;
    onEnter<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
    onExit<V extends string>(state: StateType<V>, value: NoInfer<V>, system: SyncSystemFn): this;
    on<T>(event: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void;
}
```

What a `Game` and a `TestGame` share: registration, services, `stop` and `step`. Systems,
hooks and listeners written against it run unchanged in both.

Members:

- `removeSystem`: Removes every system called `name`. While running, it stops running from the next frame.
- `replaceSystem`: Swaps the function of every system called `name`, keeping its position and options.
- `stop`: Runs Exit systems, then cleanups in reverse order.
- `isRunning`: Whether the game is running: startup finished and `stop()` has not been called since, paused included. False before `run()` (or `start()` on a test game), during startup, and from the moment `stop()` is called. `run()` resolves without throwing when the game is stopped during startup, so check this after `await game.run()` to know gameplay started.
- `step`: Runs `frames` whole frames now, each `dt` seconds of game time (default 1/60), through the same frame body as the browser loop: PreUpdate, the Tick stages the accumulator holds (at most 8 a frame, the rest dropped, as after a long browser frame), Update, PostUpdate, then the event buffers advance. Fixed ticks accumulate from `dt` exactly.
- `onEnter`: Runs `system` each time `state` changes to `value`, after the exit hooks of the old value. Each run starts every state at its initial value and runs its enter hooks before the first PreInit system.
- `onExit`: Runs `system` each time `state` changes away from `value`, before the enter hooks of the new value.
- `on`: Calls `handler(payload, ctx)` synchronously at every `send` of `event` while the game runs, in registration order. Setup, like `addSystem`: it stays across `stop()` and `run()` until the returned function removes it. For a listener that belongs to one run, call `ctx.events.on` from a system.

### GameOptions

```ts
interface GameOptions {
    canvas: HTMLCanvasElement;
    plugins?: readonly Plugin[];
    logger?: ILogger;
    seed?: number;
    maxFrameDelta?: number;
}
```

What `createGame` takes. Only `canvas` is required.

Members:

- `canvas`: The canvas the game draws to. Renderer plugins read it from `game.canvas`.
- `plugins`: Installed in order. An async `install` is awaited before the next plugin installs.
- `logger`: Defaults to a ConsoleLogger.
- `seed`: Seeds `game.random` and `ctx.random`: a safe integer. Without one, the seed comes from the clock, and `game.random.seed` reports it. Stopping and running the game again continues the sequence; it does not restart it.
- `maxFrameDelta`: The longest frame the game simulates, in seconds: `time.delta` is clamped to it, so a frame after a stall (a background tab, a debugger, a slow device) moves the game this much at most, and `step(dt)` throws above it. Defaults to 0.25. A game whose motion must never jump far sets a smaller cap, such as `1 / 20`. A positive finite number; anything else throws.

### GameServices

```ts
interface GameServices {
    readonly resources: Resources;
    readonly states: States;
    readonly random: Random;
    readonly input: Input;
    readonly assets: AssetStore;
}
```

Services a game shares between `Game` and every `SystemCtx`: `game.x` and `ctx.x` are the
same object. `createGame` builds them and passes them to the engine. Entities are not a
service: they belong to the active scene, `ctx.entities` in a system. Outside one, a test
reads them through `inspect(game).entities`.

Members:

- `resources`: Singleton values this game owns. See `defineResource`.
- `states`: The current value of each state. See `defineState`.
- `random`: Seeded random numbers. Use instead of `Math.random()`. Seeded by `createGame({ seed })`.
- `input`: Actions and the pointer, latched when each frame starts. See `defineAction`.
- `assets`: Loaded assets by key, and the loaders for each kind. A manifest loads into it: see `defineAssets`.

### GameSnapshot

```ts
interface GameSnapshot {
    readonly frame: number;
    readonly time: {
        readonly elapsed: number;
        readonly delta: number;
    };
    readonly schedule: Readonly<Record<ScheduleStage, readonly string[]>>;
    readonly states: Readonly<Record<string, {
        readonly value: string;
        readonly timeIn: number;
    }>>;
    readonly resources: Readonly<Record<string, JsonValue>>;
    readonly entities: readonly EntitySnapshot[];
}
```

What a game is doing, as plain JSON. Returned by `inspect(game)`.

Members:

- `frame`: Frames run since the current run started. 0 during startup; kept after `stop()` until the next `run()`.
- `time`: `time.elapsed` and `time.delta` as of the start of the latest frame.
- `schedule`: System names per stage, in run order.
- `states`: Each state's current value and seconds in it, by the name given to `defineState`.
- `resources`: Each resource that has a value, by the name given to `defineResource`.
- `entities`: The active scene's entities, by id.

### IAssetStore

```ts
interface IAssetStore {
    get(key: AssetKey): Promise<Asset>;
    get<K extends AssetKind>(key: AssetKey, kind: K, label?: string): Promise<AssetKinds[K]>;
    clear(): void;
}
```

The asset store as systems see it. Core has the cache only. The 2D and 3D
entries add their typed loading and getter methods to this interface.

Members:

- `get`: The asset stored under `key`, whatever its kind. Rejects if nothing is stored.

### ILogger

```ts
interface ILogger {
    trace(message: string, meta?: LogMeta): void;
    debug(message: string, meta?: LogMeta): void;
    info(message: string, meta?: LogMeta): void;
    warn(message: string, meta?: LogMeta): void;
    error(message: string, meta?: LogMeta): void;
}
```

The logger: `ctx.logger` and `game.logger`. Pass one to `createGame({ logger })` to route engine messages.

### Input

```ts
interface Input {
    pressed(action: ActionType): boolean;
    released(action: ActionType): boolean;
    held(action: ActionType): boolean;
    readonly pointer: InputPointer;
    readonly focused: boolean;
    edges(actions: readonly ActionType[]): readonly InputEdge[];
    consumePointer(): void;
    consume(action: ActionType): void;
    onDown(action: ActionType, handler: InputDownHandler): () => void;
    onGesture(handler: InputGestureHandler): () => void;
}
```

Actions and the pointer, latched when each frame starts: every system in a frame, in every
stage, reads the same answers. `game.input` and `ctx.input` are the same object.

Members:

- `pressed`: The action went down this frame: none of its bindings was held last frame and one is now. True for exactly one frame, even for a tap that went down and up between two frames. In the `Tick` stage it is true in exactly one tick: the first that runs after the press.
- `released`: The action went up this frame: it was held last frame and no binding is down now. In `Tick`, true in exactly one tick.
- `held`: Any of the action's bindings is down. A tap is held for the one frame it is pressed in.
- `focused`: The canvas had keyboard focus when this frame started. Keys reach the game only while it has.
- `edges`: This frame's presses and releases of `actions`, in the order they happened, every one kept: two presses of one key between two frames are two `pressed` edges. An action is pressed when its first binding goes down and released when its last goes up, as for `pressed` and `released`. The list is what arrived since the last frame, so a quick tap is `pressed` then `released` here in the frame where `pressed()` is true. Bindings hidden by `consume` or `consumePointer` are left out until they lift; a press after the lift is listed again. In `Tick` it is the frame's list in every tick: read it in `PreUpdate` or `Update`.
- `consumePointer`: Stops this frame's pointer press reaching actions: for UI that handled the tap. Systems that run after this call see no `pressed`, `held` or `released` from the pointer bindings until the pointer is lifted; keys bound to the same action still count. Systems that ran earlier in the frame already saw the press, so the UI system must run first. `pointer.down` still reports the pointer. Does nothing in a frame with no new pointer press. Only this press is hidden: a press after the pointer lifts is seen again, even one in the next frame or one that lifted and went down again between two frames.
- `consume`: Stops this frame's press of `action` reaching later systems, whichever binding pressed it: for UI that handled the press. It hides the bindings that went down this frame as `consumePointer` hides the pointer: until they lift, systems that run after the call see no `pressed`, `held`, `released` or edges from them, for this action or any other bound to the same key or button. Does nothing when no binding of the action went down this frame. As for `consumePointer`, a later press of the same key is seen again.
- `onDown`: Calls `handler` synchronously inside each DOM event that presses one of `action`'s bindings, before the press is latched: every `keydown` of a bound key, auto-repeats included, and the `pointerdown` that presses a bound pointer button. Return `true` to claim the event and the engine calls `preventDefault()` on it, for example to keep Tab on the canvas while a canvas control can still take focus. The press is latched either way.
- `onGesture`: Calls `handler` synchronously inside every user gesture on the canvas: each `keydown` that is not an auto-repeat, `pointerdown` and `pointerup`. Some browser calls work only inside a gesture, such as `audioContext.resume()` on iOS Safari, where a touch counts on `pointerup`. Setup, like `onDown`: stays across runs, called only while the game runs. Returns a function that removes it. A handler that throws is logged.

### InputBinding

```ts
type InputBinding = KeyCode | PointerBinding;
```

What an action can be bound to: a key by `KeyboardEvent.code`, or a pointer button.

### InputDomEvent

```ts
type InputDomEvent = KeyboardEvent | PointerEvent;
```

The DOM event an input handler runs inside: a `keydown`, or a `pointerdown` or `pointerup`.

### InputDownHandler

```ts
type InputDownHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => boolean | void;
```

Runs inside the DOM event that pressed one of an action's bindings, with the current run's
ctx. Return `true` to claim the event: the engine calls `preventDefault()` on it. `event` is
`undefined` when a test game's input stands in for the player without one.

### InputEdge

```ts
interface InputEdge {
    readonly action: ActionType;
    readonly kind: "pressed" | "released";
    readonly binding: InputBinding;
}
```

One press or release of an action, from `input.edges(actions)`.

Members:

- `binding`: The key or pointer button whose press or release made the edge. One key bound to several actions gives each an edge with the same binding, one after another.

### InputGestureHandler

```ts
type InputGestureHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => void;
```

Runs inside a user gesture on the canvas, with the current run's ctx. `event` is `undefined` in a test game.

### InputPointer

```ts
interface InputPointer {
    readonly x: number;
    readonly y: number;
    readonly down: boolean;
    readonly inside: boolean;
    readonly cancelled: boolean;
}
```

The primary pointer as of the start of this frame.

Members:

- `x`: Logical x of the last pointer position: design units with `pixi2d({ design })`, else CSS pixels from the canvas's left edge.
- `y`: Logical y of the last pointer position.
- `down`: The primary pointer is down: left mouse button, a finger or a pen tip. `consumePointer` does not change it.
- `inside`: The pointer is over the canvas. False after a finger lifts or the mouse leaves.
- `cancelled`: The primary pointer went up this frame without being lifted: the browser cancelled it (`pointercancel` or lost pointer capture), the canvas lost focus, or the page was hidden. `released` still reports the release; check this to ignore a cancelled press.

### JsonValue

```ts
type JsonValue = null | boolean | number | string | readonly JsonValue[] | {
    readonly [key: string]: JsonValue;
};
```

A value that `JSON.stringify` writes and `JSON.parse` reads back unchanged.

### KeyCode

```ts
type KeyCode = `Key${KeyLetter}` | `Digit${KeyDigit}` | "Backquote" | "Backslash" | "BracketLeft" | "BracketRight" | "Comma" | "Equal" | "IntlBackslash" | "IntlRo" | "IntlYen" | "Minus" | "Period" | "Quote" | "Semicolon" | "Slash" | "AltLeft" | "AltRight" | "Backspace" | "CapsLock" | "ContextMenu" | "ControlLeft" | "ControlRight" | "Enter" | "MetaLeft" | "MetaRight" | "ShiftLeft" | "ShiftRight" | "Space" | "Tab" | "Convert" | "KanaMode" | "NonConvert" | "Delete" | "End" | "Help" | "Home" | "Insert" | "PageDown" | "PageUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp" | `Numpad${KeyDigit}` | "NumLock" | "NumpadAdd" | "NumpadComma" | "NumpadDecimal" | "NumpadDivide" | "NumpadEnter" | "NumpadEqual" | "NumpadMultiply" | "NumpadSubtract" | "Escape" | KeyFunction | "PrintScreen" | "ScrollLock" | "Pause";
```

A `KeyboardEvent.code` value: the physical key, whatever the layout. These are the standard
sections of the UI Events "KeyboardEvent code Values" spec: the writing-system keys, the
functional keys, the control and arrow pads, the numpad and the function row. Media and
browser keys are left out.

### LoaderConfig

```ts
type LoaderConfig<T> = {
    loader: AssetLoader<T>;
    extensions: string[];
    unload?: (asset: T, src: AssetSource) => void | Promise<void>;
};
```

A loader and the file extensions it handles.

### ManifestAsset

```ts
type ManifestAsset<A extends AssetDeclarations, N extends keyof A> = AssetKinds[A[N]["kind"]] | (A[N] extends {
    readonly optional: true;
} ? undefined : never);
```

What `getAsset` returns for asset `N`: the loaded type of its kind, plus `undefined` when it is
declared `optional: true` (a missing optional asset has no value).

### ManifestLoader

```ts
interface ManifestLoader {
    load(asset: {
        readonly name: string;
        readonly kind: AssetKind;
        readonly src: string;
    }): Promise<unknown>;
    unload?(asset: {
        readonly name: string;
        readonly kind: AssetKind;
        readonly src: string;
    }, value: unknown): void;
}
```

Loads manifest assets in place of the store's loaders. See `setAssetLoader`. `load` gets each
asset's `name`, `kind` and `src` as declared, and resolves with its value or rejects.

Members:

- `unload`: Called with the loaded value when the last bundle holding an asset is unloaded.

### MotionCtx

```ts
type MotionCtx = {
    readonly entities: EntityList;
    readonly resources: Resources;
};
```

What the helpers need: a `SystemCtx`, or anything with the game's `entities` and `resources`.

### NumericKeys

```ts
type NumericKeys<T> = {
    [K in keyof T]-?: T[K] extends number ? K : never;
}[keyof T] & string;
```

The keys of `T` whose values are numbers.

### Plugin

```ts
interface Plugin {
    readonly name: string;
    install(game: Game): void | Promise<void>;
}
```

Something that attaches to a game: a renderer, and later physics, audio or UI.

`install` runs once, inside `createGame`, before the game runs. It registers systems and
may read `game.canvas`, `game.logger`, `game.assets` and `game.events`. It should not acquire
resources such as GPU contexts or listeners: do that in an `Init` system, and release them
with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.

`createTestGame` installs plugins too, but a test game has no canvas: reading `game.canvas`
there throws, so a renderer plugin such as `pixi2d` fails to install and says so. A plugin
that only adds systems, resources or listeners installs in both.

Members:

- `name`: Namespaced, for example `fenrir.pixi2d` or `myGame.audio`. One plugin per name per game.

### PointerBinding

```ts
type PointerBinding = "pointer.primary" | "pointer.secondary";
```

The primary pointer (left mouse button, a finger, a pen tip) or the secondary one (right mouse button, pen barrel).

### QuatLike

```ts
type QuatLike = {
    x: number;
    y: number;
    z: number;
    w: number;
};
```

A rotation quaternion as the core reads it. Three's `Quaternion` satisfies it.

### ResourceType

```ts
interface ResourceType<T> {
    readonly name: string;
    readonly __resource?: (value: T) => T;
}
```

A typed handle to a resource: one value of type `T` per game. Made by `defineResource`.
The name is the identity: two handles with the same name read and write the same value.

### ScheduledSystem

```ts
interface ScheduledSystem {
    readonly name: string;
    readonly stage: ScheduleStage;
    readonly system: SyncSystemFn | AsyncSystemFn;
    readonly before: readonly string[];
    readonly after: readonly string[];
    readonly runIf?: (ctx: SystemCtx) => boolean;
}
```

A registered system, in the order its stage runs it.

### ScheduleStage

```ts
type ScheduleStage = (typeof Schedule)[keyof typeof Schedule];
```

A value of `Schedule`.

### SkyboxDescriptor

```ts
type SkyboxDescriptor = {
    readonly type: SkyboxType;
    readonly textures: SkyboxTextures;
    readonly enabled?: boolean;
};
```

Scene-level skybox descriptor, stored on the scene with `scene.setSkybox` from
`fenrir-ts/3d`, not as an ECS component.

### States

```ts
interface States {
    get<V extends string>(state: StateType<V>): V;
    set<V extends string>(state: StateType<V>, value: NoInfer<V>): void;
    timeIn(state: StateType<string>): number;
}
```

The current value of each state, for one game. `game.states` and `ctx.states` are the same object.

Members:

- `get`: The current value. A change queued with `set` is not visible until it is applied.
- `set`: Queues a change, applied after the current system returns: exit hooks for the old value, then enter hooks for the new value, then the next system. Setting the current value does nothing.
- `timeIn`: Seconds of game time since the current value was entered. Pauses do not count.

### StateType

```ts
interface StateType<V extends string> {
    readonly name: string;
    readonly values: readonly V[];
    readonly initial: V;
}
```

A state machine's definition: its name, its values and the value each run starts at.
Made by `defineState`. `V` is the union of the value strings.

### StorageBackend

```ts
interface StorageBackend {
    readonly name: string;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    hydrate?(): Promise<void>;
}
```

Where stored values go. Synchronous, like `localStorage`, so systems can read every frame.
Each method may throw: the storage functions catch it, keep the value in memory and report it.

Members:

- `name`: Shown in `StorageStatus.backend`, such as `"localStorage"` or `"memory"`.
- `hydrate`: For a backend whose real store is asynchronous, such as a host app's bridge in a webview: loads it into memory before the first run. The plugin awaits it in `PreInit`, so systems read hydrated values; `getItem` and `setItem` then work on that copy, and the backend writes it through on its own. If it rejects, the game carries on with memory only.

### StorageCtx

```ts
type StorageCtx = {
    readonly resources: Resources;
    readonly logger: ILogger;
};
```

What the storage functions need: a `SystemCtx`, or the `Game` or `TestGame` itself.

### StorageKey

```ts
interface StorageKey<T> {
    readonly name: string;
    readonly default: T;
    readonly version: number;
    readonly parse: (value: unknown) => T | undefined;
    readonly migrate?: (value: unknown, from: number) => unknown;
    readonly writeMigrated?: boolean;
}
```

A typed storage key, made by `defineStorageKey`. Plain data apart from `parse` and `migrate`.

Members:

- `name`: Namespaced, such as `myGame.muted`. Also the key in the backend, after the plugin's `prefix`.
- `version`: The format version written with each value.
- `parse`: Turns a stored JSON value into `T`, or returns `undefined` (or throws) if it is not one.
- `migrate`: Turns a value written by an older `version` into this version's shape, before `parse`.
- `writeMigrated`: False when a migrated value is written only by the next `setStored` or `updateStored`. Absent means true.

### StorageKeyFamily

```ts
interface StorageKeyFamily<T> {
    (suffix: string): StorageKey<T>;
    readonly prefix: string;
}
```

Keys that share options and differ by a suffix, made by `defineStorageKeyFamily`.

Members:

- `prefix`: Put before each suffix, such as `myGame.best.`.

### StorageKeyOptions

```ts
interface StorageKeyOptions<T> {
    default: T;
    parse?: (value: unknown) => NoInfer<T> | undefined;
    version?: number;
    migrate?: (value: unknown, from: number) => unknown;
    writeMigrated?: boolean;
}
```

What `defineStorageKey` and `defineStorageKeyFamily` take: the default value, and how to parse and migrate stored data.

Members:

- `default`: What a read returns when nothing valid is stored. Objects are copied, so mutating one is safe.
- `parse`: Checks a stored value and returns it as `T`, or `undefined` (or throws) if it is invalid. Defaults to a check that the value has the default's `typeof` (and is an array when the default is), which is enough for primitives. Pass one for objects.
- `version`: A whole number, 1 or more. Defaults to 1. Raise it when the shape changes, with `migrate`.
- `migrate`: Upgrades a value written by an older version: `from` is its version, or 0 for a value not written by Fenrir (a game's own `localStorage.setItem` from before), as JSON if it parses and as the raw string if not. Its result goes through `parse`; throwing means "use the default".
- `writeMigrated`: Whether a migrated value is written back as soon as it is read. Defaults to true: the first read stores it in this version's envelope, so later reads do not migrate again.

### StorageOptions

```ts
interface StorageOptions {
    backend?: StorageBackend;
    prefix?: string;
}
```

What the `storage()` plugin takes: the backend (default `localStorage`, falling back to memory) and a key prefix.

Members:

- `backend`: Defaults to `localStorage`, or to memory when it is unavailable (private mode, blocked in a webview).
- `prefix`: Put before every key name in the backend, such as a player or save slot: `"slot2:"`. Defaults to none.

### SyncStage

```ts
type SyncStage = Exclude<ScheduleStage, AsyncStage>;
```

The per-frame stages. Their systems must be synchronous: a returned promise is not awaited.

### SyncSystemFn

```ts
type SyncSystemFn = (ctx: SystemCtx) => void;
```

A system for a per-frame stage.

### SystemCtx

```ts
interface SystemCtx extends GameServices {
    time: Time;
    events: EventBus;
    logger: ILogger;
    scenes: SceneManager;
    readonly scene: Scene;
    readonly entities: EntityList;
    readonly signal: AbortSignal;
    onCleanup(cleanup: () => void | Promise<void>): void;
    stop(): void;
}
```

What every system receives. An interface so that entry points can add fields:
`fenrir-ts/physics` adds `physics`.

Members:

- `signal`: Aborted when the engine run that owns this context stops or rolls back.
- `onCleanup`: Registers cleanup for this run. Cleanups run in reverse order of registration.

### SystemOptions

```ts
interface SystemOptions {
    name?: string;
    before?: string | readonly string[];
    after?: string | readonly string[];
    runIf?: (ctx: SystemCtx) => boolean;
}
```

How a system is registered. Every field is optional.

Members:

- `name`: The system's name. Defaults to the function's name. Unique within a stage.
- `before`: Run before these systems in the same stage.
- `after`: Run after these systems in the same stage.
- `runIf`: Checked each time the system would run. The system is skipped when it returns false.

### TestClock

```ts
interface TestClock {
    advance(ms: number): void;
}
```

The test game's clock. It moves only when told to.

Members:

- `advance`: Moves `time.now()` forward by `ms` milliseconds without running a frame.

### TestGame

```ts
interface TestGame extends GameBase {
    readonly clock: TestClock;
    start(): Promise<void>;
    readonly input: TestInput;
}
```

A game with no renderer, no canvas and no frame loop, built by `createTestGame`. Frames run
only when `step(dt)` is called, on a clock that moves only with `step` and `clock.advance`.

It has `start()` where a `Game` has `run()`, because `run()` hands frames to
`requestAnimationFrame` and a test game has none. It has no `pause` or `resume`: it is never
running between steps, so there is nothing to pause.

Members:

- `start`: Runs PreInit, Init and PostInit, as `run()` does on a `Game`, with the same rollback when a startup system throws. Schedules no frame: call `step(dt)`.
- `input`: The same `Input` that systems read as `ctx.input`, plus `press`, `release`, `pointerDown`, `pointerMove`, `pointerUp`, `pointerCancel`, `focus` and `blur`, which stand in for the player and take effect on the next `step`.

### TestGameOptions

```ts
interface TestGameOptions {
    seed: number;
    now?: number;
    plugins?: readonly Plugin[];
    logger?: ILogger;
    maxFrameDelta?: number;
}
```

What `createTestGame` takes. `seed` is required; there is no canvas.

Members:

- `seed`: Seeds `game.random` and `ctx.random`: a safe integer. Required, so every run draws the same numbers.
- `now`: Wall-clock epoch milliseconds that `time.now()` starts at. Defaults to 0.
- `plugins`: Installed in order, as in `createGame`. A test game has no canvas, so a plugin that reads `game.canvas`, such as `pixi2d`, throws when it installs.
- `logger`: Defaults to a ConsoleLogger, as in `createGame`.
- `maxFrameDelta`: The frame-delta clamp, as in `createGame`: `step(dt)` throws for a `dt` above it. Defaults to 0.25.

### TestInput

```ts
interface TestInput extends Input {
    press(action: ActionType, event?: InputDomEvent): boolean;
    release(action: ActionType): void;
    pointerDown(x: number, y: number): boolean;
    pointerMove(x: number, y: number): void;
    pointerUp(): void;
    pointerCancel(): void;
    focus(): void;
    blur(): void;
}
```

`game.input` in a test game: `Input`, plus calls that stand in for the player. Each takes
effect when the next frame starts, as a DOM event would. Handlers (`onDown`, `onGesture`) run
at the call, as they would inside the DOM event, while the game runs.

Members:

- `press`: Presses the action's first binding, as if that key or pointer button went down. Calls the `onDown` handlers of every action bound to it, then the `onGesture` handlers, passing `event`. Returns whether a handler claimed the press. A pointer binding also focuses the canvas, as a press on it does.
- `release`: Releases every binding of the action.
- `pointerDown`: Moves the primary pointer to logical `x`, `y` over the canvas and presses it. Calls the handlers and focuses the canvas as `press` does, and returns whether a handler claimed it.
- `pointerMove`: Moves the primary pointer to logical `x`, `y` over the canvas.
- `pointerUp`: Lifts the primary pointer where it is. A gesture: calls the `onGesture` handlers.
- `pointerCancel`: The browser cancels the primary pointer: it goes up, with `pointer.cancelled` in the frame that releases it.
- `focus`: The canvas gains keyboard focus.
- `blur`: The canvas loses keyboard focus, which releases everything held, as in the browser.

### Timer

```ts
interface Timer {
    duration: number;
    elapsed: number;
    remaining: number;
    repeat: number;
    fired: number;
    paused: boolean;
    group: string | null;
    state: {
        name: string;
        value: string;
    } | null;
}
```

One timer, as plain data in an entity's `Timers`. Times are seconds of game time. The motion
system advances it each frame and sends `TimerFired` each time `elapsed` reaches `duration`.
Edit `paused` directly to pause and resume it.

Members:

- `duration`: Seconds from the start of the current period to the next firing.
- `elapsed`: Seconds into the current period.
- `remaining`: `duration - elapsed`, kept up to date by the motion system.
- `repeat`: Firings after the first: 0 fires once, `Infinity` repeats until cancelled.
- `fired`: Times it has fired.
- `group`: Paused with every other timer and tween of its group by `MotionSettings.paused[group]`.
- `state`: While set, the timer exists only while that state has that value; it is removed, unfired, once it has not.

### TimerOptions

```ts
interface TimerOptions {
    duration: number;
    repeat?: number;
    group?: string;
    state?: [
        StateType<string>,
        string
    ];
}
```

What `addTimer` takes: how long, how many repeats, a pause group, and the state it belongs to.

Members:

- `duration`: Seconds until it fires, and between firings.
- `repeat`: Firings after the first. Defaults to 0; `Infinity` repeats until cancelled. Needs a duration above 0.
- `state`: Removes the timer, unfired, once `state` no longer has `value`. Pass the state and its value.

### Tween

```ts
interface Tween {
    component: string;
    from: Record<string, number>;
    to: Record<string, number>;
    duration: number;
    delay: number;
    ease: string;
    repeat: number;
    yoyo: boolean;
    elapsed: number;
    started: boolean;
    paused: boolean;
    group: string | null;
}
```

One tween, as plain data in an entity's `Tweens`: numeric fields of one component on the same
entity, from `from` to `to`. The motion system writes the fields each frame and removes the
tween when it finishes, sending `TweenDone`. Edit `paused` directly to pause and resume it.

Members:

- `component`: The component's name, as given to `defineComponent`, for example `fenrir.Transform2D`.
- `from`: Start values. Fields not given are read from the component when the delay ends.
- `to`: End values, by field.
- `duration`: Seconds per play.
- `delay`: Seconds before the first play starts.
- `ease`: An easing name: a built-in (`EasingName`) or one added with `defineEasing`.
- `repeat`: Plays after the first: 0 plays once, `Infinity` repeats until cancelled.
- `yoyo`: Every second play runs from `to` back to `from`.
- `elapsed`: Seconds since the tween was added, delay included, pauses excluded.
- `started`: True once the delay has ended and `from` holds every field.
- `group`: Paused with every other timer and tween of its group by `MotionSettings.paused[group]`.

### TweenOptions

```ts
interface TweenOptions<T> {
    to: Partial<Record<NumericKeys<T>, number>>;
    from?: Partial<Record<NumericKeys<T>, number>>;
    duration: number;
    delay?: number;
    ease?: EasingName | (string & {});
    repeat?: number;
    yoyo?: boolean;
    name?: string;
    group?: string;
}
```

What `addTween` takes. `to` names the component's number fields to move; the rest is optional.

Members:

- `to`: End values of numeric fields of the component.
- `from`: Start values. Fields left out start from the component's value when the delay ends.
- `duration`: Seconds per play, at least 0.
- `delay`: Seconds before the first play. Defaults to 0.
- `ease`: Defaults to `"linear"`.
- `repeat`: Plays after the first. Defaults to 0; `Infinity` repeats until cancelled.
- `yoyo`: Every second play runs back to the start. Defaults to false.
- `name`: Adding a tween with a running tween's name replaces it. Defaults to the component's name and the fields, such as `fenrir.Transform2D:x,y`, so tweening the same fields again replaces.

### Vec3Like

```ts
type Vec3Like = {
    x: number;
    y: number;
    z: number;
};
```

A 3D vector as the core reads it. Three's `Vector3` satisfies it.

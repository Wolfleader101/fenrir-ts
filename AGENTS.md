# AGENTS.md

Instructions for an agent that changes the engine in this repository.
**Building a game with Fenrir? Read [`skills/fenrir/SKILL.md`](skills/fenrir/SKILL.md) instead**: it ships in the package, and this file does not.
Everything here describes the code as it is. If the code and this file disagree, trust the code and fix this file.

## What Fenrir is

Fenrir TS is a TypeScript game engine built on a sparse-set ECS. It has a PixiJS 2D renderer and a Three.js 3D renderer.
It is being rebuilt as a 2D-first web engine. The plan, its decisions and its milestones are in [issue #12](https://github.com/Wolfleader101/fenrir-ts/issues/12).
The version is 0.x: breaking changes are allowed.

## Commands

Use pnpm 11 or newer. `packageManager` in `package.json` pins the version, and pnpm switches to it on its own.
pnpm settings live in `pnpm-workspace.yaml`, not in `package.json`: the `vite` to `rolldown-vite` override and `allowBuilds`.

```sh
pnpm install --frozen-lockfile
pnpm test:run     # vitest run, all tests once
pnpm type-check   # tsc --noEmit over src and tests
pnpm build:lib    # library build into dist/
pnpm build:demos  # production build of the demo pages into dist-demos/ (and .vercel/output/), never dist/
pnpm dev          # Vite dev server for the demos, http://localhost:5173
pnpm bench        # Vitest benchmarks in tests/bench/, not run by test:run or CI
pnpm docs:agent   # regenerate skills/fenrir/api/ from the TSDoc
```

Run one test file with `pnpm exec vitest run tests/core/Scheduler.test.ts`.
Demo pages are in `demos/`: `demos/<name>.html`, served at `/<name>` (for example `/pixi2d`), their code in `demos/src/`, their models and textures in `demos/public/`. They import the engine only by its package names (`fenrir-ts`, `fenrir-ts/2d`, ...), which `vite.config.ts` and `demos/tsconfig.json` resolve to the entry files in `src/`, so a demo uses only the public API. `pnpm type-check` checks them too.

### What CI runs

Every pull request and every push to `main` runs these, in this order. All of them must pass, and all of them pass on `main`, so a failure is yours.

```sh
pnpm type-check   # no errors allowed
pnpm check:docs   # every ts block in README.md, AGENTS.md and skills/fenrir/ compiles against the entry points
pnpm check:agent-docs    # the generated API reference matches `pnpm docs:agent`
pnpm test:run
pnpm build:lib
pnpm check:size   # each entry in dist/ stays within size-budget.json
pnpm check:imports  # core loads no renderer or physics package; other entries only their own peers
pnpm check:consumer  # bundles the fixture games in scripts/consumer/ the way a consumer would and checks their size
pnpm check:package   # the npm tarball: allowed files only, size budget, manifest rules, publint and attw
pnpm check:install   # installs the tarball with npm and pnpm, with and without pixi.js: no peer warnings, imports, types (bundler, nodenext)
```

If you change a public API, update the examples that show it; `check:docs` fails until they compile. Examples import only `fenrir-ts`, its entry points and peer packages, never `@/` or `src/`. A README or reference fragment that relies on a name from surrounding code gets it from `scripts/docs-ambient.d.ts`; a `skills/fenrir/SKILL.md` block gets nothing and must compile on its own.

If `check:agent-docs` fails, run `pnpm docs:agent` and commit `skills/fenrir/api/`. Never edit the generated files: the API pages come from TSDoc.

If `check:imports` fails, it names the entry, the chunk and the package or file it reached. Move the import into the entry that owns that package; do not add an exception.

If `check:size` fails, find what grew before raising the budget. Raise it with `node scripts/check-size.mjs --update` only when the growth is intended, and say so in the PR.

If `check:package` fails, it names the rule. A file outside its allowed list means `files` in `package.json` or the build put something in the tarball a consumer does not need; widen `ALLOWED` in `scripts/check-package.mjs` only for a file a consumer reads. The package has no runtime `dependencies` (build tools are dev dependencies) and every peer is optional (`peerDependenciesMeta`). Do not add `"sideEffects"`: it was measured to save nothing and broke consumers twice (publint suggests it; that suggestion is expected). The build writes source maps as `"hidden"` for `check:imports` and `check:consumer`; they do not ship. Declarations are post-processed in `vite.config.lib.ts` so every relative import names its `.js` file, which `node16` and `nodenext` consumers need; published sources use relative imports, not `@/`.

If `check:install` fails, it names the package manager, the project and the step. A peer warning or a `/3d` import that succeeds means `peerDependencies` or `peerDependenciesMeta` changed; a `nodenext` type error means a declaration import lost its `.js` (see `addDeclarationExtensions` in `vite.config.lib.ts`). `node scripts/check-install.mjs --keep` leaves the projects to inspect. It needs the network for `pixi.js`.

Releases: [`RELEASING.md`](RELEASING.md). A PR adds its notes under `## Unreleased` in `CHANGELOG.md` and does not change the version; a release PR does.

## Entry points

| Import | Source | Contents | Peer |
| --- | --- | --- | --- |
| `fenrir-ts` | `src/index.ts`, which re-exports `src/core/index.ts` | Core: `createGame`, `Game`, `Plugin`, `createTestGame`, `TestGame`, named systems, engine, scheduler, scenes, ECS, events, resources, time, logging, input actions (`defineAction`, `ctx.input`), timers and tweens (`motion()`, `addTimer`, `addTween`, `Timers`, `Tweens`, `easings`), inspection (`inspect(game)`, `exposeInspector`), `Transform2D`, `Display2D`, `EntityBuilder` with `transform()`, `transform2D()`, `display2D()` and `name()`, the asset cache, asset manifests (`defineAssets`, `loadAssets`, `unloadAssets`, `loadAsset`, `unloadAsset`, `getAsset`, `setAssetLoader`), storage (`storage()`, `defineStorageKey`, `getStored`, `setStored`, `updateStored`, `removeStored`, `memoryStorage`, `StorageStatus`) | none |
| `fenrir-ts/2d` | `src/2d.ts` | The `pixi2d` plugin with named layers, Pixi renderer and its system, `PixiNode`, `Transform2D` and `Display2D` (re-exported from core), `Viewport`, `ViewportResized`, `layoutViewport`, `screenToLogical`, `logicalToScreen`, `Renderable2D`, the 2D builder methods, 2D texture loading (`requestTexture2D`) | `pixi.js` |
| `fenrir-ts/3d` | `src/3d.ts` | Three renderer and its system, camera, skybox, animation, the 3D builder methods, model and texture loading, `bootstrapEngine`, stats, `Transform` typed with Three, the window-level input `bootstrapEngine` registers (`createDomInputSystems`, `createInputStateSystem`, `InputState`, `InputEvent`) | `three` |
| `fenrir-ts/physics` | `src/physics.ts` | Jolt physics system, components, helpers, the physics builder methods, `ctx.physics` | `jolt-physics`, `three` |
| `fenrir-ts/ui` | `src/ui.ts` | UI controls on Pixi nodes the game drew: the `ui()` plugin, `control`, `modalScope`, `UiFocus`, `ControlActivated`, `paginate`, `activateControl`, `listControls`, `moveFocus`, `syncUi` | `pixi.js` |
| `fenrir-ts/audio` | `src/audio.ts` | The `audio()` plugin, `defineSound`, `playSound`, `stopSound`, `unlockAudio`, `AudioState`, `AudioUnlocked`, the `audio` asset kind (`AudioClip`), `webAudio()` and `testAudio()` backends | none |

Consumers import only from these six paths. Never import from `fenrir-ts/dist/...` or a source file path.
Anything not exported from one of the entry files is internal and can change without notice.
There is no `fenrir-ts/core`: core is the root entry.

The core entry imports no Pixi, Three or Jolt code. `pnpm check:imports` checks the built output, and `tests/publicApi.test.ts` fails if core loads any of them.
New core code must keep it that way: put anything that needs a renderer in the entry for that renderer.

Each renderer entry adds to core types when it is imported, and to core classes when it loads:

- `fenrir-ts/2d` adds `pixiNode`, `renderSprite` and the other 2D methods to `EntityBuilder`, and `requestTexture2D`, `loadTexture2D`, `getTexture2D` and the Pixi loader to `AssetStore`.
- `fenrir-ts/3d` adds the 3D builder methods, `loadModel`, `loadTexture`, `getTexture` and the glTF loader to `AssetStore`, and `skybox`, `setSkybox`, `removeSkybox` and `hasSkybox` to `Scene` (`src/core/Skybox/SceneSkybox.ts`), and makes every default `Transform` out of Three `Vector3` and `Quaternion`. `pnpm check:consumer` fails if a 2D bundle ships the skybox members.
- `fenrir-ts/audio` adds the `audio` asset kind to `AssetKinds`, so manifests declare `{ kind: "audio", src }`; the `audio()` plugin registers its loader when it installs. It patches no class.
- `fenrir-ts/ui` patches nothing and adds no types to core: controls are options kept against Pixi nodes.
- `fenrir-ts/physics` adds the physics builder methods and `physics?: PhysicsHelpers` to `SystemCtx`, and also makes default transforms out of Three objects.

So a method from an entry is typed and present only when that entry is imported.
`EntityBuilder`'s `transform()`, `name()`, `transform2D()` and `display2D()` are the class's own methods, so a game that never builds an entity ships no builder.
Core's `Transform` is a plain `{ x, y, z }` / `{ x, y, z, w }` shape. `Transform` from `fenrir-ts/3d` is the same component typed with Three classes; import that one in 3D code.

Inside the repo, `@/` is an alias for `src/`.

## Where the rules for game code live

This file is for changing the engine. Rules for **using** it have one source each, and this file does not repeat them:

| What | Source | Shipped as |
| --- | --- | --- |
| How each service behaves for a game: every rule a consumer relies on, with examples | `skills/fenrir/references/*.md`, one file per service, by hand | itself; `README.md` only links to them |
| The guide for an agent building a game: the model, a minimal game, the rules that prevent the common mistakes, the engine's system names | `skills/fenrir/SKILL.md`, by hand | itself |
| Every export's signature and TSDoc | the TSDoc in `src/` | `skills/fenrir/api/*.md`, generated by `scripts/api-reference.mjs` |

So a change to how a service behaves for a game updates its reference (and, if it changes a rule the guide states, `skills/fenrir/SKILL.md`). A change to a public symbol updates its TSDoc, then `pnpm docs:agent`. `pnpm check:agent-docs` fails until the generated API pages match, and `tests/skillExamples.test.ts` runs every headless example in `SKILL.md` and checks what it logs.

The sections below say where each service's code is, how it works inside, what a change must keep, what it costs and where it is tested. Read its reference for what it does.

## Engine internals

**Game and plugins.** `createGame` in `src/core/Game.ts` builds the services (`createServices`), installs plugins in order (`installPlugins`, awaiting async installs) and returns a `GameImpl`, which wraps an `Engine` (`src/core/Engine.ts`) that keeps the frame loop and lifecycle. `game.isRunning()` is `Engine.isActive()`; `Engine.isRunning()` is false while paused. An install only registers; core never imports a plugin's types. A new service adds a field to `GameServices` in `src/core/SystemCtx.ts`, which puts it on both `game` and `ctx`, and builds it in `createServices`.

**Schedule and systems.** `Schedule` is in `src/core/Schedule.ts` (re-exported from `src/core/Scheduler.ts`, so entries that only register systems do not bundle the scheduler). `Engine.run()` resolves every stage's order, awaits the startup stages through `Scheduler.runAsyncStage`, then runs frames on `requestAnimationFrame` through `Engine.frame`: input latch, `PreUpdate`, `Tick` from the accumulator (at most 8), `Update`, `PostUpdate`, event buffers advance. `Exit` runs in its own loop in `Engine`, then cleanups in reverse. `scheduler.describe()` prints the schedule. `SystemCtx` is in `src/core/SystemCtx.ts`. `Scheduler.ts` and `Engine.ts` use `any` in overload implementations.

**Components and views.** `defineComponent` is `Symbol.for` on the name. `entities.each(QUERY, fn)` caches a `View` (`src/core/ECS/View.ts`) by the query array's identity, which is why every example keeps query tuples at module level.

**Events.** `src/core/EventBus.ts` and `src/core/EventQueue.ts`. Each queue keeps the current and previous frame; `advance` runs at the end of a frame. Listener arrays are copy-on-write, so `send` iterates without copying and a listener added during delivery does not get the event being delivered. Run-scoped listeners (`ctx.events.on`) are removed after `Exit` systems and cleanups. Nesting is capped at 32.

**Resources.** `src/core/Resource.ts`. Values live in one `Resources` per game; engine code reads them with the internal `peekResource`, never `get`, so it does not run a factory. `Engine.reset()` clears them. An `Engine` built without `services` makes its own `Resources`. `Game` has no `reset` yet.

**Time and random.** `Time` (`src/core/Time.ts`) reads only its `Clock` (`src/core/Clock.ts`): `monotonic()` for deltas and `elapsed`, `now()` for wall time. The default `realClock` is the only core code that reads `performance.now()` or `Date.now()`. `ManualClock` is internal; tests use it through `createManualTime()` in `tests/utils/testHelpers.ts`. `Random` (`src/core/Random.ts`) is mulberry32.

**States.** `src/core/State.ts`. Queued changes are applied by `beforeStage` and `afterSystem`, called from `Scheduler.runSyncStage`, `Scheduler.runAsyncStage` and the `Exit` loop in `Engine`.

**Test games.** `src/core/TestGame.ts` builds a `TestGame` on the same `GameImpl` as `createGame`, with a `ManualClock`. `step` runs `Engine.frame` and passes `dt` to `Time.update` instead of a clock difference, so ticks accumulate exactly; a `dt` over `maxFrameDelta` throws. `Game.step` runs only while paused.

**Inspection.** `src/core/Inspect.ts`, values encoded by `toJson` in `src/core/Json.ts`. It is a function, not a method on `Game`, so a game that never calls it ships no snapshot or `toJson` code. Do not add inspection back to `createGame` or `GameImpl`: `check:consumer` fails if a fixture other than `game-2d-inspector` ships it.

**Input.** `src/core/Input/`: `Action.ts` (`defineAction`, binding validation), `Input.ts` (`InputImpl`, `TestInput`), `InputListeners.ts` (canvas listeners, attached when a run starts with `ctx.signal`). `Engine.frame` calls `InputImpl.latch` before `PreUpdate`. `setDown` keeps a raw log between frames, which `edges` reads; `renewed` in `latch` is what lets a consumed binding's next press be seen even within one frame. The engine sets `tabindex="0"` on a canvas without one. The listeners read pointer buttons from `event.buttons`. `inspect()` reads the latched frame (`held_`, `pointer`, `focused`) in `inputSnapshot` in `src/core/Inspect.ts`.

**Timers and tweens.** `src/core/Motion/Motion.ts`, easings in `Easing.ts`. Entries are plain data in the `fenrir.Timers` and `fenrir.Tweens` components, with no closures: an easing is a name and a tween names its component by its `defineComponent` name, so `inspect()` shows them. `fenrir.motion.preUpdate` is registered at install, so it runs before the game's `PreUpdate` systems. Cost: none of this is reachable from code that does not import it; `game-2d` and `core-only` ship no motion code (`check:consumer` fails if they do), and `scripts/consumer/game-2d-motion.js` measures a game that uses it. Do not move it into `createServices` or the engine, and do not add a builder method for it: builder extensions run at import and every game would pay. Do not move the motion system or add a stage for pause ordering: a pause that must hold the deciding frame runs `{ before: "fenrir.motion.preUpdate" }`. Tests: `tests/core/Motion/Motion.test.ts`, all with `createTestGame` and `step`.

**Assets.** `src/core/Assets/Manifest.ts`, per-store state in `ManifestStore.ts` (a `WeakMap` keyed by the store: entries shared by every manifest, and per manifest a `ManifestRuntime` with its bundles and its `direct` holds). A bundle and a `loadAsset` name both go through `hold()`: an entry's `users` are `manifest/bundle` and `manifest#asset`, and an entry is released when it has none. Each asset is stored under its name with `setAsset`, so the 2D getters read it. Progress is rewritten in place by `refresh` each time an entry settles. An `optional` asset that fails resolves its entry promise with `undefined` and status `missing`. `peekLoadedAsset` lets `fenrir-ts/audio` read a loaded sample without bundling the manifest code. The 2D loader's `unload` is Pixi's `Assets.unload`. Cost: `check:consumer` fails if `game-2d` or `core-only` ship `fenrir.assets.*` or `defineAssets`; `scripts/consumer/game-2d-assets.js` measures a game that uses it. Tests: `tests/core/Assets/Manifest.test.ts` (headless, `setAssetLoader` with deferred promises), `tests/core/Renderer2D/pixi2dAssets.test.ts` (`createGame` + `pixi2d`, Pixi's `Assets` stubbed), `tests/types/assetManifest.test.ts` (types).

**Audio.** `fenrir-ts/audio` (`src/audio.ts`; code in `src/core/Audio/`: `Audio.ts`, the Web Audio backend in `WebAudio.ts`, the test backend in `TestAudio.ts`) is an entry of its own because it adds the `audio` asset kind, and core's `AssetKinds` stays empty. `fenrir.audio.init` listens for `visibilitychange` with `ctx.signal`; its `onCleanup` stops voices, clears the queue and suspends, and the context is never closed. Samples are read with `peekLoadedAsset`. Cost: `check:consumer` fails if a fixture other than `game-2d-audio` contains `fenrir.audio` or `fenrir.AudioState`. Tests: `tests/core/Audio/Audio.test.ts` (`createTestGame` with `testAudio`), `tests/core/Audio/WebAudio.test.ts` (a fake `AudioContext`), `tests/publicApi.audio.test.ts`, `tests/types/assetKinds.audio.test.ts`, `tests/readmeAudioExample.test.ts`.

**Storage.** `src/core/Storage/Storage.ts` (core). Keys are frozen; a family memoises keys per suffix in a `Map`. Values are cached per key after the first read and on every write. `localStorage` is probed at install with a write and a remove. `fenrir.storage.preInit` is registered only for a backend with `hydrate`; `fenrir.storage.postUpdate` and `fenrir.storage.exit` only once `persistResource` is called. Cost: `check:consumer` fails if a fixture other than `game-2d-storage` ships `fenrir.storage` or `fenrir.StorageStatus`. Tests: `tests/core/Storage/Storage.test.ts` (`createTestGame` with `memoryStorage`, jsdom `localStorage` with `Storage.prototype.setItem` stubbed to throw), the storage case in `tests/publicApi.test.ts`.

**Viewport.** `src/core/Renderer2D/`: the layout maths (`layoutViewport`) and the `Viewport` resource in `Viewport.ts`, which imports no Pixi so core's input can use it, and the listeners in `ViewportSystem.ts`, attached in `fenrir.viewport.init` with `ctx.signal`, with the inset probe removed by `ctx.onCleanup`. A resize marks the layout dirty and `fenrir.viewport.preUpdate` applies it; while paused, one `requestAnimationFrame` applies it and renders once. Tests stub window size, `devicePixelRatio`, `visualViewport`, `matchMedia` and `getComputedStyle`: `tests/core/Renderer2D/pixi2dViewport.test.ts`; the layout table is in `tests/core/Renderer2D/Viewport.test.ts`.

**Scene (2D).** `Transform2D` (`src/core/ECS/Transform2D.ts`) and `Display2D` (`src/core/ECS/Display2D.ts`) are core data. `PixiNode` is `src/core/Renderer2D/PixiNode.ts`. The node code is in `PixiRenderer` (`attachNode`, `detachNode`, `releaseNodes`, `syncTransforms`, `render`), driven by the component signals in `PixiRendererSystem.ts`. Every render syncs (there is no change tracking: Pixi's setters skip unchanged values), so a render from `PostInit` or the paused-resize render is never stale. The renderer is the one handle to Pixi objects; the `Viewport` resource stays plain data core can read. Tests: game logic needs no renderer (`createTestGame` and `inspect()`); node sync uses `createPixiRendererSystem({ application })` with an `Application` whose `renderer` is a stub and `createMockSystemCtx()`, calling `init`, `postUpdate` and `exit` directly: `tests/core/Renderer2D/PixiNode.test.ts`.

**UI controls.** `fenrir-ts/ui` (`src/ui.ts`; code in `src/core/UI/`: `Ui.ts`, and the accessibility seam `Access.ts`). It uses the engine's input only: not Pixi's federated events, `eventMode` or Pixi's accessibility, and adds no DOM elements. `pixi2d` keeps no seam for it, so 2D games without the kit pay nothing.

- Registry: none. `control(node, options)` and `modalScope(node, options)` put options in module-level `WeakMap`s keyed by the node. Each `fenrir.ui.preUpdate` (and `activateControl`, `listControls`, the Tab handler and every activation) walks `renderer.backdrop` and `renderer.root` (or `root`), skipping subtrees that are not `visible` or `renderable` or are destroyed. Per-run state (live list, scope stamps, the pressed id, run ctx) is cleared in `onCleanup`. Do not add a list of nodes: a game that clears a sheet with `removeChildren()` and drops the nodes must leave nothing behind.
- The pass: `fenrir.ui.preUpdate` reads `input.edges([pointer, ...kit keys, ...actions])` once and handles presses in arrival order. Edges of one key press are adjacent, kit first; once the kit acts or `onAction` returns `true`, the rest of that press's edges are skipped. The kit walks the tree again after each `onAction` and each activation. A frame with no edges and no pointer release pending does not walk. At install, one `input.onDown` handler for the Tab keys and one for every other action the pass reads only sets `waiting`.
- Hit testing: `node.toLocal(pointer, space)` against `hitArea` or `node.getLocalBounds()`, where `space` is `renderer.root` or `root`. Works headless. The topmost live control wins.
- Rules a change must keep: press and release over the same id activates, in the frame that reports the release; a cancelled pointer never activates; a press on a control, or any press while a modal scope is live, is consumed with `consumePointer()`. Disabled controls take focus and taps and never activate. A later live duplicate id is ignored with one warning per id. Tab claims its `keydown` (via `onDown`) only while a control is next in that direction, counting the Tabs still waiting in `tabs`, or while another press the pass reads is `waiting` (reset at the start of each `fenrir.ui.preUpdate`); each `keydown` records its direction (`shiftKey`) for the frame. Arrows act only while a control is focused or a scope is open; Enter and Space only while a control is focused, and are left unconsumed on a `passThrough` control; Escape only while a scope is open; each is consumed when it acts. Scope order is the frame a scope first became live (`stamps`), not the order of `modalScope` calls. Focus belongs to the innermost scope node of the control it was found on (`owner` in `refresh`): the same id under another scope node clears it, unless the id changed since the last walk. When the top scope changes, its `focus` option, if live, takes focus. `arrows: "linear"` stops at the ends (`STOP`); `arrows: "clear"` leaves past them (`LEAVE`, as Tab). `refresh()` clears `UiFocus.id` when its control is not in `order`, so every walk leaves no focus on a blocked control. `moveFocus(ctx, delta, wrap)` uses the same `move`.
- Output: `sync` (`fenrir.ui.postInit`, `fenrir.ui.postUpdate` before `fenrir.pixi.postUpdate`, `syncUi(ctx)`) walks the tree, clears a focus that is not live, then writes the ring, cursor and aria attributes. `describeUi` in `Access.ts` is a pure function of the focusable controls, the focused one and the label; keep accessibility output behind it, so a future DOM mirror reads the same inputs.
- `inspect()` shows `fenrir.UiControls` through `toJSON` on the internal resource.
- Cost: `check:consumer` fails if a fixture other than `game-2d-ui` ships `fenrir.ui`, `fenrir.UiFocus` or `fenrir.UiControls`.
- Tests: `tests/core/UI/Ui.test.ts` (`createTestGame` with `ui({ root })` and `TestInput`), `tests/core/UI/uiPixi.test.ts` (`createGame` + `pixi2d({ design })` with real canvas listeners, a stubbed window and a letterboxed viewport), `tests/publicApi.ui.test.ts`; `tests/bench/Ui.bench.ts` times frames on a 3000-node tree.

## Naming rule

Component, event, resource and state identity is the name, through `Symbol.for`, so every name is namespaced and `fenrir.` is reserved for the engine (the guide says so for games). Every system the engine registers is named `fenrir.<module>.<stage>`, where `<stage>` is the `Schedule` value it runs in; the guide's table of engine systems lists the 2D path's, and `references/core.md` "Named systems" says how to order against them. Engine factories name their systems with `nameEngineSystems(module, { init, update, ... })` from `src/core/SystemName.ts`, which is internal; a new engine factory uses it, and a new engine system is added to the table in `skills/fenrir/SKILL.md`. Plugin names follow the rule too: `fenrir.pixi2d`.

## Frozen areas

These are kept working and tested, but get no new features. Fix bugs in them; do not extend them.

- 3D renderer: `src/core/Renderer/`
- Camera: `src/core/Camera/`
- Skybox: `src/core/Skybox/`
- Animation: `src/core/Animation/`
- Physics (Jolt): `src/core/Physics/`
- 3D setup and stats: `src/core/Bootstrap.ts`, `src/core/Util/Stats.ts`
- Window-level input for 3D: `src/core/InputSystem/`, exported from `fenrir-ts/3d`

New work goes into the 2D path: `src/core/Renderer2D/`, `src/core/Input/`, `src/core/Motion/`, `src/core/Audio/`, `src/core/Storage/`, `src/core/UI/`, ECS, scheduling and events.

## Changing the engine

- Tests live in `tests/`, mirroring `src/`: `src/core/ECS/View.ts` is tested in `tests/core/ECS/View.test.ts`. Vitest runs in jsdom with globals on. Shared helpers are in `tests/utils/testHelpers.ts`.
- Every behaviour change needs a test that fails without it.
- Test engine behaviour that spans frames with `createTestGame` and `game.step(dt)`, not by stubbing `requestAnimationFrame` and calling the captured callback. Stub the loop only in tests about the browser loop itself (`run()`, `pause()`, `resume()`, the rAF callback).
- Never assert on how long something took. Tests must pass on a slow or busy machine: stub `performance.now` with `vi.spyOn` or use `vi.useFakeTimers()`, and check the property that keeps code fast (call counts, a cached instance, work per matching entity) instead of elapsed time. Speed goes in a benchmark: `tests/bench/*.bench.ts`, run with `pnpm bench`, which nothing asserts on.
- `tests/publicApi.test.ts` exercises the core entry point the way a consumer does, and `tests/publicApi.2d.test.ts`, `publicApi.3d.test.ts` and `publicApi.physics.test.ts` do the same for the other entries. Extend the one for the entry whose public API you change.
- A change to public API updates its reference in `skills/fenrir/references/` (and its TSDoc, and `skills/fenrir/SKILL.md` if the guide states the rule) in the same change, then `pnpm docs:agent`.
- Breaking changes are allowed at 0.x, but call each one out in the PR description.
- No engine behaviour changes in a docs-only PR.

TypeScript conventions are in [`.kilocode/rules/typescript.md`](.kilocode/rules/typescript.md). The code does not follow all of them yet. Match the surrounding code where they disagree, and do not reformat code just to comply:

- Files use PascalCase names (`EntityList.ts`), not the camelCase the rules ask for.
- `any` appears in overload implementations, for example in `Scheduler.ts` and `Engine.ts`.
- Some files use inline `import { type X }` and `&` intersections, which the rules discourage.
- The rule about generated API request and response types does not apply; this repo generates no API types (only docs, from TSDoc).

## Not built yet

These are planned in [#12](https://github.com/Wolfleader101/fenrir-ts/issues/12) and do not exist. Do not use them, and do not document them as if they did:

- UI beyond controls: layout, grids, scrolling, styled widgets, text input, drag and drop, gamepad navigation, and a DOM mirror of the controls for assistive technology (`fenrir-ts/ui` has controls, modal scopes and canvas `aria-*` output only: see above)
- Music streaming and the rest of [#39](https://github.com/Wolfleader101/fenrir-ts/issues/39) (audio, storage and UI controls exist: see above)

`createGame` is the way to start a 2D game. `Engine`, `Scheduler`, `EventBus` and `SceneManager` stay exported for 3D games until they go internal.

# AGENTS.md

Instructions for an agent that works in this repository or uses the `fenrir-ts` package.
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
pnpm build:demos  # production build of the demo pages
pnpm dev          # Vite dev server for the demos, http://localhost:5173
pnpm bench        # Vitest benchmarks in tests/bench/, not run by test:run or CI
```

Run one test file with `pnpm exec vitest run tests/core/Scheduler.test.ts`.
Demo pages are the `*.html` files at the repo root, for example `/pixi2d.html`. Their code is in `src/demos/`.

### What CI runs

Every pull request and every push to `main` runs these, in this order. All of them must pass, and all of them pass on `main`, so a failure is yours.

```sh
pnpm type-check   # no errors allowed
pnpm check:docs   # every ts block in README.md and AGENTS.md compiles against src/
pnpm check:editor-types  # src/editor/resources/fenrir.d.ts matches `pnpm types:bundle`
pnpm test:run
pnpm build:lib
pnpm check:size   # each entry in dist/ stays within size-budget.json
pnpm check:imports  # core loads no renderer, physics or editor package; other entries only their own peers
pnpm check:consumer  # bundles the fixture games in scripts/consumer/ the way a consumer would and checks their size
```

If you change a public API, update the examples that show it; `check:docs` fails until they compile. A README fragment that relies on a name from surrounding code gets it from `scripts/docs-ambient.d.ts`.

If `check:editor-types` fails, run `pnpm types:bundle` and commit `src/editor/resources/fenrir.d.ts`. It is the API the Monaco sandbox shows, bundled from `src/editor/resources/fenrir-api.ts`.

If `check:imports` fails, it names the entry, the chunk and the package or file it reached. Move the import into the entry that owns that package; do not add an exception.

If `check:size` fails, find what grew before raising the budget. Raise it with `node scripts/check-size.mjs --update` only when the growth is intended, and say so in the PR.

## Entry points

| Import | Source | Contents | Peer |
| --- | --- | --- | --- |
| `fenrir-ts` | `src/index.ts`, which re-exports `src/core/index.ts` | Core: `createGame`, `Game`, `Plugin`, named systems, engine, scheduler, scenes, ECS, events, time, logging, input, `EntityBuilder` with `transform()` and `name()`, the asset cache | none |
| `fenrir-ts/2d` | `src/2d.ts` | The `pixi2d` plugin, Pixi renderer and its system, `Renderable2D`, the 2D builder methods, 2D texture loading (`requestTexture2D`) | `pixi.js` |
| `fenrir-ts/3d` | `src/3d.ts` | Three renderer and its system, camera, skybox, animation, the 3D builder methods, model and texture loading, `bootstrapEngine`, stats, `Transform` typed with Three | `three` |
| `fenrir-ts/physics` | `src/physics.ts` | Jolt physics system, components, helpers, the physics builder methods, `ctx.physics` | `jolt-physics`, `three` |
| `fenrir-ts/editor` | `src/editor/index.ts` | Monaco live code editor | `monaco-editor` |

Consumers import only from these five paths. Never import from `fenrir-ts/dist/...` or a source file path.
Anything not exported from one of the entry files is internal and can change without notice.
There is no `fenrir-ts/core`: core is the root entry.

The core entry imports no Pixi, Three, Jolt, Monaco or Lit code. `pnpm check:imports` checks the built output, and `tests/publicApi.test.ts` fails if core loads any of them.
New core code must keep it that way: put anything that needs a renderer in the entry for that renderer.

Each renderer entry adds to core types when it is imported, and to core classes when it loads:

- `fenrir-ts/2d` adds `renderSprite` and the other 2D methods to `EntityBuilder`, and `requestTexture2D`, `loadTexture2D`, `getTexture2D` and the Pixi loader to `AssetStore`.
- `fenrir-ts/3d` adds the 3D builder methods and `loadModel`, `loadTexture`, `getTexture` and the glTF loader to `AssetStore`, and makes every default `Transform` out of Three `Vector3` and `Quaternion`.
- `fenrir-ts/physics` adds the physics builder methods and `physics?: PhysicsHelpers` to `SystemCtx`, and also makes default transforms out of Three objects.

So a method from an entry is typed and present only when that entry is imported.
Core's `Transform` is a plain `{ x, y, z }` / `{ x, y, z, w }` shape. `Transform` from `fenrir-ts/3d` is the same component typed with Three classes; import that one in 3D code.

Inside the repo, `@/` is an alias for `src/`.

## Core model

**Game.** `createGame({ canvas, plugins, logger })` in `src/core/Game.ts` builds the scheduler, scene manager, event bus, logger and asset store, installs each plugin in order (awaiting an async `install`), and returns a `Game`. `Game` wraps an `Engine`, which keeps the frame loop and lifecycle. `game.run()`, `stop()`, `pause()` and `resume()` delegate to it.

**Plugins.** A plugin is `{ name, install(game) }`, as `pixi2d()` from `fenrir-ts/2d` is. `install` reads `game.canvas`, `game.logger`, `game.assets` and `game.events` and adds systems. It registers only: resources are acquired in an `Init` system and released with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back. If an install throws, `createGame` rejects and nothing has run. Core never imports a plugin's types.

**Schedule.** `Schedule` in `src/core/Schedule.ts` (re-exported from `src/core/Scheduler.ts`) names the stages. `game.run()` (`Engine.run()`) resolves the order of every stage, awaits `PreInit`, `Init` and `PostInit` in order, then runs frames on `requestAnimationFrame`. If a startup system throws, `Exit` systems and cleanups run and `run()` rejects with the error.
Each frame runs `PreUpdate`, then `Tick` zero or more times at the fixed `time.fixedDelta`, then `Update` and `PostUpdate`, then advances the event buffers. `Engine.stop()` awaits `Exit`.
`PreInit`, `Init`, `PostInit` and `Exit` may be async and are awaited. `PreUpdate`, `Tick`, `Update` and `PostUpdate` are sync: an async function there type-checks but is not awaited.

**Systems.** A system is a function `(ctx: SystemCtx) => void`, registered with `game.addSystem(stage, fn, options?)`. `options` is `{ name, before, after, runIf }`.
A system's name is its function name unless `name` is passed; an anonymous function with no `name` throws, and so does a second system with the same name in one stage.
Systems in a stage run in registration order unless `before` or `after` (names in the same stage) say otherwise. An unknown name or a cycle makes `run()` reject, naming both systems. `runIf(ctx)` is checked each time the system would run.
`game.replaceSystem(name, fn)` swaps the function and keeps position and options; `game.removeSystem(name)` removes it. Both act on the name in every stage that has it. While running, changes are checked at the call and take effect from the next frame. `scheduler.describe()` prints the schedule with names.
`SystemCtx` (`src/core/SystemCtx.ts`) gives `time`, `random`, `events`, `logger`, `scenes`, `scene`, `entities` and `stop()`.
It also always has `signal`, an `AbortSignal` that aborts when the run stops, and `onCleanup(fn)`, which registers teardown for this run. Cleanups run in reverse order after the `Exit` systems.

**Components.** `defineComponent<T>(name)` returns a typed key. Set data with `entities.set(entity, Type, value)` and read it with `get`, `tryGet` and `has`.
Query with `entities.each(QUERY, (entity, ...components) => {})`. Views are cached by the query array's identity, so keep each query tuple in a module-level constant. An inline `[A, B] as const` creates a new array, and a new view, every call.

**Events.** `defineEvent<T>(name)` returns a typed key. `events.send(Type, payload)` queues an event. The bus keeps two frames of events: the frame an event is sent in and the next one. `game.events` is the same bus as `ctx.events`.
`events.createReader(Type)` returns a reader whose `read()` returns only events it has not returned before. Create one reader per consumer, once, not inside a system. `events.read(Type)` returns everything retained, so it can return the same event in two frames.

```ts
import { Schedule, createGame, defineComponent, defineEvent } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";

type Health = { current: number; max: number };
const Health = defineComponent<Health>("myGame.Health");
const Damaged = defineEvent<{ amount: number }>("myGame.damaged");

// Keep the query tuple in a constant: views are cached by array identity.
const HEALTH_QUERY = [Health] as const;

// A 2D game also passes plugins: [pixi2d()] from fenrir-ts/2d.
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas });

// Create each reader once. It returns only events it has not returned before.
const damaged = game.events.createReader(Damaged);

function spawnPlayer({ entities, events, onCleanup }: SystemCtx): void {
  const player = entities.createEntity();
  entities.set(player, Health, { current: 10, max: 10 });
  events.send(Damaged, { amount: 3 });

  const timer = setInterval(() => events.send(Damaged, { amount: 1 }), 1000);
  onCleanup(() => clearInterval(timer));
}

function listenForKeys({ events, signal }: SystemCtx): void {
  // The listener is removed when the run stops, because `signal` aborts.
  window.addEventListener("keydown", () => events.send(Damaged, { amount: 1 }), { signal });
}

function applyDamage({ entities }: SystemCtx): void {
  for (const { amount } of damaged.read()) {
    entities.each(HEALTH_QUERY, (_entity, health) => {
      health.current = Math.max(0, health.current - amount);
    });
  }
}

game
  .addSystem(Schedule.Init, spawnPlayer)
  .addSystem(Schedule.Init, listenForKeys, { after: "spawnPlayer" })
  .addSystem(Schedule.Update, applyDamage);
await game.run();
```

This example runs in `tests/agentsExample.test.ts`. Change both together.
A 2D game passes `pixi2d()` from `fenrir-ts/2d` in `plugins`. `pixi2d({ application })` adopts a Pixi application the app owns, and `plugin.renderer` is the `PixiRenderer` for code that draws with Pixi directly. Until input actions (#36) land, a 2D game registers `createDomInputSystems` and `createInputStateSystem` from `fenrir-ts` itself: `src/demos/shared/setup2D.ts` shows how.
The 3D renderer has no plugin: a 3D game builds an `Engine` and calls `bootstrapEngine(engine, logger, { canvas })` from `fenrir-ts/3d`, which registers input, the Three renderer, camera and skybox; pass `physics: createPhysicsSystem()` from `fenrir-ts/physics` for physics. See `src/core/Bootstrap.ts`.

**Time and random.** Gameplay code reads `ctx.time` and `ctx.random`, never `Date.now()`, `performance.now()` or `Math.random()`, so frames are deterministic under test.
`time.delta` is seconds since the last frame, clamped to `maxFrameDelta`. `time.fixedDelta` is seconds per `Tick`, settable, default 1/60. `time.elapsed` is seconds since `run()`, excluding pauses. `time.now()` is wall-clock epoch milliseconds. `time.accumulator` is the unconsumed frame time, below `fixedDelta` after each frame.
`Time` (`src/core/Time.ts`) reads only its `Clock` (`src/core/Clock.ts`): `monotonic()` for deltas and `elapsed`, `now()` for wall time. `Engine` takes `clock`; the default `realClock` is the only core code that reads `performance.now()` or `Date.now()`. `ManualClock` is internal: tests use it through `createManualTime()` in `tests/utils/testHelpers.ts`.
`ctx.random` and `game.random` are one `Random` (`src/core/Random.ts`, mulberry32): `next()` in [0, 1), `int(min, max)` inclusive and unbiased, `pick(items)`, which throws on an empty list, and `seed`. `createGame({ seed })` seeds it; without a seed it is seeded from the clock. A stopped game that runs again continues the sequence.

```ts
import { Schedule, createGame } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, seed: 7 });

function rollLoot({ random, time, logger }: SystemCtx): void {
  const gold = random.int(1, 6) * 10;
  const item = random.pick(["sword", "shield", "potion"] as const);
  logger.info(`loot at ${time.now()}: ${gold} gold and a ${item}`);
}

game.addSystem(Schedule.Init, rollLoot);
```

## Naming rule

Component and event identity is the name, through `Symbol.for`. Two `defineComponent` or `defineEvent` calls with the same name return the same key and share storage.
So prefix every name with a namespace for your game or library, such as `myGame.Health`. Names starting with `fenrir.` are reserved for the engine. Engine code uses them, for example `fenrir.Transform` and `fenrir.input.keyDown`.

System names follow the same rule. Every system the engine registers is named `fenrir.<module>.<stage>`, where `<stage>` is the `Schedule` value it runs in: `fenrir.pixi.init`, `fenrir.pixi.update` (syncs transforms), `fenrir.pixi.postUpdate` (renders), `fenrir.pixi.exit`, `fenrir.input.dom.init`, `fenrir.input.state.preUpdate`, `fenrir.input.pointer.init`, `fenrir.three.*`, `fenrir.camera.*`, `fenrir.skybox.*`, `fenrir.animation.*`, `fenrir.stats.postUpdate`, `fenrir.physics.*` and `fenrir.editor.*` (the editor's user script).
Engine factories name their systems with `nameEngineSystems(module, { init, update, ... })` from `src/core/SystemName.ts`, which is internal. A new engine factory uses it; a game or third-party plugin passes `{ name }` with its own namespace, such as `myGame.audio.update`. Plugin names follow the rule too: `fenrir.pixi2d`.

## Frozen areas

These are kept working and tested, but get no new features. Fix bugs in them; do not extend them.

- 3D renderer: `src/core/Renderer/`
- Camera: `src/core/Camera/`
- Skybox: `src/core/Skybox/`
- Animation: `src/core/Animation/`
- Physics (Jolt): `src/core/Physics/`
- 3D setup and stats: `src/core/Bootstrap.ts`, `src/core/Util/Stats.ts`
- Editor (Monaco): `src/editor/`

New work goes into the 2D path: `src/core/Renderer2D/`, input, ECS, scheduling and events.

## Changing the engine

- Tests live in `tests/`, mirroring `src/`: `src/core/ECS/View.ts` is tested in `tests/core/ECS/View.test.ts`. Vitest runs in jsdom with globals on. Shared helpers are in `tests/utils/testHelpers.ts`.
- Every behaviour change needs a test that fails without it.
- Never assert on how long something took. Tests must pass on a slow or busy machine: stub `performance.now` with `vi.spyOn` or use `vi.useFakeTimers()`, and check the property that keeps code fast (call counts, a cached instance, work per matching entity) instead of elapsed time. Speed goes in a benchmark: `tests/bench/*.bench.ts`, run with `pnpm bench`, which nothing asserts on.
- `tests/publicApi.test.ts` exercises the core entry point the way a consumer does, and `tests/publicApi.2d.test.ts`, `publicApi.3d.test.ts` and `publicApi.physics.test.ts` do the same for the other entries. Extend the one for the entry whose public API you change.
- A change to public API updates `README.md` in the same change.
- Breaking changes are allowed at 0.x, but call each one out in the PR description.
- No engine behaviour changes in a docs-only PR.

TypeScript conventions are in [`.kilocode/rules/typescript.md`](.kilocode/rules/typescript.md). The code does not follow all of them yet. Match the surrounding code where they disagree, and do not reformat code just to comply:

- Files use PascalCase names (`EntityList.ts`), not the camelCase the rules ask for.
- `any` appears in overload implementations, for example in `Scheduler.ts` and `Engine.ts`.
- Some files use inline `import { type X }` and `&` intersections, which the rules discourage.
- The rule about generated API request and response types does not apply; this repo has no code generation.

## Not built yet

These are planned in [#12](https://github.com/Wolfleader101/fenrir-ts/issues/12) and do not exist. Do not use them, and do not document them as if they did:

- The `fenrir-ts/ui` entry point
- `createTestGame` and a headless `step`
- Resources (`defineResource`, `game.resources`), states (`defineState`, `inState`, `onEnter`, `onExit`, `game.states`), immediate event listeners (`game.on`)
- `inspect()`, `debug`, viewport scaling (`design`, `safeArea`, `maxResolution` on `pixi2d`), input actions (`game.input`), canvas UI, audio, timers and storage

Each has a marked seam: `GameServices` in `src/core/SystemCtx.ts` for fields on both `game` and `ctx` (`resources`, `states`, `input`), the `services` object and `GameOptions` in `src/core/Game.ts`, the "Seams" comment in the `Game` interface for methods, and `Pixi2DOptions` in `src/core/Renderer2D/pixi2d.ts` for the viewport.

`createGame` is the way to start a 2D game. `Engine`, `Scheduler`, `EventBus` and `SceneManager` stay exported for 3D games and the editor until they go internal.

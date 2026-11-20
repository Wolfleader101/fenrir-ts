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
| `fenrir-ts` | `src/index.ts`, which re-exports `src/core/index.ts` | Core: `createGame`, `Game`, `Plugin`, `createTestGame`, `TestGame`, named systems, engine, scheduler, scenes, ECS, events, resources, time, logging, input actions (`defineAction`, `ctx.input`), timers and tweens (`motion()`, `addTimer`, `addTween`, `Timers`, `Tweens`, `easings`), `inspect()`, `Transform2D`, `Display2D`, `EntityBuilder` with `transform()`, `transform2D()`, `display2D()` and `name()`, the asset cache | none |
| `fenrir-ts/2d` | `src/2d.ts` | The `pixi2d` plugin with named layers, Pixi renderer and its system, `PixiNode`, `Transform2D` and `Display2D` (re-exported from core), `Viewport`, `ViewportResized`, `layoutViewport`, `screenToLogical`, `logicalToScreen`, `Renderable2D`, the 2D builder methods, 2D texture loading (`requestTexture2D`) | `pixi.js` |
| `fenrir-ts/3d` | `src/3d.ts` | Three renderer and its system, camera, skybox, animation, the 3D builder methods, model and texture loading, `bootstrapEngine`, stats, `Transform` typed with Three, the window-level input `bootstrapEngine` registers (`createDomInputSystems`, `createInputStateSystem`, `InputState`, `InputEvent`) | `three` |
| `fenrir-ts/physics` | `src/physics.ts` | Jolt physics system, components, helpers, the physics builder methods, `ctx.physics` | `jolt-physics`, `three` |
| `fenrir-ts/editor` | `src/editor/index.ts` | Monaco live code editor | `monaco-editor` |

Consumers import only from these five paths. Never import from `fenrir-ts/dist/...` or a source file path.
Anything not exported from one of the entry files is internal and can change without notice.
There is no `fenrir-ts/core`: core is the root entry.

The core entry imports no Pixi, Three, Jolt, Monaco or Lit code. `pnpm check:imports` checks the built output, and `tests/publicApi.test.ts` fails if core loads any of them.
New core code must keep it that way: put anything that needs a renderer in the entry for that renderer.

Each renderer entry adds to core types when it is imported, and to core classes when it loads:

- `fenrir-ts/2d` adds `pixiNode`, `renderSprite` and the other 2D methods to `EntityBuilder`, and `requestTexture2D`, `loadTexture2D`, `getTexture2D` and the Pixi loader to `AssetStore`.
- `fenrir-ts/3d` adds the 3D builder methods, `loadModel`, `loadTexture`, `getTexture` and the glTF loader to `AssetStore`, and `skybox`, `setSkybox`, `removeSkybox` and `hasSkybox` to `Scene` (`src/core/Skybox/SceneSkybox.ts`), and makes every default `Transform` out of Three `Vector3` and `Quaternion`. `pnpm check:consumer` fails if a 2D bundle ships the skybox members.
- `fenrir-ts/physics` adds the physics builder methods and `physics?: PhysicsHelpers` to `SystemCtx`, and also makes default transforms out of Three objects.

So a method from an entry is typed and present only when that entry is imported.
Core's `Transform` is a plain `{ x, y, z }` / `{ x, y, z, w }` shape. `Transform` from `fenrir-ts/3d` is the same component typed with Three classes; import that one in 3D code.

Inside the repo, `@/` is an alias for `src/`.

## Core model

**Game.** `createGame({ canvas, plugins, logger })` in `src/core/Game.ts` builds the scheduler, scene manager, event bus, logger and asset store, installs each plugin in order (awaiting an async `install`), and returns a `Game`. `Game` wraps an `Engine`, which keeps the frame loop and lifecycle. `game.run()`, `stop()`, `pause()` and `resume()` delegate to it. `game.isRunning()` (`Engine.isActive()`) is true from the end of startup until `stop()` is called, paused included; `Engine.isRunning()` is false while paused. `run()` resolves without throwing when a system stops the game during startup, so read `isRunning()` after it.

**Plugins.** A plugin is `{ name, install(game) }`, as `pixi2d()` from `fenrir-ts/2d` is. `install` reads `game.canvas`, `game.logger`, `game.assets` and `game.events` and adds systems. It registers only: resources are acquired in an `Init` system and released with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back. If an install throws, `createGame` rejects and nothing has run. Core never imports a plugin's types.

**Schedule.** `Schedule` in `src/core/Schedule.ts` (re-exported from `src/core/Scheduler.ts`) names the stages. `game.run()` (`Engine.run()`) resolves the order of every stage, awaits `PreInit`, `Init` and `PostInit` in order, then runs frames on `requestAnimationFrame`. If a startup system throws, `Exit` systems and cleanups run and `run()` rejects with the error.
Each frame runs `PreUpdate`, then `Tick` zero or more times at the fixed `time.fixedDelta`, then `Update` and `PostUpdate`, then advances the event buffers. `Engine.stop()` awaits `Exit`.
`PreInit`, `Init`, `PostInit` and `Exit` may be async and are awaited. `PreUpdate`, `Tick`, `Update` and `PostUpdate` are sync: an async function there type-checks but is not awaited.

**Systems.** A system is a function `(ctx: SystemCtx) => void`, registered with `game.addSystem(stage, fn, options?)`. `options` is `{ name, before, after, runIf }`.
A system's name is its function name unless `name` is passed; an anonymous function with no `name` throws, and so does a second system with the same name in one stage.
Systems in a stage run in registration order unless `before` or `after` (names in the same stage) say otherwise. An unknown name or a cycle makes `run()` reject, naming both systems. `runIf(ctx)` is checked each time the system would run.
`game.replaceSystem(name, fn)` swaps the function and keeps position and options; `game.removeSystem(name)` removes it. Both act on the name in every stage that has it. While running, changes are checked at the call and take effect from the next frame. `scheduler.describe()` prints the schedule with names.
`SystemCtx` (`src/core/SystemCtx.ts`) gives `time`, `random`, `events`, `logger`, `scenes`, `scene`, `entities`, `resources` and `stop()`.
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

**Immediate listeners.** `game.on(Type, (payload, ctx) => {})` and `ctx.events.on(Type, handler)` call the handler inside `send`. Use `on` for side effects that do not feed back into the frame (audio, analytics, notices); use a reader when the result changes game state and order matters. Do not write your own pub/sub or abort-signal helper for listeners: lifetime is handled.

```ts
import { Schedule, defineEvent, type SystemCtx } from "fenrir-ts";

const Scored = defineEvent<{ points: number }>("myGame.scored");
declare function playFanfare(points: number): void;

// Reaction: called inside every send while the game runs. Stays across stop() and run().
const off = game.on(Scored, ({ points }, ctx) => {
  playFanfare(points);
  ctx.logger.info("scored", { points });
});

// Simulation: read in a system, in schedule order. Create the reader once.
const scored = game.events.createReader(Scored);
let total = 0;
function addScore(_ctx: SystemCtx): void {
  for (const { points } of scored.read()) total += points;
}

// A listener for one run: added in a system, removed when that run stops.
function showNotices({ events }: SystemCtx): void {
  events.on(Scored, ({ points }) => console.log(`+${points}`));
}

game.addSystem(Schedule.Update, addScore).addSystem(Schedule.Init, showNotices);
// Send from a system or, while the game runs, from anywhere else, such as a DOM handler.
document.querySelector("#goal")?.addEventListener("click", () => game.events.send(Scored, { points: 10 }));
off(); // removes the game.on listener early
```

- `game.on(Event, handler)` is setup, like `addSystem`: the listener stays across `stop()` and `run()` until the function it returns is called.
- `ctx.events.on(Event, handler)` belongs to the run it is called in and is removed when that run stops, after its `Exit` systems and cleanups. Calling `events.on` with no run going throws; use `game.on` there.
- Listeners are called synchronously inside `send`, in registration order, after the event is buffered, with the current run's `ctx`. A `send` before the first run or after a stop only buffers the event.
- A listener may send events; they are delivered at once, depth first. A listener removed during delivery is not called after that; one added during delivery receives only later events. Events nested 32 deep stop being delivered, with an error logged.
- A listener that throws, or an async one that rejects, is logged through the game's logger with the event name; the other listeners and the sender carry on. Async listeners are not awaited.
A 2D game passes `pixi2d()` from `fenrir-ts/2d` in `plugins`. `pixi2d({ application })` adopts a Pixi application the app owns (a `background` passed with it sets the application's clear colour at Init), and `plugin.renderer` is the `PixiRenderer` for code that draws with Pixi directly: into `renderer.root` (logical units) or `renderer.backdrop` (full bleed). See "Viewport" below. Input needs no setup: see "Input" above.
The 3D renderer has no plugin: a 3D game builds an `Engine` and calls `bootstrapEngine(engine, logger, { canvas })` from `fenrir-ts/3d`, which registers the legacy window-level input (`createDomInputSystems` and `InputState`, from `fenrir-ts/3d`, frozen with the 3D path), the Three renderer, camera and skybox; pass `physics: createPhysicsSystem()` from `fenrir-ts/physics` for physics. See `src/core/Bootstrap.ts`.

**Resources.** `defineResource<T>(name, factory?)` in `src/core/Resource.ts` returns a typed handle for one value per game. `resources.get(Resource)` returns it, running `factory` on the first `get`; `resources.set(Resource, value)` replaces it. `game.resources` is the same object as `ctx.resources`, so setup code and tests can `set` before `run()`. Without a factory, `get` throws until a value is set, and the error names the resource.
Values belong to one `Resources` instance, one per game, so two games never share them even though the handle is module-level. Two handles with the same name share a value, as components do; that is not an error. Values survive `stop()` then `run()`, like entities. `Engine.reset()` clears them, so factories run again; `Game` has no `reset` yet. An `Engine` built without `services` makes its own `Resources`.

```ts
import { Schedule, createGame, defineResource } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";

const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
const Level = defineResource<number>("myGame.Level");

function scorePoint({ resources }: SystemCtx): void {
  resources.get(Round).score += resources.get(Level);
}

const game = await createGame({ canvas: document.createElement("canvas") });
game.resources.set(Level, 3); // seed before the first frame
game.addSystem(Schedule.Update, scorePoint);
```

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

**States.** `defineState(name, { values, initial })` returns a `StateType` whose value type is the union of `values`; no `as const` is needed. `ctx.states` and `game.states` are the same object, one per game, with `get`, `set` and `timeIn` (seconds of game time in the current value, pauses excluded). `game.onEnter(state, value, fn)` and `game.onExit(state, value, fn)` register synchronous hooks that get the normal `SystemCtx`. `inState(state, ...values)` is the only `runIf` helper. The code is in `src/core/State.ts`.
`states.set` queues the change, and it is applied after the current system returns: exit hooks, then enter hooks, then the next system, whose `runIf` sees the new value, in every stage including startup and `Exit`.
The last `set` of a state in one system wins, and setting the current value is a no-op. A run starts each state at `initial` and runs its enter hooks before the first `PreInit` system. A `set` from a hook is applied when that transition's hooks finish; one made outside a system is applied before the first system of the next stage. Stopping drops unapplied changes and runs no exit hooks. More than 16 transitions of one state in a frame throws. A throwing hook behaves like a throwing system in that stage.
The engine applies changes through `beforeStage` and `afterSystem` in `src/core/State.ts`, called from `Scheduler.runSyncStage`, `Scheduler.runAsyncStage` (which `Engine` uses for startup) and the `Exit` loop in `Engine`.

```ts
import { Schedule, createGame, defineState, inState } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";

const Phase = defineState("myGame.Phase", { values: ["loading", "playing", "over"], initial: "loading" });

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas });

function finishLoading({ states }: SystemCtx): void {
  states.set(Phase, "playing"); // applied when this system returns
}

function play({ states }: SystemCtx): void {
  if (states.timeIn(Phase) > 60) states.set(Phase, "over");
}

game
  .onEnter(Phase, "playing", ({ logger }) => logger.info("go"))
  .onExit(Phase, "playing", ({ logger }) => logger.info("time up"))
  .addSystem(Schedule.PostInit, finishLoading)
  .addSystem(Schedule.Update, play, { runIf: inState(Phase, "playing") });
await game.run();
```

**Testing a game.** `createTestGame({ seed, now?, plugins?, logger? })` in `src/core/TestGame.ts` builds a `TestGame` on the same `GameImpl` as `createGame`, with no canvas and no `requestAnimationFrame`. `await game.start()` runs the startup stages with `run()`'s rollback, `game.step(dt = 1 / 60, frames = 1)` runs whole frames through `Engine.frame`, and `await game.stop()` runs `Exit` and cleanups. The clock is a `ManualClock`: each step moves it by `dt`, and `game.clock.advance(ms)` moves `time.now()` without a frame. `seed` is required.
Fixed ticks accumulate from `dt` exactly (the engine passes `dt` to `Time.update` instead of a clock difference). `dt` above `maxFrameDelta` (0.25 s) throws instead of being clamped; at most 8 ticks run per frame, as in the browser. A `TestGame` has `start()` instead of `run()` and no `pause`, `resume` or `canvas`; reading `game.canvas` in a plugin's `install` throws, so `pixi2d` cannot be installed in one. `Game.step` runs only while paused and runs every system, the renderer included.

```ts
import { Schedule, createTestGame, defineResource, defineState, inState } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";
import { expect, it } from "vitest";

const Phase = defineState("myGame.Phase", { values: ["casting", "landed"], initial: "casting" });
const Line = defineResource("myGame.Line", () => ({ ticks: 0 }));

function reel({ resources, states }: SystemCtx): void {
  if (++resources.get(Line).ticks >= 60) states.set(Phase, "landed");
}

it("lands after one second of ticks", async () => {
  const game = await createTestGame({ seed: 1 });
  game.addSystem(Schedule.Tick, reel, { runIf: inState(Phase, "casting") });
  await game.start();
  game.step(1 / 60, 60);
  expect(game.states.get(Phase)).toBe("landed");
  await game.stop();
});
```

**Timers and tweens.** The `motion()` plugin (`src/core/Motion/Motion.ts`, easings in `Easing.ts`) runs both; `addTimer` and `addTween` throw without it. They are plain data in two components, `Timers` and `Tweens` (`fenrir.Timers`, `fenrir.Tweens`), each a record of entries by name, so `inspect()` shows them and tests assert on them. There are no closures in them: an easing is a name (`EasingName`, or one added with `defineEasing`), and a tween names its component by its `defineComponent` name.

```ts
import { EntityBuilder, MotionSettings, Schedule, TweenDone, addTimer, addTween, createTestGame, motion, type SystemCtx } from "fenrir-ts";
import { Display2D, Transform2D } from "fenrir-ts/2d";

const game = await createTestGame({ seed: 1, plugins: [motion()] });
const finished: string[] = [];
game.on(TweenDone, ({ name }) => void finished.push(name));

function spawn(ctx: SystemCtx): void {
  const card = EntityBuilder.create().transform2D(0, 600).display2D({ alpha: 0 }).spawn(ctx.entities);
  addTween(ctx, card, Transform2D, { to: { y: 400 }, duration: 0.25, ease: "backOut", name: "myGame.settle" });
  addTween(ctx, card, Display2D, { to: { alpha: 1 }, duration: 0.25, delay: 0.1 });
  addTimer(ctx, card, "myGame.hint", { duration: 2, repeat: Infinity, group: "ambient" });
}

game.addSystem(Schedule.Init, spawn);
await game.start();
game.resources.get(MotionSettings).paused.ambient = true; // the hint timer waits
game.step(1 / 60, 30);
console.log(finished); // ["myGame.settle", "fenrir.Display2D:alpha"]
// This example runs in tests/core/Motion/Motion.test.ts. Change both together.
```

- `addTween(ctx, entity, Component, { to, from?, duration, delay?, ease?, repeat?, yoyo?, name?, group? })` takes `ctx` as `{ entities, resources }` (`MotionCtx`). Fields are the keys of `to`, typed as the component's number fields (`NumericKeys<T>`); the entity must have the component. The default name is `<component>:<fields>`, such as `fenrir.Transform2D:x,y`. The same name replaces; the newest tween of a field takes it from older tweens of that component on the entity, which are dropped once they drive nothing. Replaced and cancelled tweens send nothing.
- `from` fields not given are read when the delay ends. Values are `from * (1 - e) + to * e`, so a tween lands exactly on `to` (on `from` after an even number of yoyo plays), and overshoot past a play carries into the next. `repeat` is plays after the first, `Infinity` to loop; a repeat needs `duration > 0`. `duration: 0` ends at the next frame, even at `dt` 0.
- `addTimer(ctx, entity, name, { duration, repeat?, group?, state? })` sends `TimerFired { entity, name, count, last }` once per firing, every firing a long frame holds. `remaining` is kept as `duration - elapsed`. `state: [StateType, value]` removes it unfired once that state has another value (a state nothing has read or set is at its initial value). It does not replace `states.timeIn`, which says how long a state has had its value.
- Completion: `TweenDone { entity, name }` and the last `TimerFired`, sent after every timer and tween has moved. Finished entries are removed, and an empty `Timers` or `Tweens` component is removed, so "running" means "present".
- `fenrir.motion.preUpdate` advances everything by `time.delta`. Plugins install before the game adds systems, so it runs before the game's `PreUpdate` systems and `Update` and the renderer see this frame's values. Entries added later in a frame start moving the next frame.
- Pause: an entry's `paused` field, or a group with `MotionSettings.paused[group] = true` (the `fenrir.MotionSettings` resource, set by the plugin at install). Reduced motion: `MotionSettings.reducedMotion = true` ends every unpaused tween at its end values at the next frame, firing `TweenDone`; timers are unaffected.
- Lifetime: entries are entity data, so they stay across `stop()` and `run()` and continue. Removing the tweened component drops its tweens silently; removing `Timers`, `Tweens` or the entity cancels everything on it; `cancelTimer` and `cancelTween` remove one.
- Cost: none of this is reachable from code that does not import it. `game-2d` and `core-only` ship no motion code, and `check:consumer` fails if they do; `scripts/consumer/game-2d-motion.js` measures a game that uses it. Do not move it into `createServices` or the engine, and do not add a builder method for it: builder extensions run at import and every game would pay.
- Tests: `tests/core/Motion/Motion.test.ts`, all with `createTestGame` and `step`.

**Input.** `defineAction(name, bindings)` in `src/core/Input/Action.ts` returns an `ActionType`. Bindings are `KeyboardEvent.code` values (`"KeyA"`, `"Space"`, `"ArrowLeft"`), typed as `KeyCode`, or `"pointer.primary"` (left button, finger, pen) and `"pointer.secondary"` (right button). An unknown binding is a compile error, and a lowercase or one-letter string also throws at definition. `ctx.input` and `game.input` are one `Input` (`src/core/Input/Input.ts`): `pressed`, `released`, `held`, `pointer` (`x`, `y`, `down`, `inside`, `cancelled`), `focused`, `edges(actions)`, `consumePointer()`, `consume(action)`, and the setup calls `onDown(action, handler)` and `onGesture(handler)`. `createGame` installs it; a game registers no input systems.
Read input in systems. Never add DOM listeners for gameplay input, and never read `KeyboardEvent`s yourself. What must happen inside the DOM event goes through `onDown` (decide a key's default) or `onGesture` (audio unlock and other gesture-only calls).

```ts
import { Schedule, createGame, defineAction, type SystemCtx } from "fenrir-ts";

const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas });

function ui({ input }: SystemCtx): void {
  if (input.pressed(Tap) && input.pointer.y < 60) input.consumePointer(); // the top bar handled it
}

function play({ input, logger }: SystemCtx): void {
  if (input.pressed(Tap)) logger.info(`tap at ${input.pointer.x}, ${input.pointer.y}`);
}

game.addSystem(Schedule.Update, ui, { before: "play" }).addSystem(Schedule.Update, play);
await game.run();
```

- The engine latches input when a frame starts (`Engine.frame` calls `InputImpl.latch` before `PreUpdate`): every system in the frame, in every stage, gets the same answers. `pressed` and `released` are true for exactly one frame. A press and release between two frames holds for one frame and releases in the next, so a quick tap is never lost. An action is held while any binding is down; a second binding going down gives no second press.
- In `Tick`, `pressed` and `released` are true in exactly one tick, the first that runs after the edge, carried across frames that run no tick. `held` is the frame's answer.
- `pointer.x` and `pointer.y` are logical units: `screenToLogical` with the `Viewport` resource if one is set, otherwise CSS pixels from the canvas corner. Only the primary pointer counts; a second finger is ignored.
- `consumePointer()` hides the pointer bindings' press, hold and release from systems that run after it, until the pointer lifts. Keys still count and `pointer.down` does not change. `consume(action)` does the same for whichever of the action's bindings went down this frame, keys included, and so also hides other actions bound to those keys. The UI system must run first: `before` in the same stage, or `PreUpdate` if gameplay reads `Tick`.
- `edges(actions)` lists this frame's presses and releases of `actions` in arrival order, repeats kept (the booleans fold two presses of one key into one). Built from the raw log `setDown` keeps between frames; consumed bindings are left out. Read it in `PreUpdate` or `Update`: in `Tick` it is the frame's list in every tick.
- `onDown(action, handler)` runs inside the engine's `keydown` (every one, repeats included) and the pointer event that presses a bound button, before `setDown`; returning `true` makes the listener call `preventDefault()`. `onGesture(handler)` runs inside each non-repeat `keydown`, `pointerdown` and `pointerup`. Both are setup like `game.on`: kept across runs, called only while a run is going (with its `ctx`), removed by the returned function; a throw is logged.
- `focused` is latched from the canvas `focus` and `blur` listeners. `pointer.cancelled` is true in the frame that reports a release caused by `pointercancel`, lost capture, blur or a hidden page, not a lift.
- Listeners (`src/core/Input/InputListeners.ts`) are on the canvas only, attached when a run starts with `ctx.signal`, and gone after `stop()` or a failed startup. Keys arrive only while the canvas has focus; the engine sets `tabindex="0"` when the canvas has none, and a press focuses it. Defaults prevented, on the canvas only: scrolling on Space and the arrows, touch gestures (`touch-action: none`) and the context menu.
- Blur, a hidden page, `pointercancel` and lost pointer capture release everything held; `stop()` clears input.
- A `TestGame`'s `input` is a `TestInput`: `press(action, event?)` (its first binding), `release(action)` (all bindings), `pointerDown(x, y)`, `pointerMove(x, y)`, `pointerUp()`, `pointerCancel()`, `focus()` and `blur()`, in logical units, each taking effect on the next `step`. `press` and `pointerDown` call `onDown` and `onGesture` handlers at once and return whether one claimed the press; `pointerUp` calls `onGesture`.
- The listeners read pointer buttons from `event.buttons`. A synthetic `PointerEvent` in a browser test needs `buttons: 1` on `pointerdown` and a matching `pointerup` with `buttons: 0`, or the engine sees no press (`button: 0` alone is not enough).
- `inspect()` does not show input yet.

**Inspecting a game.** `game.inspect()` (`src/core/Inspect.ts`, values encoded by `toJson` in `src/core/Json.ts`) returns a `GameSnapshot` of plain JSON: `frame`, `time` (`elapsed`, `delta`), `schedule` (system names per stage in run order), `states` (value and `timeIn` of each state the game has used), `resources` (each one that has a value) and `entities` of the active scene (`id`, `name`, `parent`, `components`). It never throws and works before `run()`, while paused and after `stop()`.
A `TestGame` has it too, and stepped frames count. `frame` counts frames since the current run started (0 during startup, kept after `stop()`, reset by `run()` or `start()`); `time` is as of the start of the latest frame, so two calls with no frame between them are deeply equal. Keys are the names given to `defineState`, `defineResource` and `defineComponent`, sorted; entities are by id. `id` and `parent` are entity handles; `fenrir.Name` and `fenrir.Relationship` are folded into `name` and `parent`, and `fenrir.Transform` stays in `components`.
`createGame({ debug: true })` also sets `window.__FENRIR__ = { inspect }`. The last debug game created owns it, it stays after `stop()`, and without a `window` nothing happens. `debug` is off by default.

```ts
import { Schedule, createGame, defineResource, type SystemCtx } from "fenrir-ts";

const Scores = defineResource("myGame.Scores", () => new Map<string, number>());
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, debug: true });

game.addSystem(Schedule.Init, function score({ resources }: SystemCtx) {
  resources.get(Scores).set("ana", 10);
});
await game.run();

const { resources, schedule } = game.inspect();
console.log(resources["myGame.Scores"]); // { $type: "Map", entries: [["ana", 10]] }
console.log(schedule.init); // ["score"]
```

| Value | In the snapshot |
| --- | --- |
| string, boolean, null, finite number | itself (`-0` as `0`) |
| `NaN`, infinities, `undefined`, bigint, symbol, function | `{ $type: "number", value: "NaN" }`, `{ $type: "undefined" }`, `{ $type: "bigint", value }`, `{ $type: "symbol", value }`, `{ $type: "function", name }` |
| `Map`, `Set`, `Date`, typed array | `{ $type: "Map", entries: [[k, v]] }`, `{ $type: "Set", values }`, `{ $type: "Date", value: iso }`, `{ $type: "Float32Array", values }` |
| plain object, array | itself; a plain-data key starting with `$` gets one more `$` |
| object with `toJSON` | what `toJSON` returns, encoded |
| class instance with only primitive own fields | `{ $type: "Vector3", x, y, z }` |
| any other class instance or DOM node | `{ $type: "Container" }` |
| throwing getter or `toJSON` | `{ $type: "Thrown", message }` |
| cycle; more than 8 levels; more than 100 items or keys; more than 1000 characters; more than 5000 values in one component or resource | cut and marked with `$truncated`: `"cycle"`, `"depth"`, `"length"` (with `size`) or `"size"` |

To check what a game is doing, assert on `inspect()`, not on pixels: `game.inspect()` in a unit test, `page.evaluate(() => window.__FENRIR__.inspect())` in a Playwright test of a game made with `debug: true`. Snapshots of the same game state are identical, so compare them whole or snapshot-test them. A value is complete unless it carries `$truncated`.
## Viewport

`pixi2d({ design: { width, minHeight }, safeArea, maxResolution })` makes a 2D game draw in design units. The design width fills the safe area's width and the logical height grows from `minHeight` to fill its height; a safe area too short for `minHeight` scales the frame down further and centres it horizontally. The code is in `src/core/Renderer2D/`: the layout maths (`layoutViewport`, exported from `fenrir-ts/2d` for browser tests) and the `Viewport` resource in `Viewport.ts` (no Pixi imports, so core's input uses it), the listeners in `ViewportSystem.ts`.

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { Viewport, ViewportResized, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, background: 0x092c36 });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const board = new Graphics();

function drawBoard({ width, height }: Viewport): void {
  board.clear().rect(0, 0, width, height).stroke({ color: 0xffffff, width: 2 }); // design units
}

function setUp({ resources, events }: SystemCtx): void {
  pixi.renderer.root.addChild(board);
  drawBoard(resources.get(Viewport));
  events.on(ViewportResized, drawBoard);
}

game.addSystem(Schedule.Init, setUp);
await game.run();
```

- Game content goes in `pixi.renderer.root` (logical units; `Renderable2D` entities and the named layers mount there). Full-bleed content goes in `pixi.renderer.backdrop`, behind it, in CSS pixels; it covers `Viewport.screen`. Both live on the renderer because the renderer is the one handle to Pixi objects; the `Viewport` resource stays plain data that core can read.
- `ctx.resources.get(Viewport)`: logical `width` and `height`, `scale`, `offset`, `insets`, `screen` and `resolution`. A new object on each change. `ViewportResized` carries it, once at startup and then only when the layout changed.
- With `design` the plugin pins the canvas to the window, sizes it to `innerWidth` by `innerHeight`, and owns the listeners: window resize, `visualViewport` resize, `screen.orientation` change and a `matchMedia` resolution query. They are attached in `fenrir.viewport.init` with `ctx.signal`, and the inset probe is removed with `ctx.onCleanup`. A resize marks the layout dirty and `fenrir.viewport.preUpdate` applies it before the frame renders. While paused, one `requestAnimationFrame` callback applies it and renders once.
- Insets come from a hidden element padded with `env(safe-area-inset-*)`; the page needs `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. `safeArea: false` ignores them.
- Without `design` nothing listens: `Viewport` reports the renderer's screen at scale 1 and follows `renderer.resize`.
- Pointer coordinates: `screenToLogical(viewport, { x, y })` converts a point relative to the canvas into logical units; `renderer.clientToLogical(clientX, clientY)` does it from DOM client coordinates. `ctx.input.pointer` is already logical.
- Tests drive window size, `devicePixelRatio`, `visualViewport`, `matchMedia` and `getComputedStyle` with stubs: `tests/core/Renderer2D/pixi2dViewport.test.ts`. The layout table is in `tests/core/Renderer2D/Viewport.test.ts`.

## Scene (2D)

`Transform2D` (`src/core/ECS/Transform2D.ts`, core) is `{ x, y, rotation, scaleX, scaleY }` in logical units and radians. It is opt-in: `createEntity` still adds only the default `Transform`. `Display2D` (`src/core/ECS/Display2D.ts`, core) is `{ alpha, visible }`, also opt-in. `PixiNode` (`src/core/Renderer2D/PixiNode.ts`, `fenrir-ts/2d`) is `{ node, layer?, keep? }`: a Pixi `Container` the app built, owned by the entity. The node code is in `PixiRenderer` (`attachNode`, `detachNode`, `releaseNodes`, `syncTransforms`, `render`), driven by the component signals in `PixiRendererSystem.ts`.

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { Transform2D, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, layers: ["world", "ui"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const MOVING = [Transform2D] as const;

function spawn({ entities }: SystemCtx): void {
  const fish = new Graphics().circle(0, 0, 12).fill(0xffaa00);
  EntityBuilder.create().transform2D(100, 200).pixiNode(fish, { layer: "world" }).spawn(entities);
}

function swim({ entities, time }: SystemCtx): void {
  entities.each(MOVING, (_entity, transform) => { transform.x += 30 * time.delta; });
}

game.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, swim);
await game.run();
```

- `renderer.render()` writes `Transform2D` and `Display2D` to every node and `Renderable2D` view of the bound scene, places each, then renders; `fenrir.pixi.postUpdate` calls it after every `Update` system. Every render syncs, so a render from game code in `PostInit` or the viewport's paused-resize render never shows a stale position (`tests/core/Renderer2D/PixiNode.test.ts`, "the first rendered frame"). Pixi's setters skip unchanged values, so there is no change tracking. A node whose entity has no `Transform2D` is not moved, and one with no `Display2D` keeps its own `alpha` and `visible`. `Transform2D` wins over `Transform` on an entity that has both (every entity has a `Transform`); `Display2D` wins over `Renderable2D` `flags.alpha` and `flags.visible`.
- Placement: under the direct parent entity's node or `Renderable2D` view if it has one, else in `layer`, else in `renderer.root`. Layers are `Container`s under `root`, labelled `fenrir.layer.<name>`, back to front, `sortableChildren` on. The reserved layer `"fenrir.backdrop"` is `renderer.backdrop` (CSS pixels, unscaled, behind `root`); declared layer names starting with `fenrir.` throw. `renderer.layer(name)` returns one and throws for an unknown name, listing the declared layers; so does `entities.set` with an unknown `layer` while a run is going, and a run whose entities name one rejects at Init.
- Child order: Pixi sets `sortableChildren` on a parent when a child with a non-zero `zIndex` is added or its `zIndex` changes, overriding an explicit `false`, so child entities' nodes sort with no engine code. A `Graphics` or `Sprite` draws before all its children; a node with child entities should be a plain `Container`.
- Lifetime: removing the component or the entity removes the node from its parent and calls `destroy({ children: true })` (textures stay). Other entities' nodes and views inside it are moved to `root` first. `keep: true` only unmounts. At stop every node is unmounted, destroyed unless kept, and its `PixiNode` removed, so a later run never mounts a destroyed node; kept nodes keep their component and are mounted again by the next run. A scene switch unmounts the old scene's nodes without destroying them. One node on two entities throws.
- Tests: game logic that moves `Transform2D` needs no renderer, so test it with `createTestGame` and `inspect()`. Test node sync with `createPixiRendererSystem({ application })`, an `Application` whose `renderer` is a stub, and `createMockSystemCtx()`, calling `init`, `postUpdate` and `exit` directly: `tests/core/Renderer2D/PixiNode.test.ts`. Pixi containers need no renderer.
- `inspect()` shows `fenrir.PixiNode` as `{ node: { $type: "<class name>" }, layer, keep }`, and `fenrir.Display2D` as its values.

## Naming rule

Component and event identity is the name, through `Symbol.for`. Two `defineComponent` or `defineEvent` calls with the same name return the same key and share storage. Resources follow the same rule: two `defineResource` handles with the same name share one value in each game.
So prefix every name with a namespace for your game or library, such as `myGame.Health`. Names starting with `fenrir.` are reserved for the engine. Engine code uses them, for example `fenrir.Transform` and `fenrir.input.keyDown`.

System names follow the same rule. Every system the engine registers is named `fenrir.<module>.<stage>`, where `<stage>` is the `Schedule` value it runs in: `fenrir.pixi.init`, `fenrir.pixi.postUpdate` (writes transforms to nodes and views, then renders), `fenrir.pixi.exit` (unmounts and destroys nodes), `fenrir.input.dom.init` and `fenrir.input.state.preUpdate` (3D only), `fenrir.viewport.init`, `fenrir.viewport.preUpdate`, `fenrir.motion.preUpdate` (timers and tweens), `fenrir.three.*`, `fenrir.camera.*`, `fenrir.skybox.*`, `fenrir.animation.*`, `fenrir.stats.postUpdate`, `fenrir.physics.*` and `fenrir.editor.*` (the editor's user script).
Engine factories name their systems with `nameEngineSystems(module, { init, update, ... })` from `src/core/SystemName.ts`, which is internal. A new engine factory uses it; a game or third-party plugin passes `{ name }` with its own namespace, such as `myGame.audio.update`. Plugin names follow the rule too: `fenrir.pixi2d`.

## Frozen areas

These are kept working and tested, but get no new features. Fix bugs in them; do not extend them.

- 3D renderer: `src/core/Renderer/`
- Camera: `src/core/Camera/`
- Skybox: `src/core/Skybox/`
- Animation: `src/core/Animation/`
- Physics (Jolt): `src/core/Physics/`
- 3D setup and stats: `src/core/Bootstrap.ts`, `src/core/Util/Stats.ts`
- Window-level input for 3D: `src/core/InputSystem/`, exported from `fenrir-ts/3d`
- Editor (Monaco): `src/editor/`

New work goes into the 2D path: `src/core/Renderer2D/`, `src/core/Input/`, `src/core/Motion/`, ECS, scheduling and events.

## Changing the engine

- Tests live in `tests/`, mirroring `src/`: `src/core/ECS/View.ts` is tested in `tests/core/ECS/View.test.ts`. Vitest runs in jsdom with globals on. Shared helpers are in `tests/utils/testHelpers.ts`.
- Every behaviour change needs a test that fails without it.
- Test engine behaviour that spans frames with `createTestGame` and `game.step(dt)`, not by stubbing `requestAnimationFrame` and calling the captured callback. Stub the loop only in tests about the browser loop itself (`run()`, `pause()`, `resume()`, the rAF callback).
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
- Canvas UI, audio and storage

A new service adds a field to `GameServices` in `src/core/SystemCtx.ts`, which puts it on both `game` and `ctx`, and builds it in `createServices` in `src/core/Game.ts`.

`createGame` is the way to start a 2D game. `Engine`, `Scheduler`, `EventBus` and `SceneManager` stay exported for 3D games and the editor until they go internal.

# Fenrir TS

**Fenrir TS** is a TypeScript game engine inspired by my C++ engine [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine), re-imagined for the web with a TypeScript-first design.

It focuses on **clear engine architecture**, **explicit data flow**, and **high-performance ECS patterns**, while remaining flexible enough to support both 2D and 3D rendering backends.

---

## Installation

```bash
npm install fenrir-ts
# or
pnpm add fenrir-ts
# or
yarn add fenrir-ts
```

### Peer Dependencies

Each entry point needs its own peer dependency. Install the ones for the entries you import:

| Entry | Install |
| --- | --- |
| `fenrir-ts/2d` | `pixi.js` |
| `fenrir-ts/3d` | `three` |
| `fenrir-ts/physics` | `jolt-physics` and `three` |
| `fenrir-ts/editor` | `monaco-editor` |

The core entry, `fenrir-ts`, needs none of them.

---

## Usage

The package has one entry point per area. Core never loads a renderer, so a 2D game ships no Three.js code.

| Import | Contents |
| --- | --- |
| `fenrir-ts` | Core: `createGame`, plugins, named systems, scenes, ECS, events, time, logging, input, `EntityBuilder`, `AssetStore` |
| `fenrir-ts/2d` | The `pixi2d` renderer plugin, the `Viewport` resource and `ViewportResized` event, `Renderable2D`, 2D builder methods such as `renderSprite`, 2D texture loading |
| `fenrir-ts/3d` | Three.js renderer, camera, skybox, animation, model loading, `bootstrapEngine` |
| `fenrir-ts/physics` | Jolt physics system, components and builder methods |
| `fenrir-ts/editor` | Monaco live code editor |

Importing `fenrir-ts/2d`, `fenrir-ts/3d` or `fenrir-ts/physics` also adds that entry's methods to `EntityBuilder` and `AssetStore`, so `renderSprite` and `requestTexture2D` exist once you import `fenrir-ts/2d`.

### Quick start (2D)

`createGame` builds the game and installs its plugins. `pixi2d` from `fenrir-ts/2d` is the PixiJS renderer.

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) throw new Error("Canvas element not found");

const game = await createGame({ canvas, plugins: [pixi2d({ background: 0x101820 })] });

function spawnBall({ entities }: SystemCtx): void {
  EntityBuilder.create().transform({ x: 200, y: 150, z: 0 }).renderCircle(16, { fillColor: 0xff6600 }).spawn(entities);
}

game.addSystem(Schedule.Init, spawnBall);
await game.run();
```

`game.run()` resolves once `PreInit`, `Init` and `PostInit` have run and the first frame is scheduled. If any of them throws, the run rolls back: `Exit` systems and cleanups run, and `run()` rejects with the error. `game.stop()`, `game.pause()` and `game.resume()` control the loop, and `game.step(dt)` runs frames while paused. Tests use `createTestGame` instead: see [Testing a game](#testing-a-game).

`game.assets` is the asset store. The 2D texture methods come from `fenrir-ts/2d`:

```ts
import "fenrir-ts/2d";

const hero = game.assets.requestTexture2D("hero", "/sprites/hero.png");
hero.subscribe((state) => game.logger.info(`hero texture: ${state.status}`));
```

To keep a Pixi application your app already owns, pass it in. It must be initialized on the same canvas with its ticker stopped, and the game does not destroy it at exit. Game code that draws with Pixi directly adds to the plugin's `renderer.root`, in logical units (see [Viewport](#viewport)):

```ts
import type { Application } from "pixi.js";
import { createGame } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

declare const app: Application; // initialized by your app, with app.ticker.stop() called

const pixi = pixi2d({ application: app });
const game = await createGame({ canvas: app.canvas, plugins: [pixi] });
await game.run();
pixi.renderer.root.addChild(myOverlay);
```

### Viewport

Pass `design` to draw in design units on any screen. The design width always fills the safe area's width and the logical height grows from `minHeight` to fill its height; a safe area too short for `minHeight` scales the frame down further and centres it horizontally.

```
 screen (canvas, CSS px) ─────────────────┐
 │ ░░░░░░░░░ safe-area inset top ░░░░░░░░ │  backdrop: full bleed,
 │ ┌─ root (design frame) ──────────────┐ │  CSS px, behind root
 │ │ (0,0)              (390,0)         │ │
 │ │   design width 390 fills the safe  │ │  root: logical units,
 │ │   width; height = max(520, safe    │ │  at offset, scaled
 │ │   height / scale)                  │ │  by scale
 │ │ (0,height)                         │ │
 │ └────────────────────────────────────┘ │
 │ ░░░░░░░░ safe-area inset bottom ░░░░░░ │
 └────────────────────────────────────────┘
```

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { Viewport, ViewportResized, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const pixi = pixi2d({
  design: { width: 390, minHeight: 520 }, // width is fixed; height grows to fill
  safeArea: true, // lay out inside env(safe-area-inset-*); the default
  maxResolution: 2, // backing-store pixels per CSS pixel, at most; the default
  background: 0x092c36,
});
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });

const sky = new Graphics();
const board = new Graphics();

function layout({ screen, width, height }: Viewport): void {
  sky.clear().rect(0, 0, screen.width, screen.height).fill(0x0f4250); // whole screen, CSS px
  board.clear().rect(0, 0, width, height).stroke({ color: 0xffffff, width: 2 }); // design units
}

function setUp({ resources, events }: SystemCtx): void {
  pixi.renderer.backdrop.addChild(sky);
  pixi.renderer.root.addChild(board);
  layout(resources.get(Viewport));
  events.on(ViewportResized, layout); // removed when the run stops
}

game.addSystem(Schedule.Init, setUp);
await game.run();
```

- The plugin owns the canvas: it pins it to the window's top-left (`position: fixed`), sizes it to `innerWidth` by `innerHeight`, and listens to window resize, `visualViewport` resize, orientation and device-pixel-ratio changes. The listeners are added in `fenrir.viewport.init` and removed when the run stops. A game adds none.
- `renderer.root` holds game content in logical units; entities with `Renderable2D` mount there. `renderer.backdrop` sits behind it, in unscaled CSS pixels from the screen's top-left; cover `viewport.screen` with it to fill the area outside the frame and the safe area.
- `ctx.resources.get(Viewport)` is plain data: logical `width` and `height`, `scale` (CSS pixels per logical unit), the frame's `offset` on the screen, the `insets` in use, the `screen` size and the `resolution`. Each change replaces the object.
- `ViewportResized` carries the new `Viewport`. It is sent once at startup and then on each change, never twice for the same layout. A resize is applied in the next frame's `PreUpdate` (`fenrir.viewport.preUpdate`), before anything renders. While the game is paused no frame runs, so the plugin applies the layout and renders once on the next animation frame.
- `pixi.renderer.clientToLogical(clientX, clientY)` converts a DOM event's position into logical units, and `logicalToClient` converts back. `screenToLogical(viewport, point)` and `logicalToScreen` do the same for points relative to the canvas.
- `safeArea: false` ignores insets. `maxResolution` caps the resolution at `min(devicePixelRatio, maxResolution)`, with or without `design`. An adopted `application` is sized the same way.
- Without `design`, the canvas keeps the size it was created with and the plugin listens to nothing. `Viewport` then reports the renderer's screen at scale 1, and `ViewportResized` is sent when game code resizes the renderer.

The page needs `viewport-fit=cover`, or the browser reports zero insets and letterboxes the page itself:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>html, body { margin: 0; overflow: hidden; }</style>
<canvas id="game"></canvas>
```

### Plugins

A plugin is `{ name, install(game) }`. `createGame` installs plugins in order and awaits an async `install`. If an install throws, `createGame` rejects with that error.

`install` may read `game.canvas`, `game.logger`, `game.assets` and `game.events`, and add systems. It should only register: acquire GPU contexts, listeners and other resources in an `Init` system, and release them with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.

```ts
import { Schedule, type Plugin } from "fenrir-ts";

const frameLogger: Plugin = {
  name: "myGame.frameLogger",
  install(game) {
    game.addSystem(Schedule.PostUpdate, function logFrame({ time }) {
      game.logger.debug(`frame took ${time.delta}s`);
    }, { name: "myGame.frameLogger.postUpdate" });
  },
};
```

### Basic Example (3D)

The 3D renderer is frozen and has no plugin, so a 3D game still builds an `Engine` itself. `bootstrapEngine` from `fenrir-ts/3d` registers input, the Three.js renderer, camera and skybox systems in one call.

```ts
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "fenrir-ts";
import { bootstrapEngine } from "fenrir-ts/3d";
import { createPhysicsSystem } from "fenrir-ts/physics";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) {
  throw new Error("Canvas element not found");
}

const logger = new ConsoleLogger();
const engine = new Engine({
  scheduler: new Scheduler(),
  sceneManager: new SceneManager(logger),
  events: new EventBus(),
  logger,
});

// Physics is optional; leave out `physics` and the fenrir-ts/physics import if you do not need it.
const { assets } = bootstrapEngine(engine, logger, { canvas, physics: createPhysicsSystem() });
await assets.loadModel("ship", "/models/ship.glb");

engine.addSystems(Schedule.Update, [yourGameSystem]);
await engine.run();
```

### Components and systems

Define components with `defineComponent`, store them on entities, and query them from systems. Every system receives a `SystemCtx`. Its `signal` aborts when the game stops, and `onCleanup` registers teardown for the current run.

```ts
import { Schedule, defineComponent, type SystemCtx } from "fenrir-ts";

type Health = { current: number; max: number };
const Health = defineComponent<Health>("myGame.Health");

// Keep the query tuple in a constant so the engine can cache the view.
const HEALTH_QUERY = [Health] as const;

function spawnPlayer({ entities }: SystemCtx): void {
  const player = entities.createEntity();
  entities.set(player, Health, { current: 10, max: 10 });
}

function regenerate({ entities, time }: SystemCtx): void {
  entities.each(HEALTH_QUERY, (_entity, health) => {
    health.current = Math.min(health.max, health.current + time.delta);
  });
}

game.addSystem(Schedule.Init, spawnPlayer).addSystem(Schedule.Update, regenerate);
```

### Time and random

Read time and draw random numbers from the context, not from `Date.now()`, `performance.now()` or `Math.random()`, so a game replays exactly under test.

- `time.delta`: seconds since the last frame, clamped. `time.fixedDelta`: seconds per `Tick`, settable, 1/60 by default. `time.elapsed`: seconds of game time since `run()`, excluding pauses. `time.now()`: wall-clock milliseconds, like `Date.now()`.
- `random.next()` is in [0, 1), `random.int(min, max)` includes both ends, and `random.pick(items)` returns one item and throws on an empty list. The generator is mulberry32.
- `createGame({ seed })` seeds `ctx.random` and `game.random`. Without a seed it is seeded from the clock; `game.random.seed` reports the seed either way, so log it to replay a run. Stopping and running a game again continues the sequence.
- `Time` reads only the `Clock` it is given: `{ monotonic(), now() }`. `Engine` takes one as `clock`; the default is the browser's.

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, seed: 2024 });

let nextSpawnAt = 0;

function spawnEnemies({ time, random, logger }: SystemCtx): void {
  if (time.elapsed < nextSpawnAt) return;
  nextSpawnAt = time.elapsed + random.int(2, 5);
  const kind = random.pick(["slime", "bat", "ghost"] as const);
  logger.info(`spawned a ${kind} at ${new Date(time.now()).toISOString()}`);
}

game.addSystem(Schedule.Update, spawnEnemies);
```

### Named systems

A system's name is its function name, or the `name` option. An anonymous function with no `name` throws, and two systems in one stage cannot share a name. Within a stage, systems run in registration order unless `before` or `after` says otherwise. `runIf` is checked each time the system would run.

```ts
import { Schedule, type SystemCtx } from "fenrir-ts";

function movePlayer(_ctx: SystemCtx): void {}
function applyDamage(_ctx: SystemCtx): void {}
function applyDamageV2(_ctx: SystemCtx): void {}
let paused = false;

game
  .addSystem(Schedule.Update, applyDamage, { after: "movePlayer", runIf: () => !paused })
  .addSystem(Schedule.Update, movePlayer, { before: "fenrir.pixi.update" })
  .addSystem(Schedule.Update, (ctx) => ctx.logger.trace("frame"), { name: "myGame.trace" });

// While the game runs, both take effect from the next frame.
game.replaceSystem("applyDamage", applyDamageV2); // keeps its position and options
game.removeSystem("myGame.trace");
```

Order is resolved when `run()` starts. A `before` or `after` that names a system not in the stage, or a cycle, makes `run()` reject with an error that names both systems. While the game runs, `addSystem`, `replaceSystem` and `removeSystem` check the new order at once and throw at the call if it does not resolve. `replaceSystem` and `removeSystem` act on the name in every stage that has it.

Engine systems are named `fenrir.<module>.<stage>`, for example `fenrir.pixi.update` (syncs transforms), `fenrir.pixi.postUpdate` (renders), `fenrir.input.dom.init` and `fenrir.physics.tick`.

### Resources

A resource is one value that a game owns, such as the score of the current round. Define it once at module level and read it with `ctx.resources.get`. The factory runs once per game, on the first `get`; a resource without a factory throws on `get` until you `set` it. `game.resources` and `ctx.resources` are the same object, so you can seed values before `run()`. Each game has its own values, so two games in one test never share them. Values survive `stop()` and `run()`, and `Engine.reset()` clears them so factories run again. Names are namespaced like component names.

```ts
import { Schedule, defineResource, type SystemCtx } from "fenrir-ts";

const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
const Level = defineResource<number>("myGame.Level"); // no factory: set before use

function scorePoint({ resources }: SystemCtx): void {
  const round = resources.get(Round); // typed { meter: number; score: number }
  round.score += resources.get(Level);
}

game.resources.set(Level, 3);
game.addSystem(Schedule.Update, scorePoint);
```

### States

`defineState(name, { values, initial })` defines a state machine whose value is one of `values`. `ctx.states` (the same object as `game.states`) has `get`, `set` and `timeIn`, the seconds of game time since the current value was entered, not counting pauses. `game.onEnter` and `game.onExit` add hooks: synchronous systems that receive the usual `ctx`. `inState(state, ...values)` is a `runIf` condition.

```ts
import { Schedule, defineState, inState, type SystemCtx } from "fenrir-ts";

const Phase = defineState("myGame.Phase", { values: ["idle", "casting", "waiting"], initial: "idle" });

function meter({ states }: SystemCtx): void {
  // Two seconds after casting starts, wait for the result.
  if (states.timeIn(Phase) > 2) states.set(Phase, "waiting");
}

game
  .onEnter(Phase, "idle", ({ logger }) => logger.info("ready")) // also runs when the game starts
  .onExit(Phase, "casting", ({ logger }) => logger.info("cast done"))
  .addSystem(Schedule.Update, function startCast({ states }) { states.set(Phase, "casting"); }, { runIf: inState(Phase, "idle") })
  .addSystem(Schedule.Update, meter, { runIf: inState(Phase, "casting") });
```

`states.set` queues the change, and it is applied after the current system returns: exit hooks for the old value, then enter hooks for the new one, then the next system, whose `runIf` sees the new value. This holds in every stage, startup and `Exit` included.

- Each run starts every state at `initial` and runs its enter hooks before the first `PreInit` system. Resources acquired in `Init`, such as the renderer, are not ready yet, so for setup that needs them start in a `loading` value and set the next one from `PostInit`.
- Setting the current value does nothing. If one system sets a state several times, only the last value is applied. Several states set in one system change in the order each was first set.
- A `set` in a hook is applied once that transition's hooks have all run. A `set` made outside a system, such as from setup code or a timer, is applied before the first system of the next stage the game runs: the next frame, or the next startup stage, or at `run()` after the initial enter hooks.
- Stopping the game is not a transition: it runs no exit hooks and drops changes not yet applied.
- More than 16 transitions of one state in one frame throws, naming the state and its last transitions. A hook that throws acts like a system that throws in that stage: in startup, `run()` rejects and the game rolls back.
- States belong to one game. Names are identities, so prefix them with your namespace.

**Important:** The canvas element must exist in the DOM before you call `createGame()` or `bootstrapEngine()`. If you're calling it in a script, either:

- Place the script at the end of the body
- Use `DOMContentLoaded` event listener
- In frameworks like React/Vue, call it in a mounted lifecycle hook

### Events

`defineEvent<T>(name)` returns a typed key, and `events.send(Event, payload)` sends one. There are two ways to receive it. Use `on` for side effects that do not feed back into the frame, such as audio, analytics and notices. Use a reader when the result changes game state and order matters: `read()` runs in a system, in schedule order, and returns each event once.

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
- Readers are unchanged: the bus keeps two frames of events, and `createReader(Event).read()` returns each one once.

### Testing a game

`createTestGame({ seed, now?, plugins?, logger? })` builds a game for tests: the same scheduler, services, states, events and plugins as `createGame`, with no canvas, no renderer and no `requestAnimationFrame`. Frames run when you call `game.step(dt)`, and time moves only with `step` and `game.clock.advance`, so the systems you register in the browser game run unchanged and deterministically in Vitest.

```ts
import { Schedule, createTestGame, defineResource, defineState, inState } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";
import { expect, it } from "vitest";

const Phase = defineState("myGame.Phase", { values: ["waiting", "casting", "landed"], initial: "waiting" });
const Line = defineResource("myGame.Line", () => ({ ticks: 0 }));

// The same system the browser game registers: one second of fixed ticks lands the fish.
function reel({ resources, states }: SystemCtx): void {
  if (++resources.get(Line).ticks >= 60) states.set(Phase, "landed");
}

it("lands the fish after one second of casting", async () => {
  const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
  game.addSystem(Schedule.Tick, reel, { runIf: inState(Phase, "casting") });
  await game.start(); // runs PreInit, Init and PostInit; schedules no frame

  game.states.set(Phase, "casting");
  game.step(1 / 60, 59); // fifty-nine frames, one tick each
  expect(game.states.get(Phase)).toBe("casting");
  game.step(1 / 60); // one more frame
  expect(game.states.get(Phase)).toBe("landed");

  game.clock.advance(5_000); // moves time.now() without running a frame
  await game.stop(); // runs Exit systems and cleanups
});
```

- `await game.start()` runs the startup stages with the same rollback as `run()`: if a startup system throws, `Exit` systems and cleanups run and `start()` rejects. `await game.stop()` runs `Exit` systems and cleanups. A stopped test game can `start()` again.
- `game.step(dt = 1 / 60, frames = 1)` runs whole frames through the same frame body as the browser loop: `PreUpdate`, the `Tick` stages the accumulator holds, `Update`, `PostUpdate`, then the event buffers advance. Fixed ticks accumulate from `dt` exactly, so `step(1 / 60, 600)` runs 600 ticks and `step(1 / 120, 2)` runs one.
- `dt` is at most 0.25 s, the engine's frame-delta clamp. A longer `dt` throws rather than silently simulating less than you asked: to advance a second, write `step(1 / 60, 60)`. A frame still runs at most 8 ticks, as in the browser, so `step(0.25)` runs 8 ticks of 1/60 and drops the rest, as a long browser frame does.
- Each stepped frame moves `time.now()` by `dt`, starting from `now` (default 0). `time.elapsed` and `states.timeIn` count stepped time only; `clock.advance(ms)` moves `time.now()` alone.
- `seed` is required. Nothing in a test game reads `performance.now()`, `Date.now()` or `requestAnimationFrame`.
- A test game has no canvas, so a plugin that reads `game.canvas`, such as `pixi2d`, throws when it installs, saying so. Plugins that only add systems, resources or listeners install as usual. A system that draws with Pixi needs the renderer and is tested in the browser; keep drawing out of gameplay systems so they run in both.
- A test game has `start()` where a `Game` has `run()`, and no `pause` or `resume`: between steps it is never running, so there is nothing to pause.
- A system that throws stops the game, and the error propagates from `step`. A system that calls `ctx.stop()` ends the remaining frames of the `step` call.

`game.step` also exists on a `Game` made by `createGame`, for frame-by-frame debugging: call `game.pause()` first. Each step advances the game by `dt` whatever the real time, and runs every system, so the `pixi2d` renderer draws each stepped frame. Calling `step` before `run()` or while running throws and says to pause first.

### Inspecting a game

`game.inspect()` returns what the game is doing as plain JSON: the frame, time, the schedule, states, resources and the active scene's entities. It never throws and works before `run()`, while paused and after `stop()`. `createGame({ debug: true })` also puts the same function on `window.__FENRIR__.inspect`, for browser tests and agents.

```ts
import { Schedule, createGame, defineComponent, defineResource, type GameSnapshot, type SystemCtx } from "fenrir-ts";

const Health = defineComponent<{ current: number }>("myGame.Health");
const Scores = defineResource("myGame.Scores", () => new Map<string, number>());

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, debug: true }); // debug: also on window.__FENRIR__

game.addSystem(Schedule.Init, function spawn({ entities, resources }: SystemCtx) {
  entities.set(entities.createEntity(), Health, { current: 3 });
  resources.get(Scores).set("ana", 10);
});
await game.run();

const snapshot: GameSnapshot = game.inspect();
const [player] = snapshot.entities;
console.log(player?.components["myGame.Health"]); // { current: 3 }
console.log(snapshot.resources["myGame.Scores"]); // { $type: "Map", entries: [["ana", 10]] }
```

```json
{
  "frame": 120,
  "time": { "elapsed": 2.0, "delta": 0.016 },
  "schedule": { "preInit": [], "init": ["fenrir.pixi.init", "spawn"], "update": ["fenrir.pixi.update"], "...": [] },
  "states": { "myGame.Phase": { "value": "playing", "timeIn": 1.5 } },
  "resources": { "myGame.Scores": { "$type": "Map", "entries": [["ana", 10]] } },
  "entities": [
    { "id": 0, "name": "Entity 0", "parent": null, "components": { "fenrir.Transform": { "position": { "x": 0, "y": 0, "z": 0 }, "...": {} }, "myGame.Health": { "current": 3 } } }
  ]
}
```

- `inspect()` is on a `TestGame` too, so a test can `step` and then assert on the snapshot. Stepped frames count like browser frames.
- `frame` counts frames since the current run started: 0 during startup, kept after `stop()`, back to 0 at the next `run()` (or `start()` on a test game). `time.elapsed` and `time.delta` are as of the start of the latest frame, so two calls with no frame between them return equal snapshots.
- `schedule` lists system names per stage in run order. `states` lists the states the game has used (read, set or hooked) with their value and seconds in it. `resources` lists the resources that have a value.
- `entities` are the active scene's, by id. `id` and `parent` are entity handles, the values `entities.get` takes; `parent` is null for a root. The engine's `fenrir.Name` and `fenrir.Relationship` are folded into `name` and `parent`; `fenrir.Transform` stays in `components`.
- Keys of `states`, `resources` and `components` are the names given to `defineState`, `defineResource` and `defineComponent`, sorted. A component keyed by a symbol `defineComponent` did not make appears as `Symbol(description)`.
- With `debug: true` and two games on one page, the last one created owns `window.__FENRIR__`, with a warning. It stays after the game stops. Without a `window`, `debug` does nothing. `debug` is off by default.

Values are encoded by these rules, so the snapshot always survives `JSON.parse(JSON.stringify(snapshot))` unchanged:

| Value | Appears as |
| --- | --- |
| string, boolean, null, finite number | itself; `-0` as `0` |
| `NaN`, `Infinity`, `-Infinity` | `{ "$type": "number", "value": "NaN" }` |
| `undefined` | `{ "$type": "undefined" }`, also as an object field, so the key stays visible |
| bigint, symbol | `{ "$type": "bigint", "value": "12" }`, `{ "$type": "symbol", "value": "description" }` |
| function | `{ "$type": "function", "name": "jump" }` |
| array | an array |
| `Map` | `{ "$type": "Map", "entries": [[key, value], ...] }`, keys encoded too, in insertion order |
| `Set` | `{ "$type": "Set", "values": [...] }` |
| `Date` | `{ "$type": "Date", "value": "2026-01-02T00:00:00.000Z" }`, `null` if invalid |
| typed array | `{ "$type": "Float32Array", "values": [...] }` |
| plain object (prototype `Object` or null) | an object with its own enumerable fields, in insertion order; a key starting with `$` gets one more `$` |
| object with `toJSON` | what `toJSON` returns, encoded by these rules |
| class instance whose own fields are all strings, numbers, booleans or null | `{ "$type": "Vector3", "x": 1, "y": 2, "z": 3 }` |
| any other class instance, DOM node, `WeakMap`, `Promise`... | `{ "$type": "Container" }`: the constructor name, which a minifier may shorten |
| a getter or `toJSON` that throws | `{ "$type": "Thrown", "message": "..." }` |

So an object with a `$type` key is always a tag, and plain data never has one. Anything cut short has a `$truncated` key, so a truncated value is never mistaken for a complete one:

| Limit | What is cut |
| --- | --- |
| a reference to an object that contains it | `{ "$type": "Object", "$truncated": "cycle" }`; an object shared but not cyclic is repeated |
| 8 levels below a component or resource | `{ "$type": "Array", "$truncated": "depth" }` |
| 100 items of an array, `Map`, `Set`, typed array or object | `{ "$type": "Array", "size": 5000, "values": [first 100], "$truncated": "length" }`; an object keeps its first 100 keys under `value` |
| 1000 characters of a string | `{ "$type": "string", "size": 4096, "value": "first 1000", "$truncated": "length" }` |
| 5000 values in one component or resource | each further value is `{ "$type": "...", "$truncated": "size" }` |

The limits are fixed. Keep component and resource values plain data (objects, arrays, numbers, strings, `Map` and `Set`) to see them in full; a display object or texture shows only its class.

**For agents and browser tests:** to check what a game is doing, assert on `inspect()` rather than on pixels. In a unit test call `game.inspect()`; in a Playwright test create the game with `debug: true` and read `await page.evaluate(() => window.__FENRIR__.inspect())`. Compare whole snapshots, or the entities, states and resources you care about: two snapshots of the same game state are identical, so they can be snapshot-tested.

### Live Code Editor Example

Fenrir TS includes a built-in live code editor powered by Monaco Editor. The worker configuration is built into the bootstrap process.

**Note:** Monaco Editor workers must be imported using your bundler's worker loading mechanism. The examples below use Vite's `?worker` syntax. For other bundlers, see the [Monaco ESM Integration Guide](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md).

**Step 1: Install Monaco Editor**

```bash
npm install monaco-editor
```

**Step 2: Import Workers and Bootstrap Editor (Vite example)**

```ts
import { Engine, Scheduler, SceneManager, EventBus, ConsoleLogger } from "fenrir-ts";
import { bootstrapEngine } from "fenrir-ts/3d";
import { createPhysicsSystem } from "fenrir-ts/physics";
import { bootstrapEditor, type MonacoWorkerLoaders } from "fenrir-ts/editor";

// Import Monaco workers (Vite-specific - adjust for your bundler)
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Initialize game engine
const logger = new ConsoleLogger();
const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Bootstrap core engine systems
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  physics: createPhysicsSystem(),
  enableAnimations: true,
});

// Bootstrap the live editor with Monaco workers
await bootstrapEditor({
  engine,
  assets,
  logger,
  monacoWorkers: {
    jsonWorker: () => new jsonWorker(),
    cssWorker: () => new cssWorker(),
    htmlWorker: () => new htmlWorker(),
    tsWorker: () => new tsWorker(),
    editorWorker: () => new editorWorker(),
  },
  buildContext: () => ({
    scene: sceneManager.getActiveScene(),
    entities: sceneManager.getActiveScene().entityList,
    time: engine.getTime(),
    logger,
    events: eventBus,
    scenes: sceneManager,
    stop: () => engine.stop(),
  }),
});
```

**Step 3: HTML Setup**

```html
<div id="editor-container"></div>
<canvas id="canvas"></canvas>

<!-- Web Components Controls -->
<ed-control-bar></ed-control-bar>
<ed-error-modal></ed-error-modal>
```

**For Non-Vite Bundlers:**

If you're using webpack, esbuild, or another bundler, you'll need to configure Monaco workers differently:

- **Webpack:** Use [monaco-editor-webpack-plugin](https://github.com/microsoft/monaco-editor-webpack-plugin)
- **Others:** See [Monaco ESM Integration Guide](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md)

For a complete working Vite example, see the [Monaco Editor demo](./monaco-editor.html) in the repository.

---

## Key Goals

- **Modern TypeScript-first engine design**
- **Explicit, predictable architecture** (no magic)
- **Composable systems over inheritance**
- **Web-friendly runtime** (browser + worker compatible)
- **Engine-building playground** — not just a framework

Fenrir TS is intentionally opinionated in _structure_, but unopinionated in _what you build with it_.

---

## Architecture Overview

Fenrir TS is built around an **Entity–Component–System (ECS)** core.

- **Entities** are lightweight IDs
- **Components** are pure data
- **Systems** operate over queried component sets
- **Schedules** define _when_ systems run

The ECS implementation is heavily inspired by the **sparse-set model** used in [EnTT](https://github.com/skypjack/entt), adapted to fit JavaScript/TypeScript runtime constraints.

### Why Sparse Sets?

- Fast iteration over components
- Efficient add/remove operations
- Cache-friendly layouts (as much as JS allows)
- Simple mental model for engine programmers

---

## Core Concepts

### ECS

- Sparse-set component storage
- Typed component queries
- Explicit system execution order
- No reflection or runtime magic

### Systems & Scheduling

Systems are grouped into **schedules** such as:

- `Init`
- `PreUpdate`
- `Update`
- `PostUpdate`
- `Exit`

This makes execution order **explicit and debuggable**, rather than hidden behind callbacks.

```ts
game
  .addSystem(Schedule.Update, movementSystem)
  .addSystem(Schedule.Update, renderSystem, { after: "movementSystem" });
await game.run();
```

---

## Design Philosophy

Fenrir TS intentionally avoids:

- Class-heavy inheritance hierarchies
- Implicit global state
- Framework-driven control flow

Instead, it emphasizes:

- **Composition**
- **Explicit dependencies**
- **Clear ownership**
- **Data-oriented design**

---

## Inspiration

- [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine)
- [EnTT](https://github.com/skypjack/entt)

---

## License

MIT — use it, break it, learn from it.

## Model Licenses

Sample models are sourced from the [glTF Sample Models repository](https://github.com/KhronosGroup/glTF-Sample-Models).

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
| `fenrir-ts/2d` | The `pixi2d` renderer plugin, `Renderable2D`, 2D builder methods such as `renderSprite`, 2D texture loading |
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

`game.run()` resolves once `PreInit`, `Init` and `PostInit` have run and the first frame is scheduled. If any of them throws, the run rolls back: `Exit` systems and cleanups run, and `run()` rejects with the error. `game.stop()`, `game.pause()` and `game.resume()` control the loop.

`game.assets` is the asset store. The 2D texture methods come from `fenrir-ts/2d`:

```ts
import "fenrir-ts/2d";

const hero = game.assets.requestTexture2D("hero", "/sprites/hero.png");
hero.subscribe((state) => game.logger.info(`hero texture: ${state.status}`));
```

To keep a Pixi application your app already owns, pass it in. It must be initialized on the same canvas with its ticker stopped, and the game does not destroy it at exit. The plugin's `renderer` gives game code that draws with Pixi directly the application:

```ts
import type { Application } from "pixi.js";
import { createGame } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

declare const app: Application; // initialized by your app, with app.ticker.stop() called

const pixi = pixi2d({ application: app });
const game = await createGame({ canvas: app.canvas, plugins: [pixi] });
await game.run();
pixi.renderer.app.stage.addChild(myOverlay);
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

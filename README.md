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

Fenrir TS requires the following peer dependencies:

```bash
npm install three jolt-physics monaco-editor
```

Note: `monaco-editor` is only required if you're using the editor module (`fenrir-ts/editor`).

---

## Usage

You can import the entire package or use specific modules:

```ts
// Import everything
import * as Fenrir from 'fenrir-ts';

// Import only the core engine
import { Engine, EntityList, Schedule } from 'fenrir-ts/core';

// Import only the editor
import { bootstrapEditor } from 'fenrir-ts/editor';
```

### Basic Example

```ts
import {
  ConsoleLogger,
  Engine,
  EventBus,
  SceneManager,
  Schedule,
  Scheduler,
  bootstrapEngine,
} from "fenrir-ts/core";

// IMPORTANT: Ensure the canvas element exists in the DOM before bootstrapping
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

// Registers input, rendering, camera and skybox systems on the engine.
// Pass `enable2D: true` for the PixiJS renderer instead of Three.js.
bootstrapEngine(engine, logger, { canvas });

// Add your systems, then start the loop
engine.addSystems(Schedule.Update, [yourGameSystem]);
await engine.run();
```

### Components and systems

Define components with `defineComponent`, store them on entities, and query them from systems. Every system receives a `SystemCtx`. Its `signal` aborts when the engine stops, and `onCleanup` registers teardown for the current run.

```ts
import { Schedule, defineComponent, type SystemCtx } from "fenrir-ts/core";

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
    health.current = Math.min(health.max, health.current + time.deltaTime);
  });
}

engine.addSystem(Schedule.Init, spawnPlayer).addSystem(Schedule.Update, regenerate);
```

**Important:** The canvas element must exist in the DOM before calling `bootstrapEngine()`. If you're calling it in a script, either:

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
import {
  Engine,
  Scheduler,
  SceneManager,
  EventBus,
  ConsoleLogger,
  bootstrapEngine,
} from "fenrir-ts/core";
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
  enablePhysics: true,
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
engine
  .addSystems(Schedule.Init, [input.init, renderer.init])
  .addSystems(Schedule.Update, [movementSystem, renderSystem])
  .run();
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

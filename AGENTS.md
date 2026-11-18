# AGENTS.md

Instructions for an agent that works in this repository or uses the `fenrir-ts` package.
Everything here describes the code as it is. If the code and this file disagree, trust the code and fix this file.

## What Fenrir is

Fenrir TS is a TypeScript game engine built on a sparse-set ECS. It has a PixiJS 2D renderer and a Three.js 3D renderer.
It is being rebuilt as a 2D-first web engine. The plan, its decisions and its milestones are in [issue #12](https://github.com/Wolfleader101/fenrir-ts/issues/12).
The version is 0.x: breaking changes are allowed.

## Commands

The lockfile needs pnpm 10. If your `pnpm` is a different major version, run pnpm 10 through `dlx`:

```sh
pnpm dlx pnpm@10.32.1 install --frozen-lockfile --ignore-scripts --node-linker hoisted
pnpm dlx pnpm@10.32.1 run test:run     # vitest run, all tests once
pnpm dlx pnpm@10.32.1 run type-check   # tsc --noEmit over src and tests
pnpm dlx pnpm@10.32.1 run build:lib    # library build into dist/
pnpm dlx pnpm@10.32.1 run dev          # Vite dev server for the demos, http://localhost:5173
```

Run one test file with `pnpm dlx pnpm@10.32.1 exec vitest run tests/core/Scheduler.test.ts`.
Demo pages are the `*.html` files at the repo root, for example `/pixi2d.html`. Their code is in `src/demos/`.

### Known failures on `main`

These fail before you change anything. Do not treat them as your breakage, and do not add to them.

- `type-check` reports 211 errors, all in `tests/`, `src/demos/` and `src/editor/`. Fixed by [#20](https://github.com/Wolfleader101/fenrir-ts/issues/20).
- `tests/core/Renderer/ThreeRenderer.test.ts` fails to load, so vitest reports 1 failed file. All tests that load pass. Fixed by [#21](https://github.com/Wolfleader101/fenrir-ts/issues/21).

Compare error and test counts before and after your change. There is no CI yet ([#22](https://github.com/Wolfleader101/fenrir-ts/issues/22)), so run the commands yourself.

## Entry points

| Import | Source | Contents |
| --- | --- | --- |
| `fenrir-ts` | `src/index.ts` | Everything in `core` and `editor` |
| `fenrir-ts/core` | `src/core/index.ts` | Engine, scheduler, ECS, events, assets, input, 2D and 3D rendering, physics components |
| `fenrir-ts/editor` | `src/editor/index.ts` | Monaco live code editor |

Consumers import only from these three paths. Never import from `fenrir-ts/dist/...` or a source file path.
Anything not exported from one of the index files is internal and can change without notice.
`fenrir-ts/core` currently imports every subsystem, including Three.js; splitting that up is planned work (see below).

Inside the repo, `@/` is an alias for `src/`.

## Core model

**Schedule.** `Schedule` in `src/core/Scheduler.ts` names the stages. `Engine.run()` awaits `PreInit`, `Init` and `PostInit` in order, then runs frames on `requestAnimationFrame`.
Each frame runs `PreUpdate`, then `Tick` zero or more times at the fixed `time.tickRate`, then `Update` and `PostUpdate`, then advances the event buffers. `Engine.stop()` awaits `Exit`.
`PreInit`, `Init`, `PostInit` and `Exit` may be async and are awaited. `PreUpdate`, `Tick`, `Update` and `PostUpdate` are sync: an async function there type-checks but is not awaited.

**Systems.** A system is a function `(ctx: SystemCtx) => void`, registered with `engine.addSystem(stage, fn)` or `addSystems(stage, [fns])`. Systems in a stage run in registration order.
`SystemCtx` (`src/core/SystemCtx.ts`) gives `time`, `events`, `logger`, `scenes`, `scene`, `entities` and `stop()`.
It also always has `signal`, an `AbortSignal` that aborts when the run stops, and `onCleanup(fn)`, which registers teardown for this run. Cleanups run in reverse order after the `Exit` systems.

**Components.** `defineComponent<T>(name)` returns a typed key. Set data with `entities.set(entity, Type, value)` and read it with `get`, `tryGet` and `has`.
Query with `entities.each(QUERY, (entity, ...components) => {})`. Views are cached by the query array's identity, so keep each query tuple in a module-level constant. An inline `[A, B] as const` creates a new array, and a new view, every call.

**Events.** `defineEvent<T>(name)` returns a typed key. `events.send(Type, payload)` queues an event. The bus keeps two frames of events: the frame an event is sent in and the next one.
`events.createReader(Type)` returns a reader whose `read()` returns only events it has not returned before. Create one reader per consumer, once, not inside a system. `events.read(Type)` returns everything retained, so it can return the same event in two frames.

```ts
import { Engine, EventBus, NullLogger, SceneManager, Schedule, Scheduler, defineComponent, defineEvent } from "fenrir-ts/core";
import type { SystemCtx } from "fenrir-ts/core";

type Health = { current: number; max: number };
const Health = defineComponent<Health>("myGame.Health");
const Damaged = defineEvent<{ amount: number }>("myGame.damaged");

// Keep the query tuple in a constant: views are cached by array identity.
const HEALTH_QUERY = [Health] as const;

const logger = new NullLogger();
const events = new EventBus();
const engine = new Engine({
  scheduler: new Scheduler(),
  sceneManager: new SceneManager(logger),
  events,
  logger,
});

// Create each reader once. It returns only events it has not returned before.
const damaged = events.createReader(Damaged);

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

engine
  .addSystem(Schedule.Init, spawnPlayer)
  .addSystem(Schedule.Init, listenForKeys)
  .addSystem(Schedule.Update, applyDamage);
await engine.run();
```

This example runs in `tests/agentsExample.test.ts`. Change both together.
To get renderer, input and camera systems, `bootstrapEngine(engine, logger, { canvas })` registers them; pass `enable2D: true` for PixiJS. See `src/core/Bootstrap.ts`.

## Naming rule

Component and event identity is the name, through `Symbol.for`. Two `defineComponent` or `defineEvent` calls with the same name return the same key and share storage.
So prefix every name with a namespace for your game or library, such as `myGame.Health`. Names starting with `fenrir.` are reserved for the engine. Engine code uses them, for example `fenrir.Transform` and `fenrir.input.keyDown`.

## Frozen areas

These are kept working and tested, but get no new features. Fix bugs in them; do not extend them.

- 3D renderer: `src/core/Renderer/`
- Camera: `src/core/Camera/`
- Skybox: `src/core/Skybox/`
- Animation: `src/core/Animation/`
- Physics (Jolt): `src/core/Physics/`
- Editor (Monaco): `src/editor/`

New work goes into the 2D path: `src/core/Renderer2D/`, input, ECS, scheduling and events.

## Changing the engine

- Tests live in `tests/`, mirroring `src/`: `src/core/ECS/View.ts` is tested in `tests/core/ECS/View.test.ts`. Vitest runs in jsdom with globals on. Shared helpers are in `tests/utils/testHelpers.ts`.
- Every behaviour change needs a test that fails without it.
- `tests/publicApi.test.ts` exercises the core entry point the way a consumer does. Extend it when you change public API.
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

- Entry points `fenrir-ts/2d`, `fenrir-ts/ui`, `fenrir-ts/3d` and `fenrir-ts/physics`
- `createGame`, `createTestGame` and a headless `step`
- Resources (`defineResource`), states (`defineState`, `inState`, `onEnter`), named systems and run conditions
- `inspect()`, viewport scaling, input actions, canvas UI, audio, timers and storage

Today a game constructs `Engine`, `Scheduler`, `SceneManager` and `EventBus` itself, as in the example above.

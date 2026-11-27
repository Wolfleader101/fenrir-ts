# Core: plugins, systems, resources, states, events, time

The full rules for how a game is put together and how its systems are ordered. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Plugins

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

## Components and systems

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

## Named systems

A system's name is its function name, or the `name` option. An anonymous function with no `name` throws, and two systems in one stage cannot share a name. A minifier renames functions, or drops the name of a function expression, so a production build needs names kept (Vite: `esbuild: { keepNames: true }`) or a `name` on every system; without that it throws or `before` / `after` stop matching. Within a stage, systems run in registration order unless `before` or `after` says otherwise. `runIf` is checked each time the system would run.

```ts
import { Schedule, type SystemCtx } from "fenrir-ts";

function movePlayer(_ctx: SystemCtx): void {}
function applyDamage(_ctx: SystemCtx): void {}
function applyDamageV2(_ctx: SystemCtx): void {}
let paused = false;

game
  .addSystem(Schedule.Update, applyDamage, { after: "movePlayer", runIf: () => !paused })
  .addSystem(Schedule.Update, movePlayer, { before: "myGame.trace" })
  .addSystem(Schedule.Update, (ctx) => ctx.logger.trace("frame"), { name: "myGame.trace" });

// While the game runs, both take effect from the next frame.
game.replaceSystem("applyDamage", applyDamageV2); // keeps its position and options
game.removeSystem("myGame.trace");
```

Order is resolved when `run()` starts. A `before` or `after` that names a system not in the stage, or a cycle, makes `run()` reject with an error that names both systems. While the game runs, `addSystem`, `replaceSystem` and `removeSystem` check the new order at once and throw at the call if it does not resolve. `replaceSystem` and `removeSystem` act on the name in every stage that has it.

Engine systems are named `fenrir.<module>.<stage>`, for example `fenrir.pixi.postUpdate` (writes transforms to nodes, then renders), `fenrir.input.dom.init` and `fenrir.physics.tick`.

## Time and random

Read time and draw random numbers from the context, not from `Date.now()`, `performance.now()` or `Math.random()`, so a game replays exactly under test.

- `time.delta`: seconds since the last frame, clamped. `time.fixedDelta`: seconds per `Tick`, settable, 1/60 by default. `time.elapsed`: seconds of game time since `run()`, excluding pauses. `time.now()`: wall-clock milliseconds, like `Date.now()`.
- `random.next()` is in [0, 1), `random.int(min, max)` includes both ends, and `random.pick(items)` returns one item and throws on an empty list. The generator is mulberry32.
- `createGame({ seed })` seeds `ctx.random` and `game.random`. Without a seed it is seeded from the clock; `game.random.seed` reports the seed either way, so log it to replay a run. Stopping and running a game again continues the sequence.
- `Time` reads only the `Clock` it is given: `{ monotonic(), now() }`. `Engine` takes one as `clock`; the default is the browser's.
- `createGame({ maxFrameDelta })` caps `time.delta`, in seconds: after a stall (a background tab, a debugger) a frame moves the game at most this much. It defaults to 0.25; a game whose motion must not jump far passes a smaller cap, such as `1 / 20`. `createTestGame` takes it too.

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

## Resources

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

`resources.has(Resource)` says whether a resource has a value, without running its factory. A plugin's resource has one once the plugin is installed, so game code and tests use it to work with or without an optional plugin:

```ts
import { MotionSettings, type SystemCtx } from "fenrir-ts";
import { AudioState } from "fenrir-ts/audio";

function openMenu({ resources }: SystemCtx): void {
  if (resources.has(AudioState)) resources.get(AudioState).buses.music!.volume = 0.3; // only with audio()
  if (resources.has(MotionSettings)) resources.get(MotionSettings).pausedAll = true; // only with motion()
}
```

## States

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

## Events

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
// Send from a system or, while the game runs, from page UI outside the canvas, such as an HTML button.
// (Input on the canvas itself is read with defineAction, never with DOM listeners.)
document.querySelector("#goal")?.addEventListener("click", () => game.events.send(Scored, { points: 10 }));
off(); // removes the game.on listener early
```

- `game.on(Event, handler)` is setup, like `addSystem`: the listener stays across `stop()` and `run()` until the function it returns is called.
- `ctx.events.on(Event, handler)` belongs to the run it is called in and is removed when that run stops, after its `Exit` systems and cleanups. Calling `events.on` with no run going throws; use `game.on` there.
- Listeners are called synchronously inside `send`, in registration order, after the event is buffered, with the current run's `ctx`. A `send` before the first run or after a stop only buffers the event.
- A listener may send events; they are delivered at once, depth first. A listener removed during delivery is not called after that; one added during delivery receives only later events. Events nested 32 deep stop being delivered, with an error logged.
- A listener that throws, or an async one that rejects, is logged through the game's logger with the event name; the other listeners and the sender carry on. Async listeners are not awaited.
- Readers are unchanged: the bus keeps two frames of events, and `createReader(Event).read()` returns each one once.

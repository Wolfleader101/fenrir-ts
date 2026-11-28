# Testing and inspecting a game

The full rules for `createTestGame`, `step`, and `inspect(game)`. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Testing a game

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
- `dt` is at most 0.25 s, the engine's frame-delta clamp (`maxFrameDelta`, which `createTestGame` takes as an option). A longer `dt` throws rather than silently simulating less than you asked: to advance a second, write `step(1 / 60, 60)`. A frame still runs at most `maxTicksPerFrame` ticks (8 by default), as in the browser, so `step(0.25)` runs 8 ticks of 1/60 and drops the rest, as a long browser frame does. `createTestGame({ seed, fixedDelta, maxTicksPerFrame })` takes the same fixed-step options as `createGame`: with `fixedDelta: 1 / 120, maxTicksPerFrame: 30`, `step(0.25)` runs 30 ticks.
- Each stepped frame moves `time.now()` by `dt`, starting from `now` (default 0). `time.elapsed` and `states.timeIn` count stepped time only; `clock.advance(ms)` moves `time.now()` alone.
- `seed` is required. Nothing in a test game reads `performance.now()`, `Date.now()` or `requestAnimationFrame`.
- A test game has no canvas, so a plugin that reads `game.canvas`, such as `pixi2d`, throws when it installs, saying so. Plugins that only add systems, resources or listeners install as usual. A system that draws with Pixi needs the renderer and is tested in the browser; keep drawing out of gameplay systems so they run in both.
- A test game has `start()` where a `Game` has `run()`, and no `pause` or `resume`: between steps it is never running, so there is nothing to pause.
- `game.input` has `press(action)`, `release(action)`, `pointerDown(x, y)`, `pointerMove(x, y)`, `pointerUp()`, `pointerCancel()`, `focus()` and `blur()`, which take effect on the next `step`: see [Input](input.md#input).
- A system that throws stops the game, and the error propagates from `step`. A system that calls `ctx.stop()` ends the remaining frames of the `step` call.

`game.step` also exists on a `Game` made by `createGame`, for frame-by-frame debugging: call `game.pause()` first. Each step advances the game by `dt` whatever the real time, and runs every system, so the `pixi2d` renderer draws each stepped frame. Calling `step` before `run()` or while running throws and says to pause first.

## Inspecting a game

`inspect(game)` returns what the game is doing as plain JSON: the frame, time, the schedule, states, resources, the active scene's entities and the input. It works on a `Game` and a `TestGame`, never throws, and works before `run()`, while paused and after `stop()`. It is a function rather than a method, so a game that never calls it ships none of the snapshot code. `exposeInspector(game)` puts the same function on `window.__FENRIR__.inspect`, for browser tests and agents.

```ts
import { Schedule, createGame, defineComponent, defineResource, exposeInspector, inspect, type GameSnapshot, type SystemCtx } from "fenrir-ts";

const Health = defineComponent<{ current: number }>("myGame.Health");
const Scores = defineResource("myGame.Scores", () => new Map<string, number>());

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas });
exposeInspector(game); // also on window.__FENRIR__

game.addSystem(Schedule.Init, function spawn({ entities, resources }: SystemCtx) {
  entities.set(entities.createEntity(), Health, { current: 3 });
  resources.get(Scores).set("ana", 10);
});
await game.run();

const snapshot: GameSnapshot = inspect(game);
const [player] = snapshot.entities;
console.log(player?.components["myGame.Health"]); // { current: 3 }
console.log(snapshot.resources["myGame.Scores"]); // { $type: "Map", entries: [["ana", 10]] }
```

```json
{
  "frame": 120,
  "time": { "elapsed": 2.0, "delta": 0.016 },
  "schedule": { "preInit": [], "init": ["fenrir.pixi.init", "spawn"], "update": ["move"], "postUpdate": ["fenrir.pixi.postUpdate"], "...": [] },
  "states": { "myGame.Phase": { "value": "playing", "timeIn": 1.5 } },
  "resources": { "myGame.Scores": { "$type": "Map", "entries": [["ana", 10]] } },
  "entities": [
    { "id": 0, "name": "Entity 0", "parent": null, "components": { "fenrir.Transform": { "position": { "x": 0, "y": 0, "z": 0 }, "...": {} }, "myGame.Health": { "current": 3 } } }
  ],
  "input": { "held": ["KeyA", "pointer.primary"], "pointer": { "x": 320, "y": 180, "down": true, "inside": true, "cancelled": false }, "focused": true }
}
```

- A test can `step` a `TestGame` and then assert on `inspect(game)`. Stepped frames count like browser frames.
- A shipped game that wants `window.__FENRIR__` only in a debug build calls `exposeInspector` behind a build flag, for example `if (import.meta.env.DEV) exposeInspector(game)`; the bundler drops the inspection code from the production build.
- `frame` counts frames since the current run started: 0 during startup, kept after `stop()`, back to 0 at the next `run()` (or `start()` on a test game). `time.elapsed` and `time.delta` are as of the start of the latest frame, so two calls with no frame between them return equal snapshots.
- `schedule` lists system names per stage in run order. `states` lists the states the game has used (read, set or hooked) with their value and seconds in it. `resources` lists the resources that have a value.
- `entities` are the active scene's, by id. `id` and `parent` are entity handles, the values `entities.get` takes; `parent` is null for a root. The engine's `fenrir.Name` and `fenrir.Relationship` are folded into `name` and `parent`; `fenrir.Transform` stays in `components`.
- Keys of `states`, `resources` and `components` are the names given to `defineState`, `defineResource` and `defineComponent`, sorted. A component keyed by a symbol `defineComponent` did not make appears as `Symbol(description)`.
- `input` is what the latest frame latched, the same answers `game.input` gave its systems: `held` lists the bindings held, sorted (`KeyboardEvent.code` values such as `"KeyA"`, and `"pointer.primary"` or `"pointer.secondary"`), `pointer` is `game.input.pointer` and `focused` is `game.input.focused`. Before the first frame nothing is held. A tap between two frames is held in the frame it is pressed in, and a binding hidden by `consume` or `consumePointer` is still listed while it is down. Actions are not listed by name, since `defineAction` registers nothing: match `held` against your actions' bindings. On a test game, a `press` or `pointerMove` shows only after the next `step`.
- With `exposeInspector` called for two games on one page, the last one owns `window.__FENRIR__`, with a warning. It stays after the game stops. Without a `window`, it does nothing.

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
| any other class instance, DOM node, `WeakMap`, `Promise`... | `{ "$type": "Container" }`: the constructor name, which a minifier may shorten. One with a non-empty string `label` field (every Pixi display object has one) also gets it: `{ "$type": "Container", "label": "myGame.ship" }`, a name that survives minification |
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

**For agents and browser tests:** to check what a game is doing, assert on `inspect()` rather than on pixels. In a unit test call `inspect(game)`; in a Playwright test call `exposeInspector(game)` in the game and read `await page.evaluate(() => window.__FENRIR__.inspect())`. Compare whole snapshots, or the entities, states and resources you care about: two snapshots of the same game state are identical, so they can be snapshot-tested.

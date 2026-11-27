---
name: fenrir
description: Build browser games with the Fenrir TS engine (the fenrir-ts package) - 2D on PixiJS with an ECS, named systems in stages, events, states, input actions, timers and tweens, asset manifests, storage, audio and UI controls, tested headless with createTestGame and step. Use when writing, changing or testing game code that imports fenrir-ts, fenrir-ts/2d, fenrir-ts/ui or fenrir-ts/audio.
---

# Building a game with Fenrir

This guide is for code that **uses** the engine. Everything here comes from the installed package; you never need the engine's source.

- `references/` has the full rules for each service: [core](references/core.md) (systems, events, resources, states, time), [testing](references/testing.md) (test games, `inspect`), [input](references/input.md), [2d](references/2d.md) (`pixi2d`, design frame, layers, nodes), [motion](references/motion.md), [assets](references/assets.md), [storage](references/storage.md), [audio](references/audio.md), [ui](references/ui.md). Read the one for a service before using it.
- `api/` has every export of every entry point with its signature and TSDoc: [`fenrir-ts`](api/fenrir-ts.md), [`fenrir-ts/2d`](api/2d.md), [`fenrir-ts/ui`](api/ui.md), [`fenrir-ts/audio`](api/audio.md). Search it before guessing a name or an option. The `.d.ts` files under `dist/` say the same with types.
- Import only from `fenrir-ts`, `fenrir-ts/2d`, `fenrir-ts/ui`, `fenrir-ts/audio` (and the frozen `fenrir-ts/3d`, `fenrir-ts/physics`). Never from `fenrir-ts/dist/...` or a source path. Peer: `pixi.js` 8 for `/2d` and `/ui`.

## Project setup

- **A new game:** `npx fenrir-ts@latest create <dir>`, then `npm install`. It copies the starter game in this package (`node_modules/fenrir-ts/templates/game-2d/`), already set up as below: gameplay in `src/game.ts`, drawing in `src/main.ts`, a headless test in `tests/`, a Playwright test in `e2e/`, CI, and `AGENTS.md`. Extend it rather than starting over. The rest of this list is for adding Fenrir to an existing project.
- **Minified builds lose function names**, and a system's name is its function's name: with Vite, set `esbuild: { keepNames: true }` in `vite.config.ts` (the starter game does), or give every system `{ name }`. Otherwise the production build throws "Cannot add an anonymous system", or `before` / `after` stop matching.
- `package.json`: `"type": "module"`; dependencies `fenrir-ts` and `pixi.js` (8.x, for `/2d` and `/ui`), installed with `npm install fenrir-ts pixi.js`; dev dependencies `typescript` and `vitest` (and a bundler such as Vite for the browser build). Every other peer is optional and needed only by the frozen entries (`three`, `jolt-physics`), so the 2D path installs nothing else and gets no peer warnings. At 0.x a breaking change bumps the minor version: pin `~0.x.y` and read `node_modules/fenrir-ts/CHANGELOG.md` before upgrading.
- `tsconfig.json`: `"module": "ESNext"`, `"moduleResolution": "Bundler"` (the entry points are package `exports` subpaths), `"target": "ES2022"` (top-level `await`), `"lib": ["ES2022", "DOM", "DOM.Iterable", "ESNext.Disposable"]` (the types of Vitest 4 and later use `Disposable`; the same file works with TypeScript 5.9 and 7), `"strict": true`, `"skipLibCheck": true`.
- Vitest needs no environment and no config for headless tests: `createTestGame`, `ui({ root })`, Pixi `Container`/`Graphics`/`Sprite` and `Texture.WHITE` all work in the default `node` environment. Use `jsdom` only for code that touches `document` or `window`.

## The model in one page

- **A game is a schedule of named systems.** A system is a function `(ctx: SystemCtx) => void` added with `game.addSystem(stage, fn, options?)`. Everything the game does happens in a system, a state hook or an event listener, each of which gets a `ctx`.
- **Stages.** Startup runs once per `run()`: `PreInit`, `Init`, `PostInit`, each awaited (systems there may be `async`). Then every frame: input is latched, `PreUpdate`, `Tick` zero or more times at the fixed step, `Update`, `PostUpdate`, then the event buffers advance. `stop()` runs `Exit`, then cleanups. Per-frame systems must be synchronous.
- **Order within a stage** is registration order, except where `before` / `after` (system names in the same stage) say otherwise. Plugins register first, so **engine systems run before yours in every stage unless you say `before`**. Know the engine's names (table below).
- **Data.** Per-entity data is in components (`defineComponent`, `ctx.entities`), one-per-game values in resources (`defineResource`, `ctx.resources`), modes in states (`defineState`, `ctx.states`). Systems talk through events (`defineEvent`, `ctx.events`). Every name is namespaced: `myGame.Health`. `fenrir.*` is the engine's.
- **Features are plugins, and opt-in.** `pixi2d()`, `motion()`, `storage()`, `audio()` and `ui()` go in `createGame({ plugins })`. A game that does not import one ships none of its bytes. Each plugin's resource is set when it installs (inside `createGame`), so it exists in every system and state hook, the initial enter hooks included; a game that may run without a plugin checks with `resources.has(X)`.
- **The engine owns the DOM.** It listens to the canvas for keys and pointers, to the window for resizes, to page visibility for audio, and it makes the canvas focusable (`tabindex="0"`). It does not focus the canvas on load: keys reach the game only after the first click or tap on the canvas, a Tab into it, or a `canvas.focus()` call from the page (a keyboard-only start screen calls it after `run()`). Game code reads `ctx.input`, `Viewport` and resources; it never adds DOM listeners for input on the canvas or the window (page UI outside the canvas, such as an HTML button, may call `game.events.send`), never uses Pixi's events (`eventMode`, `on("pointerdown")`) or Pixi's accessibility, and never reads `KeyboardEvent`s.
- **Deterministic.** Read `ctx.time` and `ctx.random`, never `Date.now()`, `performance.now()`, `Math.random()`, `setTimeout` or `setInterval`. Then `createTestGame({ seed })` and `game.step(dt, frames)` run the same systems headless and replay exactly.
- **Lifetime.** Entities, resources, states' hooks, `game.on` listeners and loaded assets belong to the game and survive `stop()` then `run()`. Anything a run acquires (a DOM element, a listener, a timer of the browser's) is released through `ctx.onCleanup` or `ctx.signal`, so a failed startup rolls it back.

### Engine systems, and how to order against them

| System | Stage | What it does | Put yours |
| --- | --- | --- | --- |
| `fenrir.storage.preInit` | PreInit | awaits an async storage backend's `hydrate()` (only with one) | after it, by default |
| `fenrir.pixi.init`, then `fenrir.viewport.init` | Init | initialises the Pixi application and the design frame | Init systems that touch the renderer: after them, by default |
| `fenrir.ui.init`, `fenrir.audio.init` | Init | focus ring, canvas aria; audio context | |
| `fenrir.ui.postInit` | PostInit | writes the focus ring and aria for controls drawn at Init | a PostInit system that draws controls calls `syncUi(ctx)` |
| `fenrir.viewport.preUpdate` | PreUpdate | applies a resize before anything reads `Viewport` | |
| `fenrir.motion.preUpdate` | PreUpdate | advances timers and tweens by `time.delta` | a pause that must hold this frame: `{ before: "fenrir.motion.preUpdate" }` |
| `fenrir.ui.preUpdate` | PreUpdate | hit-tests controls, handles Tab/arrows/Enter/Escape, **consumes** what it used | gameplay that must see a press first: `{ before: "fenrir.ui.preUpdate" }` |
| `fenrir.ui.postUpdate` | PostUpdate | focus ring, cursor, aria | |
| `fenrir.audio.postUpdate`, `fenrir.storage.postUpdate` | PostUpdate | applies volumes; saves `persistResource` fields | |
| `fenrir.pixi.postUpdate` | PostUpdate | writes `Transform2D`/`Display2D` to nodes, then **renders** | change visuals in `Update`; a `PostUpdate` system's changes show next frame unless `{ before: "fenrir.pixi.postUpdate" }` |
| `fenrir.pixi.exit`, `fenrir.storage.exit` | Exit | unmounts and destroys nodes; final save | |

Among plugins in one stage, order follows the `plugins` array. `inspect(game).schedule` lists the real order.

## A minimal game, its test and its entry

Split gameplay from drawing: gameplay systems read and write components, resources and states, so they run in a test game; drawing systems touch Pixi and run only in the browser. One function registers the gameplay on either kind of game (`GameBase`).

```ts
// --- game.ts: gameplay, no Pixi, runs in the browser and in tests ---
import { Schedule, defineAction, defineEvent, defineResource, defineState, inState, type GameBase, type SystemCtx } from "fenrir-ts";

export const Phase = defineState("myGame.Phase", { values: ["ready", "playing", "over"], initial: "ready" });
export const Score = defineResource("myGame.Score", () => ({ points: 0, timeLeft: 10 }));
export const Scored = defineEvent<{ points: number }>("myGame.scored");
export const Tap = defineAction("myGame.tap", ["pointer.primary", "Space"]);

function start({ input, states }: SystemCtx): void {
  if (!input.pressed(Tap)) return;
  states.set(Phase, "playing"); // applied when this returns, so `play` runs in this same frame...
  input.consume(Tap); // ...and would count this tap as a point without this
}

function play({ input, events, resources, states, time }: SystemCtx): void {
  const score = resources.get(Score);
  score.timeLeft -= time.delta;
  if (input.pressed(Tap)) {
    score.points += 1;
    events.send(Scored, { points: 1 });
  }
  if (score.timeLeft <= 0) states.set(Phase, "over");
}

export function addGameplay(game: GameBase): void {
  game
    .onEnter(Phase, "playing", ({ resources }) => resources.set(Score, { points: 0, timeLeft: 10 }))
    .addSystem(Schedule.Update, start, { runIf: inState(Phase, "ready", "over") })
    .addSystem(Schedule.Update, play, { runIf: inState(Phase, "playing") });
}

// --- main.ts: the browser entry ---
import { createGame } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { Text } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 640 }, background: 0x102030, layers: ["world", "hud"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
addGameplay(game);

const label = new Text({ text: "", style: { fill: 0xffffff, fontSize: 24 } });
game
  .addSystem(Schedule.Init, function mountHud() {
    pixi.renderer.layer("hud").addChild(label); // after fenrir.pixi.init: the layer exists
  })
  .addSystem(Schedule.Update, function drawHud({ resources, states }: SystemCtx) {
    const { points, timeLeft } = resources.get(Score);
    label.text = states.get(Phase) === "playing" ? `${points} pts, ${Math.ceil(timeLeft)} s` : "Tap to play";
  }, { after: "play" });
await game.run();
canvas.focus(); // so Space works before the first tap

// --- game.test.ts: Vitest, headless ---
import { createTestGame, inspect } from "fenrir-ts";
import { expect, it } from "vitest";

it("scores taps until time runs out", async () => {
  const game = await createTestGame({ seed: 1 });
  addGameplay(game);
  await game.start();
  game.input.press(Tap);
  game.step(); // the press is seen in this frame
  game.input.release(Tap);
  game.step();
  expect(game.states.get(Phase)).toBe("playing");
  game.input.press(Tap);
  game.step();
  expect(game.resources.get(Score).points).toBe(1);
  game.step(1 / 60, 600); // ten seconds
  expect(inspect(game).states["myGame.Phase"]?.value).toBe("over");
  await game.stop();
});
```

Two things this shows. A state set in one system is live for the next system **in the same frame**, and that system sees the same input: consume what you have handled. And the test drives input with `press`/`release` and frames with `step`, never with timers.

Plugin order: `pixi2d` first, then `motion()`, `storage()`, `audio()`, and `ui({ pixi })` last (it must come after `pixi2d`; `motion()` before it makes timers advance before the kit's activations in `PreUpdate`). Hooks (`onEnter`, `onExit`) and `game.on` listeners may be anonymous; only systems need names.

The page needs `<canvas id="game"></canvas>`, a `<script type="module" src="/src/main.ts"></script>` (Vite) and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. With `design`, `pixi2d` sizes the canvas to the window itself.

## Systems and order

- Name every system: a named `function`, or `{ name: "myGame.thing" }` for an arrow. An anonymous function with no name throws; two systems with one name in a stage throw.
- `before` / `after` take names in the **same stage**. An unknown name or a cycle makes `run()` reject naming both. `runIf: inState(State, ...values)` gates by state; combine conditions with a function, `runIf: (ctx) => inState(Phase, "playing")(ctx) && inState(Pause, "running")(ctx)`.
- Helpers of your own that call engine functions take the narrow context those functions name, or a whole `SystemCtx`: `AssetCtx` (manifests), `MotionCtx` (timers, tweens), `StorageCtx` (storage), `AudioCtx`, `UiCtx`. A `Pick<SystemCtx, "assets">` is not enough for `getAsset`.
- Startup systems may be `async` and are awaited. **Per-frame systems must not be `async`**: the promise is dropped.
- `ctx.stop()` stops the game. `game.isRunning()` after `await game.run()` says whether startup stopped it.

Do: put drawing that depends on this frame's gameplay `{ after: "play" }` in `Update`. Don't: draw in `PostUpdate` and wonder why it lags a frame, or move work into a stage of its own to get order: use `before`/`after`.

## Events and listeners: reader, run-scoped, app-scoped

```ts
import { Schedule, createTestGame, defineEvent, type SystemCtx } from "fenrir-ts";

const Hit = defineEvent<{ damage: number }>("myGame.hit");
const game = await createTestGame({ seed: 1 });

// 1. Reader: gameplay that changes state, in schedule order. Create it once, at setup.
const hits = game.events.createReader(Hit);
function applyHits({ logger }: SystemCtx): void {
  for (const { damage } of hits.read()) logger.info(`took ${damage}`); // each event once
}

// 2. App-scoped listener: setup code, stays across stop() and run(). Returns an off function.
const off = game.on(Hit, ({ damage }, ctx) => ctx.logger.debug(`sound for ${damage}`));

// 3. Run-scoped listener: added inside a system, removed when this run stops.
function showHitNumbers({ events }: SystemCtx): void {
  events.on(Hit, ({ damage }) => void damage);
}

game.addSystem(Schedule.Update, applyHits).addSystem(Schedule.Init, showHitNumbers);
await game.start();
game.events.send(Hit, { damage: 2 });
game.step();
off();
await game.stop();
```

- Listeners run synchronously inside `send`, only while a run is going. Use them for side effects (sound, analytics); use a reader when the result changes game state.
- `ctx.events.on` with no run going throws: at setup use `game.on`. Never call `game.on` inside a system: it adds a listener every frame and never removes it.
- Never create a reader inside a system, and never use `events.read(Type)` for gameplay: it returns everything buffered, so the same event twice across two frames.
- Do not write your own pub/sub, `EventTarget`, or abort-signal plumbing for listeners: lifetime is handled.

## Time, random, timers

`ctx.time.delta` (seconds, clamped to `maxFrameDelta`, default 0.25), `time.fixedDelta` (per `Tick`, 1/60), `time.elapsed`, `time.now()` (epoch ms). `ctx.random.next()`, `int(min, max)` (inclusive), `pick(items)`; seed with `createGame({ seed })`. `states.timeIn(State)` is seconds in the current value. For "do X in 2 seconds" use a timer from `motion()` (below) or count `time.delta`; never `setTimeout`.

## States

`states.set` is queued and applied **after the current system returns**: exit hooks, enter hooks, then the next system sees the new value. A run starts every state at `initial` and runs its enter hooks **before the first `PreInit` system**, so an enter hook of the initial value cannot use the renderer; start in a `loading` value and `set` the real one from `PostInit`. Stopping runs no exit hooks. Full rules: [references/core.md](references/core.md#states).

## Input

```ts
import { Schedule, createTestGame, defineAction, type SystemCtx } from "fenrir-ts";

const Jump = defineAction("myGame.jump", ["Space", "ArrowUp", "pointer.primary"]);
const Pause = defineAction("myGame.pause", ["Escape", "KeyP"]);

function menuBar({ input }: SystemCtx): void {
  // A tap in the top bar belongs to the menu: hide it from systems after this one.
  if (input.pressed(Jump) && input.pointer.y < 60) input.consumePointer();
}
function player({ input, logger }: SystemCtx): void {
  if (input.pressed(Jump)) logger.info("jump");
  if (input.pressed(Pause)) input.consume(Pause);
}

const game = await createTestGame({ seed: 1 });
game.addSystem(Schedule.Update, menuBar, { before: "player" }).addSystem(Schedule.Update, player);
await game.start();
game.input.pointerDown(100, 30); // logical units; takes effect on the next step
game.step();
await game.stop();
```

- Bindings are `KeyboardEvent.code` values (`"KeyA"`, `"Space"`, `"ArrowLeft"`, `"Enter"`) or `"pointer.primary"` / `"pointer.secondary"`. `"a"` or `"space"` is a compile error, and throws at `defineAction` if it slips through untyped.
- Input is latched once per frame: `pressed` / `released` are true for exactly one frame (exactly one `Tick`), `held` while any binding is down. A tap between two frames is never lost.
- **What consume hides, and for how long.** `consumePointer()` hides the pointer's press, hold and release from **systems that run after it, in this and later frames, until the pointer lifts**; the next press is seen again. `consume(action)` does the same for the bindings of that action that went down this frame, keys included, so other actions on those keys are hidden too. It hides nothing from systems that already ran: the consumer must be ordered first (`before`), or in `PreUpdate` when gameplay reads `Tick`.
- `ctx.input.pointer` is `{ x, y, down, inside, cancelled }` in **logical units** (the design frame). `input.edges(actions)` lists this frame's presses in arrival order, for typed sequences.
- Inside-the-event work only: `input.onDown(action, handler)` (return `true` to `preventDefault`), `input.onGesture(handler)` (audio unlock, fullscreen). Both are setup, kept across runs.
- Test with `game.input.press(action)`, `release(action)`, `pointerDown(x, y)`, `pointerMove`, `pointerUp()`, `pointerCancel()`, `focus()`, `blur()`. Full rules: [references/input.md](references/input.md).

Don't: `window.addEventListener("keydown", ...)`, `canvas.onclick`, `sprite.eventMode = "static"`, `sprite.on("pointertap")`. Do: an action, read in a system.

## 2D: `pixi2d`, the design frame, layers, nodes

- `pixi2d({ design: { width, minHeight }, layers, background })`. With `design`, you draw in **design units**: the width is fixed, the logical height grows from `minHeight` to fill the screen. Read the current size from `ctx.resources.get(Viewport)` (`width`, `height`, `scale`, `insets`...), and redraw on `ViewportResized`. The first `ViewportResized` is sent inside `fenrir.viewport.init`, before your `Init` systems can listen, so lay out once from `Viewport` when you mount, then listen (as below). The frame already sits inside the safe area (`safeArea: true` is the default), so a HUD at the frame's top edge clears a notch. Without `design`, units are CSS pixels.
- Game content goes in `pixi.renderer.root` (design units) or a named layer, `pixi.renderer.layer("hud")`, declared back to front in `layers`. Full-bleed backgrounds go in `pixi.renderer.backdrop` (CSS pixels, behind everything). Layer names starting with `fenrir.` are reserved.
- `Transform2D` and `Display2D` are core data, exported by both `fenrir-ts` and `fenrir-ts/2d` (the same values); gameplay that must run headless imports them from `fenrir-ts`.
- Entities: `EntityBuilder.create().transform2D(x, y).with(PixiNode, { node, layer }).spawn(ctx.entities)`. Move them by writing `Transform2D` (`x`, `y`, `rotation`, `scaleX`, `scaleY`) and `Display2D` (`alpha`, `visible`); the renderer copies them to the node every frame. Removing the entity or `PixiNode` destroys the node (`keep: true` only unmounts). A node with child entities should be a plain `Container`.
- Pixi objects you add to `root` yourself are yours: you destroy them.
- Headless gameplay that spawns visible things: gameplay spawns entities with `transform2D()`, `display2D()` and its own components (`.with(Card, { face: 3 })`); a browser-only `Update` system gives each one that has no `PixiNode` yet its node (`entities.set(entity, PixiNode, { node, layer })`), so the same gameplay runs in tests with no Pixi objects.

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { PixiNode, Transform2D, Viewport, ViewportResized, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, layers: ["world", "hud"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const FISH = [Transform2D] as const; // query tuples live at module level: views are cached by identity
const frame = new Graphics();

function drawFrame({ width, height }: Viewport): void {
  frame.clear().rect(0, 0, width, height).stroke({ color: 0xffffff, width: 2 });
}

function spawn({ entities, resources, events }: SystemCtx): void {
  pixi.renderer.layer("hud").addChild(frame);
  drawFrame(resources.get(Viewport));
  events.on(ViewportResized, drawFrame); // run-scoped
  const fish = new Graphics().circle(0, 0, 12).fill(0xffaa00);
  EntityBuilder.create().transform2D(100, 200).with(PixiNode, { node: fish, layer: "world" }).spawn(entities);
}

function swim({ entities, time }: SystemCtx): void {
  entities.each(FISH, (_entity, transform) => void (transform.x += 30 * time.delta));
}

game.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, swim);
await game.run();
```

Full rules: [references/2d.md](references/2d.md).

## Timers and tweens: `motion()`

```ts
import { EntityBuilder, MotionSettings, Schedule, TimerFired, TweenDone, addTimer, addTween, createTestGame, motion, type SystemCtx } from "fenrir-ts";
import { Display2D, Transform2D } from "fenrir-ts/2d";

const game = await createTestGame({ seed: 1, plugins: [motion()] });
const finished: string[] = [];
game.on(TweenDone, ({ name }) => void finished.push(name));
const fired = game.events.createReader(TimerFired);

function spawn(ctx: SystemCtx): void {
  const card = EntityBuilder.create().transform2D(0, 600).display2D({ alpha: 0 }).spawn(ctx.entities);
  addTween(ctx, card, Transform2D, { to: { y: 400 }, duration: 0.25, ease: "backOut", name: "myGame.settle" });
  addTween(ctx, card, Display2D, { to: { alpha: 1 }, duration: 0.25, delay: 0.1 });
  addTimer(ctx, card, "myGame.hint", { duration: 2, repeat: Infinity, group: "ambient" });
}

function onTimers({ logger }: SystemCtx): void {
  for (const { name, count } of fired.read()) logger.info(`${name} fired ${count} times`);
}

game.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, onTimers);
await game.start();
game.resources.get(MotionSettings).paused.ambient = true; // the hint timer waits
game.step(1 / 60, 30);
console.log(finished); // ["myGame.settle", "fenrir.Display2D:alpha"]
```

- Timers and tweens are data on the entity (`Timers`, `Tweens` components), advanced by `fenrir.motion.preUpdate` before your `PreUpdate`, `Update` and the renderer. Destroying the entity cancels them. A game-level timer (a round clock, a spawner) goes on an entity of its own: `addTimer(ctx, ctx.entities.createEntity(), "myGame.round", { duration: 30, state: [Phase, "playing"] })`.
- Timing: an entry added in a startup system or before a frame's `fenrir.motion.preUpdate` starts moving that frame; one added later in a frame (in `Update`, an `onActivate`, a state hook run there) starts the next frame. So a 1 s timer added at `Init` fires in the 60th `step(1 / 60)`, and one added in `Update` fires 60 frames after the frame that added it. `TimerFired` is sent inside `fenrir.motion.preUpdate`, so a reader in that frame's `Update` sees it.
- Read a running timer in a test from `inspect(game)`: `entities[i].components["fenrir.Timers"]["myGame.round"].remaining`.
- Pause with an entry's `paused`, a group (`MotionSettings.paused[group] = true`) or `MotionSettings.pausedAll`; reduced motion with `MotionSettings.reducedMotion`. `addTimer(..., { state: [Phase, "playing"] })` **removes** a timer when the state leaves that value, so a "paused" value of `Phase` would delete the round clock: keep pause in a state of its own (`defineState("myGame.Pause", { values: ["running", "paused"], initial: "running" })`) and pause timers with `pausedAll`.
- A pause set from a control's `onActivate`, a scope's `onClose` or a state hook they trigger runs inside `fenrir.ui.preUpdate`, after `fenrir.motion.preUpdate`, so it holds from the next frame; test it with one more `step()`.
- `addTimer` and `addTween` throw without the plugin. Full rules: [references/motion.md](references/motion.md).

## Assets: manifests, bundles, one asset at a time

```ts
import { AssetBundleLoaded, Schedule, createTestGame, defineAssets, getAsset, loadAssets, setAssetLoader, type SystemCtx } from "fenrir-ts";
import "fenrir-ts/2d"; // adds the texture2d kind
import type { Texture } from "pixi.js";

const Art = defineAssets("myGame.art", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    blank: { kind: "texture2d", src: "img/blank.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "blank" }, // shows blank if reef fails
    sparkle: { kind: "texture2d", src: "img/sparkle.png", optional: true }, // cosmetic: may be missing
  },
  bundles: { boot: ["logo", "blank"], reef: ["reef", "sparkle"] },
});

async function loadBoot(ctx: SystemCtx): Promise<void> {
  await loadAssets(ctx, Art, "boot"); // PreInit: run() waits, and rejects if it fails
}

function startReef(ctx: SystemCtx): void {
  void loadAssets(ctx, Art, "reef"); // sync system: don't await; watch progress or the event
}

const game = await createTestGame({ seed: 1 });
// The loader gets each asset's { name, kind, src }; resolve with a value or reject.
setAssetLoader(game, { load: async ({ name }) => (name === "sparkle" ? Promise.reject(new Error("404")) : ({ label: name } as unknown as Texture)) });
game.on(AssetBundleLoaded, ({ bundle, missing }, ctx) => ctx.logger.info(`${bundle} loaded, missing ${missing}`));
game.addSystem(Schedule.PreInit, loadBoot).addSystem(Schedule.Init, startReef);
await game.start();
await loadAssets(game, Art, "reef");
const reef: Texture = getAsset(game, Art, "reef");
const sparkle: Texture | undefined = getAsset(game, Art, "sparkle"); // undefined: optional and missing
console.log(game.resources.get(Art.progress).bundles.reef.fraction, reef.label, sparkle); // 1 "reef" undefined
```

- A bundle awaited in `PreInit` holds `run()`, so nothing is drawn while it loads. To show a loading bar, start it in `Init` without awaiting (`void loadAssets(ctx, Art, "boot")`), draw `ctx.resources.get(Art.progress).bundles.boot.fraction` each frame, and set the play state on `AssetBundleLoaded`: the pattern in [references/assets.md](references/assets.md).
- Gameplay that declares `texture2d` assets imports `fenrir-ts/2d` for the kind, which loads `pixi.js` in tests too; that works in Vitest's default `node` environment.
- `texture2d` sources must be `.png`, `.jpg`/`.jpeg`, `.webp`, `.gif`, `.bmp` or `.svg`. An SVG is rasterised at its declared `width`/`height`, so set those to the size it is drawn at (scaling it up later blurs it, as with a PNG). `src` is a URL relative to the page (with Vite, `public/img/logo.png` is `img/logo.png`).
- Declare each asset once; a wrong asset or bundle name is a compile error, and `getAsset` is typed by kind (a Pixi `Texture` for `texture2d`, no cast).
- `loadAssets` is idempotent (same promise while loading or loaded; retries failures). An asset in two bundles loads once and is kept until the last holder unloads. `loadAsset(ctx, manifest, name | names)` / `unloadAsset` hold single assets by name with no bundle, for lazy images.
- `getAsset` throws until loaded: wait for `AssetBundleLoaded` / `AssetLoaded`, or read `ctx.resources.get(manifest.progress)` (a HUD reads it each frame).
- `unloadAssets` destroys textures nothing else holds: despawn what shows them first.
- An asset's name is also its store key, so `with(Renderable2D, sprite2D("logo"))` and `getTexture2D(ctx, "logo")` (from `fenrir-ts/2d`) read it. Tests use `setAssetLoader(game, { load })`. Full rules: [references/assets.md](references/assets.md).

## Storage: `storage()`

```ts
import { createTestGame, defineStorageKey, getStored, memoryStorage, setStored, storage, updateStored } from "fenrir-ts";

type Save = { best: number; level: number };
const isSave = (v: unknown): v is Save =>
  typeof v === "object" && v !== null && typeof (v as Save).best === "number" && typeof (v as Save).level === "number";
const SaveKey = defineStorageKey<Save>("myGame.save", {
  default: { best: 0, level: 1 },
  version: 2,
  parse: (v) => (isSave(v) ? v : undefined),
  migrate: (v, from) => (from < 2 && typeof v === "number" ? { best: v, level: 1 } : v), // v1 stored only the best score
});
const Muted = defineStorageKey("myGame.muted", { default: false });

const game = await createTestGame({ seed: 1, plugins: [storage({ backend: memoryStorage() })] });
updateStored(game, SaveKey, (save) => ({ ...save, best: Math.max(save.best, 40) }));
setStored(game, Muted, true);
console.log(getStored(game, SaveKey).best, getStored(game, Muted)); // 40 true
```

- Reads never throw and never return the wrong shape: missing, corrupt, newer-version or unparseable data gives a copy of `default`. Writes never throw: a refused write stays in memory and returns false. `StorageStatus` says whether storage is persistent.
- Bump `version` and add `migrate(value, from)` when the shape changes; data your game stored before Fenrir is version 0. Without `parse`, a stored value must have the default's `typeof`: give objects a `parse`.
- Mutating a returned object changes nothing stored: call `setStored` / `updateStored`. Keep a resource field saved with `persistResource(game, Resource, "field", key)`. Many keys of one shape: `defineStorageKeyFamily("myGame.best.", options)(level)`.
- Never touch `localStorage` yourself; tests use `memoryStorage()`. Full rules: [references/storage.md](references/storage.md).

## UI controls: `fenrir-ts/ui`

```ts
import { Schedule, createTestGame, defineAction } from "fenrir-ts";
import { ControlActivated, UiFocus, activateControl, control, listControls, modalScope, ui } from "fenrir-ts/ui";
import { Container, Graphics } from "pixi.js";

const Tab = defineAction("myGame.tab", ["Tab"]); // TestInput presses bindings, so any action bound to Tab drives the kit's Tab
const root = new Container(); // a test game has no renderer: this container is the logical frame
const game = await createTestGame({ seed: 1, plugins: [ui({ root })] });
const activated: string[] = [];
game.on(ControlActivated, ({ id, via }) => void activated.push(`${id}:${via}`));

const sheet = root.addChild(new Container());
game.addSystem(Schedule.Update, function drawSheet() {
  for (const child of sheet.removeChildren()) child.destroy(); // rebuilt every frame, focus kept by id
  modalScope(sheet, { label: "Shop" });
  control(sheet.addChild(new Graphics().rect(0, 0, 100, 40).fill(0)), { id: "myGame.buy", label: "Buy" });
});
await game.start();
game.step();
game.input.press(Tab);
game.input.release(Tab);
game.step(1 / 60, 2); // focus moves to the first control and shows the ring
game.input.pointerDown(50, 20);
game.input.pointerUp();
game.step(1 / 60, 2); // the press is seen in one frame, the release that activates in the next
console.log([...activated], game.resources.get(UiFocus).id); // ["myGame.buy:pointer"] "myGame.buy"
console.log(activateControl(game, "myGame.buy"), listControls(game)[0]!.bounds); // true { x: 0, y: 0, width: 100, height: 40 }
```

- In a browser game: `plugins: [pixi, ui({ pixi })]`, `ui` after `pixi2d` and given it. In a test game: `ui({ root })`.
- `control(node, { id, label, onActivate?, disabled?, hitArea? })` on a node you drew makes it a button: tap (press and release over it), Tab/arrows to focus, Enter/Space to activate. `modalScope(sheet, { label, onClose })` blocks **taps and focus** outside the sheet and maps Escape to `onClose` (consumed). It does not block the game's own key actions: gate gameplay on your own pause state with `runIf`.
- **Gameplay keys and the kit.** Once a tap or Tab focuses a control, the kit takes the arrows (and Enter/Space) and consumes them, so a game that plays with arrows or Space loses them. Turn the kit's arrows off with `ui({ pixi, keys: { next: [], previous: [] } })`, use `tapFocus: "clear"` so a tap leaves nothing focused, or bind gameplay to other keys. There is no registry: a control is live while its node is visible under `root`; destroy or hide the node and it is gone. Redraw freely; focus is kept by `id`.
- `fenrir.ui.preUpdate` consumes taps that hit a control (and every tap while a scope is open) before your `PreUpdate`/`Update` systems. A gameplay system that must see such a press first: `{ before: "fenrir.ui.preUpdate" }`; a control that should also let gameplay see its press: `passThrough: true`.
- React to activation in `onActivate(ctx, via)` or with `ControlActivated` (`{ id, via }`). In tests, `activateControl(game, id)` and `listControls(game)` (ids, labels, focus, logical bounds).
- Don't: Pixi `eventMode`/`on("pointertap")`, DOM buttons over the canvas, your own focus index or hit tests, `aria-*` on the canvas. Full rules: [references/ui.md](references/ui.md).

## Audio: `fenrir-ts/audio`

```ts
import { Schedule, createTestGame } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, testAudio, type Synth } from "fenrir-ts/audio";

const blip: Synth = (context, output, { rate }) => {
  const osc = context.createOscillator();
  osc.frequency.value = 880 * rate;
  osc.connect(output);
  osc.start();
  osc.stop(context.currentTime + 0.08);
  return osc;
};
const Blip = defineSound("myGame.blip", { synth: blip, limit: 2 });
const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true }); // an audio asset of a manifest

const sounds = testAudio();
const game = await createTestGame({ seed: 1, plugins: [audio({ backend: sounds })] });
game.addSystem(Schedule.Init, (ctx) => void playSound(ctx, Theme), { name: "myGame.music" }); // queued: no gesture yet
await game.start();
game.input.pointerDown(10, 10); // the first gesture starts output
playSound(game, Blip, { volume: 0.5 });
game.resources.get(AudioState).buses.music!.volume = 0.4; // applied by the end of the frame
game.step();
console.log(sounds.played.map((p) => p.sound)); // ["myGame.blip"]: the theme's sample is not loaded, so it was dropped
```

- Browsers start audio only on a gesture; the plugin unlocks on the first key or tap by itself. Before that, one-shots are dropped and loops queued. Don't create an `AudioContext` or add a gesture listener.
- Samples are `{ kind: "audio", src }` assets in a manifest (import `fenrir-ts/audio` for the kind); a sample plays only once its bundle has loaded. Mute and volumes are fields of `AudioState`; persist them with `persistResource`. Full rules: [references/audio.md](references/audio.md).

## Testing and inspecting

- `createTestGame({ seed, plugins?, now?, maxFrameDelta? })`: the same systems, states, events and plugins, no canvas. `await game.start()`, `game.step(dt = 1/60, frames = 1)`, `await game.stop()`. `dt` above `maxFrameDelta` throws: step one second as `step(1 / 60, 60)`.
- `pixi2d` cannot install in a test game (no canvas): that is why gameplay is registered apart from drawing. `ui({ root })`, `audio({ backend: testAudio() })`, `storage({ backend: memoryStorage() })` and `setAssetLoader` make the other plugins headless.
- Entities in a test: `game` has no `entities`, `scene` or `scenes`; those are on `ctx`. Read through `inspect(game).entities` (each `id` is the entity handle, `components` keyed by name; cast the values), or register a test-only system that reads `ctx.entities` into a variable.
- The engine's components appear in `inspect()` under their names: `fenrir.Transform`, `fenrir.Transform2D`, `fenrir.Display2D`, `fenrir.Name` (folded into `name`), `fenrir.Relationship` (folded into `parent`), `fenrir.PixiNode`, `fenrir.Renderable2D`, `fenrir.Timers`, `fenrir.Tweens`. Plugin resources: `fenrir.MotionSettings`, `fenrir.StorageStatus`, `fenrir.AudioState`, `fenrir.UiFocus`, `fenrir.UiControls`, `fenrir.viewport.Viewport`.
- Textures in tests: a fake loader may return `Texture.WHITE` (from `pixi.js`), a real texture that needs no renderer, so code that builds a `Sprite` from `getAsset` runs headless too. Pixi `Text` measures itself with a DOM canvas: keep it in browser-only drawing code.
- A reload: a second `createTestGame` with `storage({ backend })` on the same `memoryStorage()` object reads what the first one stored. Manifest progress is in `inspect(game).resources[manifest.name]`.
- Assert on `inspect(game)`: plain JSON of `frame`, `time`, `schedule`, `states`, `resources` and `entities` (by the names you gave). In a browser test call `exposeInspector(game)` in the game and read `window.__FENRIR__.inspect()`. Don't assert on pixels or sleep for time. Full rules: [references/testing.md](references/testing.md).

## Mistakes that look right

| Tempting | Instead |
| --- | --- |
| `window.addEventListener("keydown")`, `canvas.addEventListener("pointerdown")` | `defineAction` + `ctx.input.pressed` in a system |
| `sprite.eventMode = "static"; sprite.on("pointertap", ...)` | `control(sprite, { id, label, onActivate })` from `fenrir-ts/ui` |
| `setTimeout(fn, 2000)`, `Date.now()`, `Math.random()` | `addTimer`, `ctx.time`, `ctx.random` |
| `async function update(ctx)` in `Update` | sync systems per frame; `void loadAssets(...)` and react to an event |
| `game.on(...)` inside a system, or `ctx.events.on(...)` at setup | `game.on` at setup; `ctx.events.on` inside a system for one run |
| `entities.each([A, B] as const, ...)` inline | a module-level `const QUERY = [A, B] as const` |
| Reading a press in gameplay that the UI kit or another system consumed earlier | order the reader `before` the consumer, or use `passThrough` |
| Gameplay on the arrows or Space next to UI controls with default `ui()` keys | `ui({ pixi, keys: { next: [], previous: [] }, tapFocus: "clear" })`, or other gameplay keys |
| Expecting an open `modalScope` to stop gameplay keys | `runIf` on your own pause state |
| A "paused" value in the state a timer's `state` option names | a separate pause state, and `MotionSettings.pausedAll` |
| A "Restart" that sets the state the game is already in, expecting its enter hook to reset the round | call the reset yourself (the enter hook calls the same function); setting the current value does nothing |
| A test that asserts a 0.2 s tween is done after exactly 12 frames of 1/60 | step past the end, or wait for `TweenDone`: the frame sum can fall a hair short |
| A `PostUpdate` system that moves sprites | move them in `Update`, or `{ before: "fenrir.pixi.postUpdate" }` |
| "Press Space to start" with nothing else: keys do nothing until the player clicks the canvas | `canvas.focus()` after `await game.run()`, and a tap that starts too |
| Touching `pixi.renderer` in `PreInit` or an initial state's enter hook | `Init` or later |
| `localStorage.getItem("best")` | `defineStorageKey` + `getStored` |
| `new AudioContext()`, `new Audio(src)` | `audio()` + `defineSound` + `playSound` |
| `Assets.load(url)` from Pixi | `defineAssets` + `loadAssets` / `loadAsset` + `getAsset` |
| Names without a namespace (`"Health"`), or starting with `fenrir.` | `"myGame.Health"` |

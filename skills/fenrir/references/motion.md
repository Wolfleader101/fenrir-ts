# Timers and tweens

The full rules for the `motion()` plugin. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Timers and tweens

Timers and tweens are plain data on entities, run by the opt-in `motion()` plugin from `fenrir-ts`. They advance with game time only (`time.delta`), so they pause with the game, run headless in `createTestGame` and give the same values for the same steps. A game that does not install `motion()` and import these names ships none of this code.

```ts
import { EntityBuilder, MotionSettings, Schedule, TimerFired, TweenDone, addTimer, addTween, createGame, defineState, motion, type SystemCtx } from "fenrir-ts";
import { Display2D, Transform2D, pixi2d } from "fenrir-ts/2d";

const Phase = defineState("myGame.Phase", { values: ["playing", "over"], initial: "playing" });
const Overlay = defineState("myGame.Overlay", { values: ["closed", "open"], initial: "closed" });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [motion(), pixi2d({ design: { width: 390, minHeight: 520 } })] });
const fired = game.events.createReader(TimerFired);
const finished = game.events.createReader(TweenDone);

// Respect the player's setting: every tween jumps to its end values and still sends TweenDone.
game.resources.get(MotionSettings).reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function spawn(ctx: SystemCtx): void {
  const fish = EntityBuilder.create().transform2D(40, 420).display2D({ alpha: 0 }).spawn(ctx.entities);
  // A leap along an arc: three tweens on one entity, each driving its own fields.
  addTween(ctx, fish, Display2D, { to: { alpha: 1 }, duration: 0.2 });
  addTween(ctx, fish, Transform2D, { to: { x: 320, rotation: Math.PI }, duration: 0.8, ease: "sineInOut", name: "myGame.leap" });
  addTween(ctx, fish, Transform2D, { to: { y: 260 }, duration: 0.4, ease: "quadOut", repeat: 1, yoyo: true });

  // Ambient motion in a group, so an overlay can pause it while the rest of the game runs.
  const buoy = EntityBuilder.create().transform2D(200, 300).spawn(ctx.entities);
  addTween(ctx, buoy, Transform2D, { to: { y: 306 }, duration: 1.2, ease: "sineInOut", repeat: Infinity, yoyo: true, group: "ambient" });

  // Fires once after 30 s of play; removed unfired if Phase leaves "playing" first.
  addTimer(ctx, fish, "myGame.roundOver", { duration: 30, state: [Phase, "playing"] });
}

function react({ states, logger, resources }: SystemCtx): void {
  for (const { name } of fired.read()) if (name === "myGame.roundOver") states.set(Phase, "over");
  for (const { name } of finished.read()) if (name === "myGame.leap") logger.info("splash");
  resources.get(MotionSettings).paused.ambient = states.get(Overlay) === "open";
}

game.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, react);
await game.run();
```

- `addTween(ctx, entity, Component, options)` tweens numeric fields of a component on the same entity: `Transform2D`, `Display2D` or any game component of plain numbers. Fields are the keys of `to` (and `from`), checked by TypeScript against the component's number fields, so there are no string paths. Options: `duration` (seconds per play), `from` (default: the component's values when the delay ends), `delay`, `ease`, `repeat` (plays after the first; `Infinity` loops), `yoyo`, `name` and `group`. The entity must have the component when the tween is added.
- `ease` is a name, so tween data stays JSON: `linear` (the default), `quadIn`, `quadOut`, `quadInOut`, `cubicIn`, `cubicOut`, `cubicInOut`, `sineIn`, `sineOut`, `sineInOut` and `backOut`, which overshoots and settles. The functions are on `easings`; `defineEasing("myGame.steps", fn)` adds one by name.
- A tween is named after its component and fields unless given a `name`, such as `fenrir.Transform2D:x,y`. Adding a tween with a running one's name replaces it, and the newest tween of a field takes that field from any older tween, so tweening `x` again mid-move just works. A replaced or cancelled tween sends nothing.
- `addTimer(ctx, entity, name, { duration, repeat?, group?, state? })` sends `TimerFired { entity, name, count, last }` each time it fires. `state: [Phase, "playing"]` removes it, unfired, once `Phase` leaves that value, so do not make "paused" a value of that state: keep pause in a state of its own, or pause the timer (`paused`, a group or `pausedAll`, below). For how long a state has had its value, use `states.timeIn`; a timer is for something that must happen at a time.
- A tween ends exactly on its end values (on its start values after an even number of yoyo plays) and sends `TweenDone { entity, name }`. It ends in the frame its `elapsed` reaches the full time, and `elapsed` is a floating-point sum of frame deltas. 12 steps of 1/60 can add up to just under 0.2, so a 0.2 s tween may still be a hair short of its end values (`1.0000000000000002`) after 12 frames and land on them in the 13th. A tween added in `Update` also first moves in the next frame (below). In a test, step past the end (`game.step(1 / 60, 15)`) or wait for `TweenDone`; do not assert on the exact frame. A frame that runs past the end of a play carries the rest into the next play, and a long frame fires a repeating timer as many times as it holds. Finished timers and tweens are removed, so a running one is one that is present.
- Both live in components, `Timers` and `Tweens` (records by name), that `inspect(game)` shows as plain JSON with their `elapsed` time. Each entry has a `paused` field to pause and resume it; `MotionSettings.paused[group] = true` pauses a group of them; `cancelTimer` and `cancelTween` remove one; removing the component or destroying the entity removes them all. If the tweened component is removed, its tweens are dropped without `TweenDone`.
- `motion()` registers `fenrir.motion.preUpdate`. Plugins install before the game adds systems, so it runs first in `PreUpdate`: `Update` systems and the renderer see this frame's values, and `TimerFired` and `TweenDone` are read in the same frame. Timers and tweens added in `Update` start moving the next frame. There is one motion system, so no timer or tween group can be stepped later in the frame: a tween that should follow a value an `Update` system computes follows it from the next frame, so set the value directly in the frame it must match.
- Timers and tweens advance by `time.delta`, which `createGame({ maxFrameDelta })` caps for the whole game (default 0.25 s); there is no cap per group. A game whose motion must jump less after a stall passes a smaller `maxFrameDelta`. A system of the game's own that needs a smaller cap than the rest of the game clamps its own step: `Math.min(ctx.time.delta, 1 / 20)`.
- `MotionSettings.pausedAll = true` pauses every timer and tween, grouped or not, for a pause menu that leaves the rest of the game running. Settings are read when the motion system runs, so a pause set in `Update` holds from the next frame. For a pause that also stops this frame's advance, decide it in `PreUpdate` before the motion system, where this frame's input is already latched:

```ts
import { MotionSettings, Schedule, defineAction, type SystemCtx } from "fenrir-ts";

const Pause = defineAction("myGame.pause", ["Escape", "KeyP"]);

function pauseMenu({ input, resources }: SystemCtx): void {
  const settings = resources.get(MotionSettings);
  if (input.pressed(Pause)) settings.pausedAll = !settings.pausedAll;
}

game.addSystem(Schedule.PreUpdate, pauseMenu, { before: "fenrir.motion.preUpdate" });
```

- Timers and tweens are entity data, so they stay across `stop()` and `run()` and carry on where they were, as entities do. A paused game moves none of them.

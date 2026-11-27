# Input

<!-- Generated from README.md by scripts/agent-docs.mjs. Do not edit: change README.md, then run pnpm docs:agent. -->

The full rules for actions, the pointer, what `consume` hides, `onDown` and `onGesture`, and test input. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Input

Systems read actions, not DOM events. `defineAction(name, bindings)` names something the player does and binds it to keys by `KeyboardEvent.code` (`"KeyA"`, `"Space"`, `"ArrowLeft"`, `"Enter"`) and to `"pointer.primary"` (left mouse button, a finger or a pen) or `"pointer.secondary"` (right mouse button). An unknown binding such as `"space"` or `"A"` is a compile error. `createGame` installs input: there is nothing to register.

```ts
import { Schedule, createGame, defineAction, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
const Left = defineAction("myGame.left", ["ArrowLeft", "KeyA"]);

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
canvas.tabIndex = 0; // keys reach the canvas only while it has focus
const game = await createGame({ canvas, plugins: [pixi2d({ design: { width: 390, minHeight: 520 } })] });

const pauseButton = { x: 330, y: 10, width: 50, height: 50 }; // design units

// UI runs first and swallows a tap that landed on its button.
function ui({ input }: SystemCtx): void {
  const { x, y } = input.pointer;
  const onButton = x >= pauseButton.x && x <= pauseButton.x + pauseButton.width && y >= pauseButton.y && y <= pauseButton.y + pauseButton.height;
  if (input.pressed(Tap) && onButton) input.consumePointer();
}

function play({ input, logger }: SystemCtx): void {
  if (input.pressed(Tap)) logger.info(`tap at ${input.pointer.x}, ${input.pointer.y}`); // design units
  if (input.held(Left)) logger.debug("moving left");
}

game
  .addSystem(Schedule.Update, ui, { before: "play" })
  .addSystem(Schedule.Update, play);
await game.run();
```

`ctx.input` and `game.input` are the same object:

| Read | Means |
| --- | --- |
| `pressed(action)` | The action went down this frame: none of its bindings was held last frame and one is now |
| `released(action)` | The action went up this frame: it was held last frame and no binding is down now |
| `held(action)` | Any of its bindings is down |
| `pointer` | `{ x, y, down, inside, cancelled }`: the primary pointer's last position in logical units, whether it is down, whether it is over the canvas, and whether this frame's release was a cancel rather than a lift |
| `focused` | The canvas had keyboard focus when the frame started |
| `edges(actions)` | This frame's presses and releases of `actions`, in the order they happened, repeats kept |
| `consumePointer()` | Stops this frame's pointer press reaching actions, for UI that handled it |
| `consume(action)` | Stops this frame's press of `action` reaching later systems, whichever binding pressed it |
| `onDown(action, handler)` | Setup: runs `handler` inside the DOM event that presses a binding; returning `true` prevents its default |
| `onGesture(handler)` | Setup: runs `handler` inside every user gesture on the canvas, for calls such as `audioContext.resume()` |

**Frames.** Input is latched when a frame starts, before `PreUpdate`, so every system in the frame, in every stage, reads the same answers; an event that arrives during a frame counts from the next one. `pressed` and `released` are each true for exactly one frame. A tap that goes down and up between two frames is not lost: it is pressed and held in one frame and released in the next. A second binding going down while another is held gives no second `pressed`. Two presses of the same binding between two frames count as one; `edges` keeps both.

**Tick.** In the `Tick` stage, `pressed` and `released` are true in exactly one tick: the first tick that runs after the edge. A frame that runs several ticks reports the press in the first only; a frame that runs none keeps it for the next frame's first tick. A tap carried past a frame with no tick can be pressed and released in the same tick. `held` is the frame's answer in every tick.

**Pointer.** Mouse, touch and pen all drive the primary pointer. Only the primary pointer counts: a second finger is ignored, and while one pointer is down no other moves it. `x` and `y` are logical units: design units with `pixi2d({ design })`, otherwise CSS pixels from the canvas's top-left corner. They keep the last position after the pointer lifts or leaves. `inside` is false once the mouse leaves the canvas or a finger lifts.

**consumePointer and consume.** Systems that run after `consumePointer()` see no `pressed`, `held` or `released` from the pointer bindings until the pointer lifts, so the matching release is hidden too. Keys bound to the same action still count, and `pointer.down` still reports the pointer. `consume(action)` does the same for whichever of the action's bindings went down this frame, keys included, so Enter on a focused canvas button does not also reach gameplay; any other action bound to the same key is hidden with it. Systems that ran earlier in the frame already saw the press, so the UI system must run first: in the same stage with `before` (as above), or in `PreUpdate` when gameplay reads input in `Tick`. With no new press of those bindings this frame they do nothing. Consuming hides only the press it was given: once the key or button lifts, its next press is seen again, even when it goes down in the very next frame or lifts and goes down again between two frames.

**Order.** `pressed` and `released` answer per frame. When order matters, as for keyboard focus moving between canvas controls, read `edges(actions)`: every press and release of those actions since the last frame, in the order the keys and buttons went down and up. Two quick ArrowRights are two `pressed` edges, and "Enter, Tab" and "Tab, Enter" differ. An action is pressed when its first binding goes down and released when its last goes up. A quick tap is `pressed` then `released` in one frame's list, the frame where `pressed()` is true. Each edge's `binding` is the key or button that made it; one key bound to several of `actions` gives each an edge with that binding, next to each other. Consumed bindings are left out until they lift. In `Tick` the list is the frame's in every tick, so read it in `PreUpdate` or `Update`.

```ts
import { Schedule, defineAction, type SystemCtx } from "fenrir-ts";

const FocusNext = defineAction("myGame.focusNext", ["ArrowRight", "ArrowDown"]);
const Activate = defineAction("myGame.activate", ["Enter", "Space"]);
const FOCUS_ACTIONS = [FocusNext, Activate];
declare const menu: { focusNext(): void; activate(): void };

function navigateMenu({ input }: SystemCtx): void {
  for (const { action, kind } of input.edges(FOCUS_ACTIONS)) {
    if (kind !== "pressed") continue;
    if (action === FocusNext) menu.focusNext();
    else menu.activate();
  }
}

game.addSystem(Schedule.Update, navigateMenu);
```

**Inside the DOM event.** Systems run in the next frame, after the browser has acted on an event. Two things cannot wait. Both are setup, registered once like `game.on`: they stay across `stop()` and `run()`, are called only while the game runs, with the run's `ctx`, and are removed by the function they return.

- `input.onDown(action, handler)` runs inside each `keydown` of a bound key (auto-repeats included) and the pointer event that presses a bound button, before the press is latched. Return `true` and the engine calls `preventDefault()`, for example to keep Tab on the canvas while a canvas control can take focus, and let it leave after the last one. The press is latched either way.
- `input.onGesture(handler)` runs inside each `keydown` that is not a repeat, `pointerdown` and `pointerup` on the canvas. Browsers allow some calls only inside a user gesture, such as starting audio on iOS Safari, where a touch counts on `pointerup`.

A handler that throws is logged and the others still run; a throwing `onDown` handler does not claim.

```ts
import { defineAction } from "fenrir-ts";

const FocusNext = defineAction("myGame.focusNext", ["Tab"]);
declare const ui: { hasNextControl(backwards: boolean): boolean };
const audio = new AudioContext();

// Tab moves between canvas controls, and leaves the canvas after the last one.
game.input.onDown(FocusNext, (event) => ui.hasNextControl(event instanceof KeyboardEvent && event.shiftKey));
// iOS Safari starts audio only inside a gesture. The audio() plugin from fenrir-ts/audio does this for you.
game.input.onGesture(() => {
  if (audio.state === "suspended") void audio.resume();
});
```

**Focus.** The engine listens on the canvas only. Keyboard events reach a canvas only while it has focus, so keys do nothing until the player clicks or taps the canvas, or the page calls `canvas.focus()`. If the canvas has no `tabindex`, the engine sets `tabindex="0"` while the game runs, so a click focuses it; a press on the canvas also focuses it. If your keys do nothing, the canvas does not have focus: check `document.activeElement`. `input.focused` tells systems whether the canvas had focus when the frame started, for example to hide a focus ring once it is lost; losing focus also releases everything held (see "Stuck input").

**Prevented defaults.** Only on the canvas, never elsewhere on the page: page scrolling on Space and the arrow keys (keydown), touch scrolling and pinch zoom (`touch-action: none`, restored when the game stops), and the context menu, so a secondary press reaches the game. Tab, Enter and every other key keep their defaults, unless an `onDown` handler claims the press.

**Stuck input.** Everything held is released, with a `released` edge next frame, when the canvas loses focus (which includes the window losing focus), when the page is hidden, on `pointercancel`, and when pointer capture is lost. A press captures the pointer, so its release arrives even when it lifts outside the canvas. When the pointer is released by anything but a lift (`pointercancel`, lost capture, focus loss or a hidden page), `pointer.cancelled` is true in the frame that reports the release, so a button that acts on release can ignore it: `if (input.released(Tap) && !input.pointer.cancelled)`. Stopping the game clears input, and every listener belongs to the run: a stopped game, or one whose startup threw, leaves none behind.

In a test game, `game.input` also stands in for the player. Each call takes effect when the next frame starts:

```ts
import { Schedule, createTestGame, defineAction, type SystemCtx } from "fenrir-ts";
import { expect, it } from "vitest";

const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
const taps: Array<{ x: number; y: number }> = [];

function countTaps({ input }: SystemCtx): void {
  if (input.pressed(Tap)) taps.push({ x: input.pointer.x, y: input.pointer.y });
}

it("counts a tap at the pointer and one from the keyboard", async () => {
  const game = await createTestGame({ seed: 1 });
  game.addSystem(Schedule.Update, countTaps);
  await game.start();

  game.input.pointerDown(120, 340); // logical units
  game.input.pointerUp(); // a quick tap: pressed next frame, released the one after
  game.step(1 / 60, 2);
  game.input.press(Tap); // presses the action's first binding
  game.step();
  game.input.release(Tap); // releases all its bindings
  game.step();

  expect(taps).toEqual([{ x: 120, y: 340 }, { x: 120, y: 340 }]);
  await game.stop();
});
```

`press`, `release`, `pointerDown(x, y)`, `pointerMove(x, y)`, `pointerUp()`, `pointerCancel()`, `focus()` and `blur()` exist only on a test game's input. Coordinates are logical, whatever the `Viewport` resource says. `press(action, event?)` and `pointerDown` call the `onDown` handlers and then the `onGesture` handlers at once, as the DOM event would, and return whether a handler claimed the press; `pointerUp` is a gesture too. `press` passes `event` to the handlers, for example a `KeyboardEvent` with `shiftKey`. A pointer press focuses the canvas, as in the browser, and `blur()` releases everything held.

**Browser tests.** The engine reads pointer buttons from `event.buttons`, which browsers always set. A synthetic `new PointerEvent("pointerdown", { button: 0 })` has `buttons: 0`, so the engine sees no press at all. Dispatch the press with `buttons: 1` and a matching `pointerup` with `buttons: 0`, on the canvas, from the primary pointer:

```ts
declare const canvas: HTMLCanvasElement;
for (const [type, buttons] of [["pointerdown", 1], ["pointerup", 0]] as const) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, button: 0, buttons, clientX: 10, clientY: 10 }));
}
```

Playwright's `locator.click()` and `page.mouse` send real browser input and need nothing extra.

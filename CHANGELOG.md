# Changelog

Fenrir TS is at 0.x: breaking changes are allowed, and each one is listed here with a migration line.

## Unreleased

### UI controls: the last adapters a consumer kept (#78, part of #39)

- **Focus on a blocked control (bug fix).** The kit clears `UiFocus` from a control that a modal scope blocks, or that is no longer live, every time it reads the display tree: after each activation, `onClose` and `onAction` as well as at the start and end of its pass and in `syncUi`. A HUD control's Enter that opens a sheet and an Escape that closes it in the same frame now leave nothing focused, as they did a frame apart.
- **Tab and waiting keys.** Tab stays on the canvas while another press the kit reads (its keys, the pointer or `actions`) is waiting for the next frame, and counts the Tabs still waiting.
- **`ui({ arrows: "clear" })`**: as `"linear"`, but stepping past either end leaves no control focused, still on the canvas.
- **`ui({ blurFocus: "clear" })`** clears focus while the canvas lacks keyboard focus. The default, `"keep"`, is unchanged.
- **`passThrough` and keys.** Enter, NumpadEnter and Space on a focused `passThrough` control activate it and are left unconsumed for gameplay. A press a `passThrough` control took, by key or pointer, no longer also goes to `onAction`.

Size: the kit costs a 2D game 0.30 kB minified / 0.10 kB gzip more (`game-2d-ui` 62.42 / 20.58 kB).

Changed defaults, both judged bugs: focus on a blocked control is cleared within the frame, and a pointer press on a `passThrough` control no longer reaches `onAction`. Migration: a game that read that press in `onAction` reads `input.pressed` in a gameplay system instead, or listens for `ControlActivated`. Enter on a focused `passThrough` control is no longer consumed; drop `passThrough` to keep it consumed.

### Input and UI controls: gaps a first consumer hit (part of #39)

- **Consumed input (bug fix).** `consume(action)` and `consumePointer()` hide only the press they were given. A key or pointer button that lifts and goes down again before the next frame, or goes down in the frame right after a consumed tap, is a new press: `pressed`, `edges` and `Tick` see it. Before, it stayed hidden until it lifted again. `consume` also hides a second press that `pressed()` folded into a hold.
- **`InputEdge.binding`**: the key or button that made the edge.
- **One ordered pass.** `ui({ actions, onAction })` hands the game's own key and pointer presses to `onAction(ctx, action)` in the order they were typed among the kit's keys, reading the display tree again after each, so Enter that opens a sheet and Escape after it in one frame open and close it. The kit's pointer presses are read from `input.edges` too, so a quick second tap is no longer lost.
- **Press-time controls.** `control(node, { activateOn: "press" })` activates in the frame of the press; `passThrough: true` lets the press reach gameplay, even in a modal scope.
- **Arrows.** `ui({ arrows: "linear" })` stops at the ends and works from no focus. **`moveFocus(game | ctx, delta, wrap?)`** moves focus from game code.
- **Tap focus.** `ui({ tapFocus: "clear" })` clears focus on every pointer press.
- **Focus and scopes (bug fix).** Focus no longer carries to a control with the same id in a different modal scope. `modalScope(node, { focus })` names the control that takes focus when the scope comes on top.
- **Output in the frame of the change.** The ring, cursor and canvas `aria-*` are written by the new `fenrir.ui.postUpdate` (before `fenrir.pixi.postUpdate`) and `fenrir.ui.postInit`, not in `fenrir.ui.preUpdate`, so a scope opened or focus moved in `Update`, and controls drawn at `Init`, are in the frame drawn. **`syncUi(ctx)`** does it on demand. A frame with no input no longer walks the tree in `fenrir.ui.preUpdate`, so an idle frame still walks once.
- **NumpadEnter** activates the focused control by default.
- **`summary`** may return nothing to keep the canvas's own label.
- `activateControl` and `listControls` take a system's `ctx` as well as the game.

Size: the kit costs a 2D game 6.84 kB minified / 2.94 kB gzip, up from 5.49 / 2.32. The input fix adds 0.20 kB / 0.05 kB gzip to every game.

Changed defaults, both judged bugs: the consumed re-press above, and focus no longer moving into another scope by id. No other breaking changes.

### UI controls: `fenrir-ts/ui` (#16, #17, part of #39)

A new entry point, opt-in: a game that does not import it ships none of its code. Its peer is `pixi.js`.

- **`ui({ pixi })`** is the plugin, listed after `pixi2d` and given it; `ui({ root })` in a test game. It registers `fenrir.ui.init` and `fenrir.ui.preUpdate`.
- **`control(node, { id, label, onActivate, disabled, hitArea, order })`** makes a Pixi node the game drew tappable and focusable while it is live (in the scene, visible, renderable). Hit areas come from the node's bounds, or a rectangle or circle. No registry: a node that is destroyed or dropped takes its control with it.
- **Pointer**: press and release on the same control activates it, the tap is consumed, a cancelled pointer does nothing, and the cursor is `pointer` over an enabled control.
- **Keyboard**: Tab and Shift+Tab move focus and leave the canvas past either end; arrows move once a control has focus; Enter and Space activate the focused control; Escape closes the top modal scope. `UiFocus` holds the focused id and a default focus ring is drawn, replaceable with `focusRing`.
- **`modalScope(node, { label, onClose })`**: only controls inside the top live scope take input, and every tap is kept from the game while one is open.
- **`ControlActivated`** `{ id, via }` is sent on every activation, after `onActivate`.
- **Accessibility** is the canvas's `aria-label` (the top scope's label or `summary`) and `aria-description` (`Focused: <label>`); no DOM elements are added.
- **`paginate(rows, capacity, page)`**, and **`activateControl(game, id)`** and **`listControls(game)`** for tests; `inspect(game)` lists the controls under `fenrir.UiControls`.

No breaking changes.

### Smaller base build (part of #39)

A game that never inspects itself ships about 3.2 kB less engine code (about 1.2 kB gzip); a core-only game that never builds an entity about 1 kB less on top.

- **`inspect(game)` is a function.** `game.inspect()` is gone: `inspect(game)` from `fenrir-ts` returns the same `GameSnapshot`, on a `Game` or a `TestGame`. `exposeInspector(game)` puts it on `window.__FENRIR__`. A game that calls neither ships no snapshot or JSON-encoding code.
- **`EntityBuilder` core methods are the class's own.** `transform()`, `name()`, `transform2D()` and `display2D()` no longer patch the class at import, so a game that never builds an entity ships no builder. Source-compatible.
- **Stable names in snapshots.** A class instance with a non-empty string `label` (every Pixi display object has one) shows it next to `$type`, which a minifier renames.

### Breaking changes

| Before | After |
| --- | --- |
| `game.inspect()` | `inspect(game)` from `fenrir-ts` |
| `createGame({ canvas, debug: true })` | `createGame({ canvas })`, then `exposeInspector(game)` |

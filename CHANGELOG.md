# Changelog

Fenrir TS is at 0.x: breaking changes are allowed, and each one is listed here with a migration line.

## Unreleased

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

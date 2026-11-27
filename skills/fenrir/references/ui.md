# UI controls

The full rules for `fenrir-ts/ui`: controls, modal scopes, focus and accessibility. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## UI controls

`fenrir-ts/ui` turns Pixi nodes the game drew into buttons: tappable, focusable with the keyboard, described to screen readers through the canvas, and gone when the node is destroyed. The game draws every pixel; the kit adds no DOM elements and patches no class. Its peer is `pixi.js`, and a game that does not import it ships none of its code.

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { ControlActivated, control, modalScope, paginate, ui } from "fenrir-ts/ui";
import { Container, Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, layers: ["world", "overlay"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi, ui({ pixi, summary: "Town" })] });

const shop = { open: true, page: 0, coins: 40, dirty: true };
const ITEMS = ["sword", "shield", "potion", "bow", "arrows"];
const sheet = new Container();

function drawShop(ctx: SystemCtx): void {
  for (const child of sheet.removeChildren()) child.destroy({ children: true }); // rebuilt from state
  sheet.visible = shop.open;
  if (!shop.open) return;
  modalScope(sheet, { label: "Shop", onClose: () => ((shop.open = false), (shop.dirty = true)) });
  const { rows, page, pages } = paginate(ITEMS, 3, shop.page);
  rows.forEach((item, i) => {
    const row = sheet.addChild(new Graphics().roundRect(0, 0, 300, 48, 8).fill(0x2b5d7a));
    row.position.set(45, 80 + i * 60);
    control(row, { id: `buy-${item}`, label: `Buy ${item}, 50 coins`, disabled: shop.coins < 50, onActivate: () => ctx.logger.info(`bought ${item}`) });
  });
  const next = sheet.addChild(new Graphics().circle(0, 0, 24).fill(0x3b6d8a));
  next.position.set(345, 300);
  control(next, { id: "next-page", label: `Page ${page + 1} of ${pages}`, hitArea: { x: 0, y: 0, radius: 32 }, onActivate: () => ((shop.page = page + 1), (shop.dirty = true)) });
}

game.on(ControlActivated, ({ id, via }) => game.logger.debug(`${id} by ${via}`)); // a click sound, analytics
game
  .addSystem(Schedule.Init, function mountShop() {
    pixi.renderer.layer("overlay").addChild(sheet);
  })
  .addSystem(Schedule.Update, function redrawShop(ctx: SystemCtx) {
    if (shop.dirty) drawShop(ctx);
    shop.dirty = false;
  });
await game.run();
```

- **Plugin.** `ui({ pixi, keys?, arrows?, tapFocus?, blurFocus?, focusRing?, summary?, hint?, actions?, onAction? })`, listed after `pixi2d` and given that plugin, so the kit reaches its `root` and `backdrop` without `pixi2d` carrying any code for it. Without it, `createGame` rejects with a message that says so. A test game, which has no renderer, passes `ui({ root })`: a container whose units are the logical units the pointer reports.
- **Controls.** `control(node, { id, label, onActivate?, disabled?, hitArea?, order?, activateOn?, passThrough? })` returns `node`. A control is live while its node is under `root` or `backdrop` and it and every ancestor are `visible` and `renderable`. The kit keeps no list of controls: options are held against the node in a `WeakMap`, and each frame it walks the display tree for live ones, so clearing and redrawing a sheet every state change leaves nothing behind. Calling `control` again on a node replaces its options.
- **Hit areas** come from the node's local bounds (children included) unless `hitArea` gives a rectangle `{ x, y, width, height }` or a circle `{ x, y, radius }` in the node's own units; Pixi's `Rectangle` and `Circle` fit. Points are tested in the node's space, so scaled, rotated and nested nodes, the `Viewport` design frame, letterboxing and resizes all line up with what is drawn. Where controls overlap, the one drawn on top wins. Only controls take taps: a node that is not a control, drawn over one, does not block it. To block taps under an overlay, make the overlay a `modalScope`; a non-modal overlay cannot block taps yet.
- **Pointer.** A control activates when the primary pointer goes down and comes up over it, in the frame that reports the release. The press is consumed (`input.consumePointer()`), so systems after `fenrir.ui.preUpdate` do not see a tap that hit a control. A press that slides off, or one the browser cancels (`pointer.cancelled`), activates nothing. The cursor is `pointer` over an enabled control. A quick second press, even in the very next frame, is a new tap.
- **Press-time and pass-through controls.** `activateOn: "press"` activates in the frame of the press, for a button that times a tap; sliding off or a cancel then changes nothing. `passThrough: true` leaves the press unconsumed, so gameplay still sees `pressed`, even inside a modal scope; the control still takes focus, is labelled and activates as `activateOn` says. With `passThrough`, Enter, NumpadEnter or Space on the focused control is left unconsumed too, so gameplay sees the key as its own press. A press the kit took this way, by key or pointer, does not also go to `onAction`. Together they make a focusable, labelled gameplay button whose tap or key the game also times.
- **Keyboard.** Tab and Shift+Tab move focus in display order (depth first, back to front), then by `order` (lower first, default 0). Tab is kept on the canvas while there is a control to move to and leaves it past either end, decided inside the `keydown` with `input.onDown`. A Tab typed after another press the kit reads (one of its keys, a pointer press or one of `actions`) and before the next frame stays on the canvas, since that press acts first and may move focus or open a sheet; Tabs still waiting for the frame are counted, so a second Tab past the last control still leaves. The arrows move focus too, wrapping, but only once a control has focus or a modal scope is open, so a game can use them for movement. `arrows: "linear"` makes them stop at the first and last control and work from no focus (`next` goes to the first control, `previous` to the last); they are then the kit's whenever a control is live. `arrows: "clear"` is the same, except that past the first or last control focus goes to none, still on the canvas, and the next arrow starts again from no focus. Enter, NumpadEnter and Space activate the focused control and are consumed (unless it is `passThrough`); with nothing focused they are the game's. Change the keys with `ui({ keys: { tab, next, previous, activate, close } })`; an empty list turns one off.
- **One ordered pass.** The kit reads its keys and pointer presses in `fenrir.ui.preUpdate`, in the order they arrived (`input.edges`). Give it the game's own keys with `actions` and `onAction(ctx, action)` and they join that pass: for each press of one, in typed order, the kit calls `onAction`, then reads the display tree again, so a sheet drawn there is live for the next key. Enter that opens a sheet and an Escape typed after it in the same frame open and then close it. A key the kit uses acts first under its own rules (Enter on a focused control activates it and never reaches `onAction`). Return `true` to consume the press; otherwise later systems see it too.
- **Focus.** `UiFocus` (`fenrir.UiFocus`) is `{ id, visible }`: set `id` to move focus. It survives a redraw when a control with the same id is live again by the next frame, and is cleared otherwise. It is also cleared each time the kit reads the display tree (after each activation, `onClose` and `onAction`, and at the start and end of the pass) and finds its control blocked by a modal scope, so a HUD control's Enter that opens a sheet and an Escape that closes it in one frame leave nothing focused, as they would a frame apart. A tap focuses the control without showing the ring (`visible: false`), and a tap elsewhere keeps focus; `tapFocus: "clear"` makes every press clear focus instead, so Enter after a tap is the game's again. While the canvas lacks keyboard focus, focus is kept and the ring hidden; `blurFocus: "clear"` clears it instead, in every frame that starts blurred, so returning to the canvas starts from no focus. A key shows the ring. `moveFocus(game, delta, wrap?)` moves focus as an arrow does, from a system (`moveFocus(ctx, 1)`) or a test, and returns the focused id. The default ring is a rounded rectangle drawn above everything in `root` while the canvas has keyboard focus; `focusRing: (ring, bounds, control) => ...` draws your own into a cleared `Graphics`, and `focusRing: false` draws none.
- **Disabled controls** take focus and taps (so a tap on a greyed button does not fall through to the game) and never activate: no `onActivate`, no `ControlActivated`. Screen readers hear ", unavailable".
- **Duplicate ids.** Ids must be unique among live controls. A later live control with an id already seen, in display order, is ignored, and the kit warns once per id.
- **Modal scopes.** `modalScope(node, { label, onClose? })` makes a container modal while it is live: only controls inside it take taps, focus and `activateControl`; every tap, inside or out, is kept from the game; Escape calls `onClose` (the game hides or destroys the node) and is consumed. Keys are not blocked: the game's own key actions still reach gameplay while a scope is open, so gate them on the game's own state (`runIf: inState(Pause, "running")`).
- **Gameplay keys next to controls.** The kit's keys are Tab, the arrows (once a control has focus or a scope is open), and Enter, NumpadEnter and Space (while a control has focus), and it consumes each one it acts on. A game that also plays with the arrows or Space loses them once a tap or Tab has focused a HUD control. Give the kit other keys or none (`ui({ pixi, keys: { next: [], previous: [] } })`), clear focus on taps (`tapFocus: "clear"`) or when the canvas loses focus (`blurFocus: "clear"`), or mark a gameplay button `passThrough`. Scopes nest: the one that became live last is on top, and the one below takes over when it ends. Focus belongs to the scope it was in: when another scope comes on top, a control there with the same id (a shared `close`, say) does not inherit it. `modalScope(node, { focus: "close" })` focuses that control each time the scope comes on top; setting `UiFocus.id` to a different id after the change also works. Redrawing the same scope node keeps focus.
- **Activation.** `onActivate(ctx, via)` runs first, then `ControlActivated { id, via }` is sent, where `via` is `"pointer"`, `"key"` or `"call"`. Both run inside `fenrir.ui.preUpdate`, as do `onClose` and the state hooks a `states.set` there triggers, so they run after `fenrir.motion.preUpdate` (when `motion()` is listed first): a pause they set (`MotionSettings.pausedAll`) holds from the next frame.
- **Order against game systems.** `fenrir.ui.preUpdate` runs in `PreUpdate`, before the game's own `PreUpdate` systems, so taps on controls are consumed before gameplay reads them. A game system that must see a press first passes `{ before: "fenrir.ui.preUpdate" }`. Controls drawn in `Update` are hit-tested from the next frame, where they are what the player sees. The ring, cursor and accessibility output are written by `fenrir.ui.postUpdate`, after `Update` and before the renderer, and by `fenrir.ui.postInit`, before the game's `PostInit` systems, so a scope opened or focus moved in `Update`, and controls drawn at `Init`, are in the frame that is drawn. A game that draws controls later and renders itself, such as in a `PostInit` system that draws the first frame, calls `syncUi(ctx)` before rendering. A control hidden in `Update` through `Display2D.visible` disappears from the screen that frame, but the ring, cursor and accessibility output still show it for one more frame, because `Display2D` reaches the node in `fenrir.pixi.postUpdate`, after the kit's output; set `node.visible = false`, or remove the node, where they must change in the same frame. Taps are not affected.
- **Accessibility** goes through the canvas only: `aria-label` is the top modal scope's label, else `summary` (a string, or `(ctx) => string | undefined` read each frame, which returns nothing to fall back), else the canvas's own; `aria-description` is `Focused: <label>` or, while nothing has focus, `hint`. Both are restored when the run stops. The engine already makes the canvas focusable (`tabindex="0"`) when a run starts. The kit is tested in jsdom and in desktop Chromium only. Not verified: whether screen readers (NVDA, JAWS, VoiceOver, TalkBack) announce these attributes on a canvas with no `role`, real phones and tablets (touch timing, safe areas, iOS Safari), host webviews, and where Tab goes past the canvas on a page with other focusable elements.
- **Paging.** `paginate(rows, capacity, page)` returns `{ rows, page, pages }` with `page` clamped into range, so a list that shrank shows its last page.
- **Tests.** Everything works in `createTestGame` with `ui({ root })` and `TestInput`: `pointerDown(x, y)` and `pointerUp()`, and `press(action)` with actions bound to the same keys. `activateControl(game, id)` activates as a tap would and returns whether it did; `listControls(game)` returns `{ id, label, disabled, focused, blocked, bounds }` in focus order, with `bounds` in logical units for `logicalToScreen` in a browser test. `inspect(game)` shows the same list under `fenrir.UiControls`, with the top scope's label as `modal`.

**Migrating hand-rolled canvas buttons.** A game that keeps its own list of button rectangles, hit-tests `ctx.input.pointer` against them and tracks a focused index:

1. Replace each `{ x, y, width, height, onTap }` entry with `control(node, { id, label, onActivate })` on the node that draws it; drop the rectangle, the list and the hit test.
2. Replace the hand-kept focus index with `UiFocus`, the Tab and arrow handling with the kit's keys, and the game's own `onDown(Tab)` handler with nothing.
3. Wrap each sheet or dialog in `modalScope(sheet, { label, onClose })` and delete the code that ignored taps behind it and handled Escape.
4. Replace the focus-ring drawing with `focusRing`, and the aria attributes the game set with `summary` and the scope labels.
5. In tests, replace synthetic clicks at computed coordinates with `activateControl(game, id)`, or with `listControls(game)` bounds and `logicalToScreen` in a browser test.

**Deleting adapters around the kit.** A game that wrapped the kit in systems of its own can drop them:

| Adapter | Replace with |
| --- | --- |
| A game system that reads every key in order and drives the kit, so its own keys and the kit's interleave | `ui({ actions, onAction })` |
| A system after the kit that times taps on a gameplay button, or re-reads presses the kit consumed | `control(node, { activateOn: "press", passThrough: true })` |
| Arrow handling that stops at the ends or works from no focus, built on `listControls` | `ui({ arrows: "linear" })`, and `moveFocus(ctx, delta)` for other keys |
| Clearing `UiFocus` on every pointer press | `ui({ tapFocus: "clear" })` |
| Clearing focus when a sheet is swapped for another with the same control ids | Nothing: focus stays with its scope. `modalScope(node, { focus })` picks the first focus |
| Writing the canvas's `aria-*` again after `Update`, or living with a frame-late ring | Nothing: `fenrir.ui.postUpdate` and `fenrir.ui.postInit` do it; `syncUi(ctx)` for a frame the game renders itself |
| `keys: { activate: [..., "NumpadEnter"] }` | Nothing: NumpadEnter is a default |
| A `summary` that reads the canvas's own label to return it | Return `undefined` |
| Clearing `UiFocus` whenever the game's sheet changes, so focus on a blocked HUD control does not survive a same-frame open and close | Nothing: the kit clears focus on a blocked control after each activation, `onClose` and `onAction` |
| A game `onDown(Tab)` that claims the keydown while a focus key is waiting for the frame | Nothing: Tab stays on the canvas while a press the kit reads is waiting |
| Arrows off, read as the game's `actions`, `moveFocus(ctx, ±1)`, then clearing `UiFocus` when focus did not move | `ui({ arrows: "clear" })` |
| Clearing `UiFocus` while `!input.focused` | `ui({ blurFocus: "clear" })` |
| A "tap requested" flag from a gameplay button's `onActivate` to the gameplay system, because the kit consumed its Enter | `control(node, { passThrough: true })`: gameplay sees the activate key as its own press |

```ts
import { defineAction } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { control, ui } from "fenrir-ts/ui";
import { Graphics } from "pixi.js";

const OpenBag = defineAction("myGame.openBag", ["KeyB", "Enter"]);
const pixi = pixi2d({ design: { width: 390, minHeight: 520 } });
declare const bag: { open: boolean; draw(): void };

const kit = ui({
  pixi,
  arrows: "linear",
  tapFocus: "clear",
  actions: [OpenBag],
  // Called in typed order with the kit's keys: an Escape after this in the same frame closes the bag.
  onAction: (_ctx, action) => {
    if (action !== OpenBag || bag.open) return false;
    bag.open = true;
    bag.draw(); // a modalScope with its controls
    return true;
  },
});

// A labelled, focusable gameplay button whose taps gameplay also reads, activated on the press.
const cast = control(new Graphics().circle(0, 0, 40).fill(0x2266aa), { id: "myGame.cast", label: "Cast", activateOn: "press", passThrough: true });
```

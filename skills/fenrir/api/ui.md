# `fenrir-ts/ui` API reference

Generated from the TSDoc in the source by `scripts/api-reference.mjs`. Do not edit: run `pnpm api:reference`.

Controls and modal scopes on Pixi nodes the game drew, driven by the engine's input.

Peer packages: `pixi.js`. Import from `fenrir-ts/ui` only, never from `dist/` or a source path.

## Contents

- Functions: [`activateControl`](#activatecontrol), [`control`](#control), [`listControls`](#listcontrols), [`modalScope`](#modalscope), [`moveFocus`](#movefocus), [`paginate`](#paginate), [`syncUi`](#syncui), [`ui`](#ui)
- Constants: [`ControlActivated`](#controlactivated), [`UiFocus`](#uifocus)
- Types: [`Activation`](#activation), [`ControlBounds`](#controlbounds), [`ControlInfo`](#controlinfo), [`ControlOptions`](#controloptions), [`FocusRingDrawer`](#focusringdrawer), [`HitArea`](#hitarea), [`ModalScopeOptions`](#modalscopeoptions), [`UiCtx`](#uictx), [`UiKeys`](#uikeys), [`UiOptions`](#uioptions)
- [Added to core types when imported](#added-to-core-types-when-imported)

## Functions

### activateControl

```ts
function activateControl(game: UiCtx, id: string): boolean;
```

Activates the live, unblocked control `id` as a tap would, with `via: "call"`, while the game
runs. Returns false, activating nothing, when no such control is live or it is disabled.

### control

```ts
function control<T extends Container>(node: T, options: ControlOptions): T;
```

Makes `node`, which the game drew, a control: tappable and focusable while it is in the scene,
visible and renderable, and gone once it is destroyed. Calling it again replaces the options.
Returns `node`.

### listControls

```ts
function listControls(game: UiCtx): ControlInfo[];
```

The live controls now, unblocked ones first in focus order, then those a modal scope blocks.

### modalScope

```ts
function modalScope<T extends Container>(node: T, options: ModalScopeOptions): T;
```

Makes `node` a modal scope: while it is live, only controls inside it take taps and focus,
every tap is kept from the game, and the `close` keys call `onClose`. Scopes nest: the one
shown last is on top. It ends when the node is hidden, removed or destroyed. Focus does not
carry from one scope to another, even to a control with the same id. Returns `node`.

### moveFocus

```ts
function moveFocus(game: UiCtx, delta: number, wrap?: boolean): string | null;
```

Moves focus `delta` places in focus order among the live, unblocked controls, and shows the
ring, as an arrow key does. From no focus, `1` goes to the first control and `-1` to the
last. Stops at the ends, or wraps round with `wrap`. Takes `game` or a system's `ctx`; returns
the focused id, `null` when no control is live.

### paginate

```ts
function paginate<T>(rows: readonly T[], capacity: number, page: number): {
    rows: T[];
    page: number;
    pages: number;
};
```

The page of `rows` that holds `capacity` rows per page. `page` is clamped into range, so a
list that shrank shows its last page; an empty list has one empty page.

### syncUi

```ts
function syncUi(game: UiCtx): void;
```

Brings the ring, the cursor and the canvas's `aria-label` and `aria-description` up to date
now. The kit does this after `Update` each frame (`fenrir.ui.postUpdate`) and before the game's
`PostInit` systems (`fenrir.ui.postInit`); call it after drawing controls in a later system and
before rendering, such as in a `PostInit` system that renders the first frame. While the game runs.

### ui

```ts
function ui(options?: UiOptions): Plugin;
```

The controls kit as a plugin: list it after `pixi2d` and pass that plugin, `ui({ pixi })`.
Registers `fenrir.ui.init` (Init: the ring and the canvas's saved attributes),
`fenrir.ui.preUpdate` (PreUpdate, before the game's own: keys, pointer presses and the game's
`actions` in the order they arrived), and `fenrir.ui.postInit` and `fenrir.ui.postUpdate`
(before the game's PostInit systems, and after Update before the renderer: the ring, cursor and
accessibility output, so they match the frame that is drawn). A game system that must see a
press before the kit runs passes `{ before: "fenrir.ui.preUpdate" }`.

## Constants

### ControlActivated

```ts
const ControlActivated: EventType<{ readonly id: string; readonly via: Activation; }>;
```

Sent each time a control activates, after its `onActivate`.

### UiFocus

```ts
interface UiFocus {
    id: string | null;
    visible: boolean;
}
const UiFocus: ResourceType<UiFocus>;
```

The focused control. Set `id` to move focus. It is cleared whenever the kit reads the display
tree and that control is not live or a modal scope blocks it: at the start and end of its pass,
after each activation, `onClose` and `onAction`, and in `syncUi`.

Members:

- `visible`: Show the ring: true after a key moves focus, false after a tap. The ring also needs the canvas focused.

## Types

### Activation

```ts
type Activation = "pointer" | "key" | "call";
```

How a control was activated: a pointer tap, a key on the focused control, or `activateControl`.

### ControlBounds

```ts
interface ControlBounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

An axis-aligned box in logical units: design units with `pixi2d({ design })`.

### ControlInfo

```ts
interface ControlInfo {
    readonly id: string;
    readonly label: string;
    readonly disabled: boolean;
    readonly focused: boolean;
    readonly blocked: boolean;
    readonly bounds: ControlBounds;
}
```

One live control, as `listControls(game)` and `inspect(game)` report it.

Members:

- `focused`: `UiFocus.id` is this control.
- `blocked`: Outside the top modal scope: takes no taps, focus or `activateControl`.
- `bounds`: The hit area's box in logical units, computed from the nodes' transforms, so correct in a test game that never renders: turn it into a click with `logicalToScreen`.

### ControlOptions

```ts
interface ControlOptions {
    readonly id: string;
    readonly label: string;
    readonly onActivate?: (ctx: SystemCtx, via: Activation) => void;
    readonly disabled?: boolean;
    readonly hitArea?: HitArea;
    readonly order?: number;
    readonly activateOn?: "press" | "release";
    readonly passThrough?: boolean;
}
```

What `control(node, options)` takes. `id` is required and must be unique among live controls.

Members:

- `id`: Names the control: focus, `ControlActivated`, `activateControl` and tests use it. Unique among live controls.
- `label`: What the control does, for people: the canvas's `aria-description` reads `Focused: <label>`.
- `onActivate`: Runs when the control activates, inside `fenrir.ui.preUpdate` (or `activateControl`), before `ControlActivated` is sent.
- `disabled`: Still takes focus and taps (so the press does not fall through to the game) but never activates.
- `hitArea`: Overrides the hit area, in the node's own units. Defaults to the node's local bounds.
- `order`: Focus order: lower first, ties in display order. Defaults to 0.
- `activateOn`: When a pointer activates the control. `"release"` (the default): a press and a release over it, in the frame that reports the release. `"press"`: in the frame of the press, for a button that times a tap; sliding off or cancelling then changes nothing. Keys always act on the press.
- `passThrough`: Lets a pointer press on the control through to the game: the kit does not consume it, so gameplay systems still see `pressed`, even inside a modal scope. The control still takes focus and taps and activates as `activateOn` says. The `activate` keys on the focused control are left unconsumed too, so gameplay sees Enter or Space as its own press. Either way the press is the kit's: it does not reach `onAction`.

### FocusRingDrawer

```ts
type FocusRingDrawer = (ring: Graphics, bounds: ControlBounds, control: ControlInfo) => void;
```

Draws the focus ring into `ring`, which the kit has cleared, around `bounds` (logical units).

### HitArea

```ts
type HitArea = {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
} | {
    readonly x: number;
    readonly y: number;
    readonly radius: number;
};
```

A hit area in the node's own units: a rectangle, or a circle for round buttons. Pixi's `Rectangle` and `Circle` fit.

### ModalScopeOptions

```ts
interface ModalScopeOptions {
    readonly label: string;
    readonly onClose?: (ctx: SystemCtx) => void;
    readonly focus?: string;
}
```

What `modalScope(node, options)` takes. While a scope is live, only controls inside it take input.

Members:

- `label`: The canvas's `aria-label` while this scope is on top, such as `"Shop"`.
- `onClose`: Called on Escape (the `close` keys) while this scope is on top. The game closes it: hide or destroy the node.
- `focus`: The id of a control in this scope that takes focus each time the scope comes on top. The ring shows if it showed before. Without it, focus from another scope is cleared.

### UiCtx

```ts
interface UiCtx {
    readonly resources: Resources;
}
```

What `game` or `ctx` the kit's functions take: anything with the game's `resources`.

### UiKeys

```ts
interface UiKeys {
    readonly tab?: readonly InputBinding[];
    readonly next?: readonly InputBinding[];
    readonly previous?: readonly InputBinding[];
    readonly activate?: readonly InputBinding[];
    readonly close?: readonly InputBinding[];
}
```

The keys the kit reads, as `KeyboardEvent.code` values. An empty list turns a key off.

Members:

- `tab`: Next control; with Shift the previous one. Leaves the canvas past either end. Default `["Tab"]`.
- `next`: Next control, as `arrows` says. Default `["ArrowDown", "ArrowRight"]`.
- `previous`: Previous control, as `arrows` says. Default `["ArrowUp", "ArrowLeft"]`.
- `activate`: Activates the focused control. Default `["Enter", "NumpadEnter", "Space"]`. Left to the game while nothing is focused.
- `close`: Calls the top modal scope's `onClose`. Default `["Escape"]`. Left to the game while no scope is open.

### UiOptions

```ts
interface UiOptions {
    readonly pixi?: Pixi2DPlugin;
    readonly root?: Container;
    readonly layers?: readonly string[];
    readonly keys?: UiKeys;
    readonly arrows?: "wrap" | "linear" | "clear";
    readonly tapFocus?: "focus" | "clear";
    readonly blurFocus?: "keep" | "clear";
    readonly focusRing?: FocusRingDrawer | false;
    readonly summary?: string | ((ctx: SystemCtx) => string | null | undefined);
    readonly hint?: string;
    readonly actions?: readonly ActionType[];
    readonly onAction?: (ctx: SystemCtx, action: ActionType) => boolean | void;
}
```

What the `ui()` plugin takes: `pixi` (the `pixi2d()` plugin) in a game, or `root` in a test game, then keys, arrows and focus behaviour.

Members:

- `pixi`: The `pixi2d()` plugin, listed before `ui` in `plugins`. Controls live under its `root` and `backdrop`, or in the `layers` listed.
- `root`: Instead of `pixi`: the container controls live under, whose local units are the logical units `ctx.input.pointer` reports. For a test game, which has no renderer.
- `layers`: With `pixi`: the `pixi2d({ layers })` names the kit looks for controls and scopes in, plus `"fenrir.backdrop"` for `renderer.backdrop`. Without it the kit walks `backdrop` and all of `root` each frame, every visible node in every layer, game sprites included; list only the layers that hold controls, such as `["hud", "menus"]`, so the walk costs what the UI does. Controls in an unlisted layer or added straight to `root` are then not live, with no warning. Hit testing and bounds stay in `root`'s logical units. An unknown name throws at install.
- `arrows`: How the `next` and `previous` keys move focus. `"wrap"` (the default): round from the last control to the first, only while a control has focus or a modal scope is open. `"linear"`: stop at the first and last control, and from no focus go to the first (`next`) or last (`previous`); the keys are the kit's whenever a control is live. `"clear"`: as `"linear"`, but past the first or last control focus goes to none, staying on the canvas, so the next key starts again from no focus.
- `tapFocus`: What a pointer press does to focus. `"focus"` (the default): a press on a control focuses it with no ring, and a press elsewhere keeps focus. `"clear"`: every press clears focus, so Enter after a tap is the game's again.
- `blurFocus`: What the canvas losing keyboard focus does to focus. `"keep"` (the default): focus stays and the ring is hidden, so returning to the canvas resumes on the same control. `"clear"`: focus is cleared in every frame that starts with the canvas blurred, so it starts again from none.
- `focusRing`: Replaces the default ring, or `false` for none.
- `summary`: The canvas's `aria-label` while no modal scope is open. A function is called each frame and may return nothing to leave the canvas's own label. Without it the canvas keeps its own.
- `hint`: The canvas's `aria-description` while controls exist and none has focus.
- `actions`: The game's own actions, read in the kit's ordered pass: each press goes to `onAction` in the order it was typed among the kit's keys and pointer presses, so a key that opens a sheet and an Escape after it in the same frame act in that order. Needs `onAction`.
- `onAction`: Called inside `fenrir.ui.preUpdate` for each press of one of `actions` that the kit did not act on itself (a key the kit uses acts first, under its own rules, and a pointer press on a control is the kit's even when `passThrough` leaves it unconsumed). The kit reads the display tree again after it returns, so controls and scopes drawn here are live for the next key. Return `true` to consume the press: later systems do not see it.

## Added to core types when imported

Importing `fenrir-ts/ui` adds these members to core types for the whole program.

### AssetKinds

```ts
interface AssetKinds {
    texture2d: PixiTexture;
}
```

### AssetStoreConfig

```ts
interface AssetStoreConfig {
    texture2DLoaders?: {
        [name: string]: PixiTextureLoaderConfig;
    };
}
```

### IAssetStore

```ts
interface IAssetStore {
    loadTexture2D(key: AssetKey, url: string): Promise<void>;
    getTexture2D(key: AssetKey): Promise<PixiTexture>;
    registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
    getSupportedTexture2DExtensions(): string[];
}
```

### AssetStore

```ts
interface AssetStore {
    loadTexture2D(key: AssetKey, url: string): Promise<void>;
    requestTexture2D(key: AssetKey, url: string): Texture2DHandle;
    getTexture2D(key: AssetKey): Promise<PixiTexture>;
    registerTexture2DLoader(name: string, config: PixiTextureLoaderConfig): void;
    getSupportedTexture2DExtensions(): string[];
}
```

- `requestTexture2D`: Reuses an active or ready request for the same key and URL. Request again to retry a failure.

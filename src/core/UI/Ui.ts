import { Graphics, type Container } from "pixi.js";
import { defineEvent } from "../EventQueue";
import type { Game, Plugin } from "../Game";
import type { ActionType, InputBinding } from "../Input/Action";
import type { InputImpl, InputPointer } from "../Input/Input";
import type { Pixi2DPlugin } from "../Renderer2D/pixi2d";
import { defineResource, peekResource, type Resources } from "../Resource";
import { Schedule } from "../Schedule";
import type { SystemCtx } from "../SystemCtx";
import { describeUi } from "./Access";

/** A hit area in the node's own units: a rectangle, or a circle for round buttons. Pixi's `Rectangle` and `Circle` fit. */
export type HitArea =
  | { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly x: number; readonly y: number; readonly radius: number };

/** How a control was activated: a pointer tap, a key on the focused control, or `activateControl`. */
export type Activation = "pointer" | "key" | "call";

/** What `control(node, options)` takes. `id` is required and must be unique among live controls. */
export interface ControlOptions {
  /** Names the control: focus, `ControlActivated`, `activateControl` and tests use it. Unique among live controls. */
  readonly id: string;
  /** What the control does, for people: the canvas's `aria-description` reads `Focused: <label>`. */
  readonly label: string;
  /** Runs when the control activates, inside `fenrir.ui.preUpdate` (or `activateControl`), before `ControlActivated` is sent. */
  readonly onActivate?: (ctx: SystemCtx, via: Activation) => void;
  /** Still takes focus and taps (so the press does not fall through to the game) but never activates. */
  readonly disabled?: boolean;
  /** Overrides the hit area, in the node's own units. Defaults to the node's local bounds. */
  readonly hitArea?: HitArea;
  /** Focus order: lower first, ties in display order. Defaults to 0. */
  readonly order?: number;
  /**
   * When a pointer activates the control. `"release"` (the default): a press and a release over
   * it, in the frame that reports the release. `"press"`: in the frame of the press, for a button
   * that times a tap; sliding off or cancelling then changes nothing. Keys always act on the press.
   */
  readonly activateOn?: "press" | "release";
  /**
   * Lets a pointer press on the control through to the game: the kit does not consume it, so
   * gameplay systems still see `pressed`, even inside a modal scope. The control still takes
   * focus and taps and activates as `activateOn` says. The `activate` keys on the focused control
   * are left unconsumed too, so gameplay sees Enter or Space as its own press. Either way the
   * press is the kit's: it does not reach `onAction`.
   */
  readonly passThrough?: boolean;
}

/** What `modalScope(node, options)` takes. While a scope is live, only controls inside it take input. */
export interface ModalScopeOptions {
  /** The canvas's `aria-label` while this scope is on top, such as `"Shop"`. */
  readonly label: string;
  /** Called on Escape (the `close` keys) while this scope is on top. The game closes it: hide or destroy the node. */
  readonly onClose?: (ctx: SystemCtx) => void;
  /**
   * The id of a control in this scope that takes focus each time the scope comes on top. The
   * ring shows if it showed before. Without it, focus from another scope is cleared.
   */
  readonly focus?: string;
}

/** An axis-aligned box in logical units: design units with `pixi2d({ design })`. */
export interface ControlBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** One live control, as `listControls(game)` and `inspect(game)` report it. */
export interface ControlInfo {
  readonly id: string;
  readonly label: string;
  readonly disabled: boolean;
  /** `UiFocus.id` is this control. */
  readonly focused: boolean;
  /** Outside the top modal scope: takes no taps, focus or `activateControl`. */
  readonly blocked: boolean;
  /** The hit area's box in logical units, computed from the nodes' transforms, so correct in a test game that never renders: turn it into a click with `logicalToScreen`. */
  readonly bounds: ControlBounds;
}

/** Draws the focus ring into `ring`, which the kit has cleared, around `bounds` (logical units). */
export type FocusRingDrawer = (ring: Graphics, bounds: ControlBounds, control: ControlInfo) => void;

/** The keys the kit reads, as `KeyboardEvent.code` values. An empty list turns a key off. */
export interface UiKeys {
  /** Next control; with Shift the previous one. Leaves the canvas past either end. Default `["Tab"]`. */
  readonly tab?: readonly InputBinding[];
  /** Next control, as `arrows` says. Default `["ArrowDown", "ArrowRight"]`. */
  readonly next?: readonly InputBinding[];
  /** Previous control, as `arrows` says. Default `["ArrowUp", "ArrowLeft"]`. */
  readonly previous?: readonly InputBinding[];
  /** Activates the focused control. Default `["Enter", "NumpadEnter", "Space"]`. Left to the game while nothing is focused. */
  readonly activate?: readonly InputBinding[];
  /** Calls the top modal scope's `onClose`. Default `["Escape"]`. Left to the game while no scope is open. */
  readonly close?: readonly InputBinding[];
}

/** What `game` or `ctx` the kit's functions take: anything with the game's `resources`. */
export interface UiCtx {
  readonly resources: Resources;
}

/** What the `ui()` plugin takes: `pixi` (the `pixi2d()` plugin) in a game, or `root` in a test game, then keys, arrows and focus behaviour. */
export interface UiOptions {
  /** The `pixi2d()` plugin, listed before `ui` in `plugins`. Controls live under its `root` and `backdrop`. */
  readonly pixi?: Pixi2DPlugin;
  /**
   * Instead of `pixi`: the container controls live under, whose local units are the logical
   * units `ctx.input.pointer` reports. For a test game, which has no renderer.
   */
  readonly root?: Container;
  readonly keys?: UiKeys;
  /**
   * How the `next` and `previous` keys move focus. `"wrap"` (the default): round from the last
   * control to the first, only while a control has focus or a modal scope is open. `"linear"`:
   * stop at the first and last control, and from no focus go to the first (`next`) or last
   * (`previous`); the keys are the kit's whenever a control is live. `"clear"`: as `"linear"`,
   * but past the first or last control focus goes to none, staying on the canvas, so the next
   * key starts again from no focus.
   */
  readonly arrows?: "wrap" | "linear" | "clear";
  /**
   * What a pointer press does to focus. `"focus"` (the default): a press on a control focuses it
   * with no ring, and a press elsewhere keeps focus. `"clear"`: every press clears focus, so
   * Enter after a tap is the game's again.
   */
  readonly tapFocus?: "focus" | "clear";
  /**
   * What the canvas losing keyboard focus does to focus. `"keep"` (the default): focus stays and
   * the ring is hidden, so returning to the canvas resumes on the same control. `"clear"`: focus
   * is cleared in every frame that starts with the canvas blurred, so it starts again from none.
   */
  readonly blurFocus?: "keep" | "clear";
  /** Replaces the default ring, or `false` for none. */
  readonly focusRing?: FocusRingDrawer | false;
  /**
   * The canvas's `aria-label` while no modal scope is open. A function is called each frame and
   * may return nothing to leave the canvas's own label. Without it the canvas keeps its own.
   */
  readonly summary?: string | ((ctx: SystemCtx) => string | null | undefined);
  /** The canvas's `aria-description` while controls exist and none has focus. */
  readonly hint?: string;
  /**
   * The game's own actions, read in the kit's ordered pass: each press goes to `onAction` in the
   * order it was typed among the kit's keys and pointer presses, so a key that opens a sheet and
   * an Escape after it in the same frame act in that order. Needs `onAction`.
   */
  readonly actions?: readonly ActionType[];
  /**
   * Called inside `fenrir.ui.preUpdate` for each press of one of `actions` that the kit did not
   * act on itself (a key the kit uses acts first, under its own rules, and a pointer press on a
   * control is the kit's even when `passThrough` leaves it unconsumed). The kit reads the display
   * tree again after it returns, so controls and scopes drawn here are live for the next key.
   * Return `true` to consume the press: later systems do not see it.
   */
  readonly onAction?: (ctx: SystemCtx, action: ActionType) => boolean | void;
}

/**
 * The focused control. Set `id` to move focus. It is cleared whenever the kit reads the display
 * tree and that control is not live or a modal scope blocks it: at the start and end of its pass,
 * after each activation, `onClose` and `onAction`, and in `syncUi`.
 */
export interface UiFocus {
  id: string | null;
  /** Show the ring: true after a key moves focus, false after a tap. The ring also needs the canvas focused. */
  visible: boolean;
}

/** The focused control, `fenrir.UiFocus`. Readable and settable from systems and tests. */
export const UiFocus = defineResource<UiFocus>("fenrir.UiFocus", () => ({ id: null, visible: false }));

/** Sent each time a control activates, after its `onActivate`. */
export const ControlActivated = defineEvent<{ readonly id: string; readonly via: Activation }>("fenrir.ui.activated");

// Options live with the node, so a control goes when its node is collected: no registry to leak.
const controls = new WeakMap<Container, ControlOptions>();
const scopes = new WeakMap<Container, ModalScopeOptions>();

/**
 * Makes `node`, which the game drew, a control: tappable and focusable while it is in the scene,
 * visible and renderable, and gone once it is destroyed. Calling it again replaces the options.
 * Returns `node`.
 */
export function control<T extends Container>(node: T, options: ControlOptions): T {
  if (!options || typeof options.id !== "string" || !options.id || typeof options.label !== "string") {
    throw new TypeError("control needs { id, label }: a non-empty id and a label.");
  }
  controls.set(node, options);
  return node;
}

/**
 * Makes `node` a modal scope: while it is live, only controls inside it take taps and focus,
 * every tap is kept from the game, and the `close` keys call `onClose`. Scopes nest: the one
 * shown last is on top. It ends when the node is hidden, removed or destroyed. Focus does not
 * carry from one scope to another, even to a control with the same id. Returns `node`.
 */
export function modalScope<T extends Container>(node: T, options: ModalScopeOptions): T {
  if (!options || typeof options.label !== "string") throw new TypeError("modalScope needs { label }.");
  scopes.set(node, options);
  return node;
}

/**
 * The page of `rows` that holds `capacity` rows per page. `page` is clamped into range, so a
 * list that shrank shows its last page; an empty list has one empty page.
 */
export function paginate<T>(rows: readonly T[], capacity: number, page: number): { rows: T[]; page: number; pages: number } {
  if (!(Number.isInteger(capacity) && capacity > 0)) throw new RangeError(`paginate: capacity ${capacity} is not a positive integer.`);
  const pages = Math.max(1, Math.ceil(rows.length / capacity));
  const at = Math.min(pages - 1, Math.max(0, Math.floor(page) || 0));
  return { rows: rows.slice(at * capacity, at * capacity + capacity), page: at, pages };
}

/** A live control: its node, its options and the modal scopes it is inside. */
type Live = { readonly n: Container; readonly c: ControlOptions; readonly s: readonly Container[] };

/** Internal. What the kit's functions and `inspect` reach in a game's kit. */
interface UiApi {
  list(): ControlInfo[];
  call(id: string): boolean;
  move(delta: number, wrap: boolean): string | null;
  sync(): void;
  toJSON(): unknown;
}

/** Internal. `fenrir.UiControls`: shown by `inspect(game)` as `{ modal, controls }`, as of the latest frame. */
const UiControls = defineResource<UiApi>("fenrir.UiControls");

function api(game: UiCtx): UiApi {
  const kit = peekResource(game.resources, UiControls);
  if (!kit) throw new Error("This game has no ui() plugin.");
  return kit;
}

/**
 * Activates the live, unblocked control `id` as a tap would, with `via: "call"`, while the game
 * runs. Returns false, activating nothing, when no such control is live or it is disabled.
 */
export function activateControl(game: UiCtx, id: string): boolean {
  return api(game).call(id);
}

/** The live controls now, unblocked ones first in focus order, then those a modal scope blocks. */
export function listControls(game: UiCtx): ControlInfo[] {
  return api(game).list();
}

/**
 * Moves focus `delta` places in focus order among the live, unblocked controls, and shows the
 * ring, as an arrow key does. From no focus, `1` goes to the first control and `-1` to the
 * last. Stops at the ends, or wraps round with `wrap`. Takes `game` or a system's `ctx`; returns
 * the focused id, `null` when no control is live.
 */
export function moveFocus(game: UiCtx, delta: number, wrap = false): string | null {
  return api(game).move(delta, wrap);
}

/**
 * Brings the ring, the cursor and the canvas's `aria-label` and `aria-description` up to date
 * now. The kit does this after `Update` each frame (`fenrir.ui.postUpdate`) and before the game's
 * `PostInit` systems (`fenrir.ui.postInit`); call it after drawing controls in a later system and
 * before rendering, such as in a `PostInit` system that renders the first frame. While the game runs.
 */
export function syncUi(game: UiCtx): void {
  api(game).sync();
}

const keyAction = (name: string, keys: readonly InputBinding[]): ActionType | undefined =>
  keys.length ? { name: `fenrir.ui.${name}`, bindings: keys } : undefined;

const defaultRing: FocusRingDrawer = (ring, { x, y, width, height }) => {
  ring.roundRect(x - 4, y - 4, width + 8, height + 8, 6).stroke({ width: 3, color: 0xffd166 });
};

/** In a hit area, given in the node's units. */
const inside = (a: HitArea, x: number, y: number): boolean =>
  "radius" in a ? (x - a.x) ** 2 + (y - a.y) ** 2 <= a.radius ** 2 : x >= a.x && y >= a.y && x <= a.x + a.width && y <= a.y + a.height;

/** Rounded to a thousandth of a unit, so a box drawn at 20 reads 20, not 20.00000000000003. */
const round = (v: number): number => Math.round(v * 1000) / 1000;

/** How `move` treats the ends of the focus order: Tab leaves past them, arrows wrap or stop. */
const LEAVE = 0;
const WRAP = 1;
const STOP = 2;

/**
 * The controls kit as a plugin: list it after `pixi2d` and pass that plugin, `ui({ pixi })`.
 * Registers `fenrir.ui.init` (Init: the ring and the canvas's saved attributes),
 * `fenrir.ui.preUpdate` (PreUpdate, before the game's own: keys, pointer presses and the game's
 * `actions` in the order they arrived), and `fenrir.ui.postInit` and `fenrir.ui.postUpdate`
 * (before the game's PostInit systems, and after Update before the renderer: the ring, cursor and
 * accessibility output, so they match the frame that is drawn). A game system that must see a
 * press before the kit runs passes `{ before: "fenrir.ui.preUpdate" }`.
 */
export function ui(options: UiOptions = {}): Plugin {
  const {
    pixi,
    root,
    keys = {},
    arrows = "wrap",
    tapFocus = "focus",
    blurFocus = "keep",
    focusRing = defaultRing,
    summary,
    hint = "Press Tab to move between the controls.",
    actions: gameActions = [],
    onAction,
  } = options;
  if (gameActions.length && !onAction) throw new TypeError("ui: actions need onAction, which the kit calls for each press of one.");
  return {
    name: "fenrir.ui",
    install(game: Game): void {
      let renderer: Pixi2DPlugin["renderer"] | undefined;
      try {
        renderer = pixi?.renderer;
      } catch {
        // Not installed yet: reported below.
      }
      if (!renderer && !root) {
        throw new Error("ui needs the 2D renderer: list pixi2d() before ui() in plugins and pass it, ui({ pixi }). A test game passes ui({ root }).");
      }
      const space = renderer?.root ?? root!;
      const roots = renderer ? [renderer.backdrop, renderer.root] : [root!];
      const canvas = renderer ? game.canvas : undefined;
      const input = game.input as InputImpl;
      const { resources } = game;
      const focus = (): UiFocus => resources.get(UiFocus);

      /** Live controls in display order, duplicates dropped. */
      let live: Live[] = [];
      /** Live controls inside the top scope, in focus order. */
      let order: Live[] = [];
      let top: Container | undefined;
      /** The top scope the last walk saw, to notice when another comes on top. */
      let lastTop: Container | undefined;
      /** When each live scope was first seen live: the latest is on top. */
      let stamps = new Map<Container, number>();
      let seq = 0;
      const warned = new Set<string>();
      /** The focused id the last walk left, and the innermost scope (null: none) its control was in; undefined: not found since it changed. */
      let lastId: string | null = null;
      let owner: Container | null | undefined;
      /** A pointer press is in progress, on the control `pressed` (null: on nothing). */
      let pressing = false;
      let pressed: string | null = null;
      /** The frame the press started in, and the pointer as of the previous frame. */
      let pressFrame = 0;
      let frame = 0;
      let at: InputPointer | undefined;
      /** Directions of the Tab presses since the last frame, as each keydown decided them. */
      let tabs: number[] = [];
      /** A press the pass reads, other than Tab, went down since the last frame: it may move focus or redraw first. */
      let waiting = false;
      let run: SystemCtx | undefined;

      const blocked = (l: Live): boolean => !!top && !l.s.includes(top);
      const find = (id: string | null): Live | undefined => order.find((l) => l.c.id === id);

      /** Walks the display tree for live controls and scopes, and keeps focus from moving between scopes. */
      const refresh = (): void => {
        const ids = new Set<string>();
        const shown = new Map<Container, number>();
        live = [];
        const visit = (node: Container, within: readonly Container[]): void => {
          if (!node.visible || !node.renderable || node.destroyed) return;
          if (scopes.has(node)) {
            within = [...within, node];
            shown.set(node, stamps.get(node) ?? ++seq);
          }
          const c = controls.get(node);
          if (c && !ids.has(c.id)) {
            ids.add(c.id);
            live.push({ n: node, c, s: within });
          } else if (c && !warned.has(c.id)) {
            warned.add(c.id);
            game.logger.warn(`ui: duplicate control id "${c.id}": the later one is ignored.`);
          }
          for (const child of node.children) visit(child, within);
        };
        for (const node of roots) visit(node, []);
        let best = 0;
        top = undefined;
        for (const [node, stamp] of shown) if (stamp > best) (best = stamp), (top = node);
        stamps = shown;
        order = live.filter((l) => !blocked(l)).sort((a, b) => (a.c.order ?? 0) - (b.c.order ?? 0));

        const f = focus();
        if (f.id !== lastId) owner = undefined; // the game or the kit moved focus: take it where it lands
        if (top !== lastTop) {
          lastTop = top;
          const want = top && scopes.get(top)!.focus;
          if (want && find(want)) (f.id = want), (owner = undefined);
        }
        const l = find(f.id);
        if (l) {
          const s = l.s.at(-1) ?? null;
          if (owner === undefined) owner = s;
          // The same id in another scope is another control: focus stays with the scope it was in.
          else if (s !== owner) (f.id = null), (owner = undefined);
        } else f.id = null; // not live, or blocked by a scope that opened since focus was set
        lastId = f.id;
      };

      /** The topmost unblocked control under a point in logical units. */
      const hitAt = (p: { readonly x: number; readonly y: number }): Live | undefined => {
        for (let i = live.length - 1; i >= 0; i--) {
          const l = live[i]!;
          const { x, y } = l.n.toLocal(p, space);
          if (!blocked(l) && inside(l.c.hitArea ?? l.n.getLocalBounds(), x, y)) return l;
        }
        return undefined;
      };

      /** Where moving `d` places goes: an index into `order`, out of range past either end. From no focus, 1 is the first. */
      const target = (d: number): number => {
        const i = order.findIndex((l) => l.c.id === focus().id);
        return i < 0 ? (d > 0 ? d - 1 : order.length + d) : i + d;
      };

      const move = (d: number, ends: number): void => {
        const n = order.length;
        let j = target(d);
        if (ends === WRAP) j = ((j % n) + n) % n;
        else if (ends === STOP) j = Math.max(0, Math.min(n - 1, j));
        Object.assign(focus(), { id: order[j]?.c.id ?? null, visible: true });
      };

      const activate = (l: Live, via: Activation): boolean => {
        if (!run) throw new Error("ui: the game is not running.");
        if (l.c.disabled) return false;
        l.c.onActivate?.(run, via);
        run.events.send(ControlActivated, { id: l.c.id, via });
        refresh(); // the handler may have redrawn the controls
        return true;
      };

      const info = (l: Live): ControlInfo => {
        const { id, label, disabled = false } = l.c;
        const a = l.c.hitArea ?? l.n.getLocalBounds();
        const r = "radius" in a ? { x: a.x - a.radius, y: a.y - a.radius, width: 2 * a.radius, height: 2 * a.radius } : a;
        const xs: number[] = [];
        const ys: number[] = [];
        for (const [x, y] of [[r.x, r.y], [r.x + r.width, r.y], [r.x, r.y + r.height], [r.x + r.width, r.y + r.height]]) {
          const p = space.toLocal({ x: x!, y: y! }, l.n);
          xs.push(p.x);
          ys.push(p.y);
        }
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        const bounds = { x: round(x), y: round(y), width: round(Math.max(...xs) - x), height: round(Math.max(...ys) - y) };
        return { id, label, disabled, focused: id === peekResource(resources, UiFocus)?.id, blocked: blocked(l), bounds };
      };

      const list = (): ControlInfo[] => [...order, ...live.filter(blocked)].filter((l) => !l.n.destroyed).map(info);

      /** The press in progress ends: it activates its control if the pointer lifted over it at `p`. */
      const release = (p: InputPointer | undefined): void => {
        const hit = pressed !== null && p ? hitAt(p) : undefined;
        pressing = false;
        if (hit && hit.c.id === pressed) activate(hit, "pointer");
        pressed = null;
      };

      /** A pointer press. Returns whether the kit took it: it hit a control or a scope is open. */
      const press = (pointer: InputPointer): boolean => {
        // A press while one is in progress: the pointer lifted between frames, where it was last seen.
        if (pressing) release(pressFrame === frame ? pointer : at);
        pressing = true;
        pressFrame = frame;
        const hit = hitAt(pointer);
        const f = focus();
        pressed = hit ? hit.c.id : null;
        if (tapFocus === "clear") f.id = null;
        else if (hit) Object.assign(f, { id: hit.c.id, visible: false });
        if (hit?.c.activateOn === "press") (pressed = null), activate(hit, "pointer");
        if (hit ? !hit.c.passThrough : top) input.consumePointer();
        // A press on a passThrough control is left to gameplay, but it is still the kit's, not onAction's.
        return !!hit || !!top;
      };

      const tab = keyAction("tab", keys.tab ?? ["Tab"]);
      const next = keyAction("next", keys.next ?? ["ArrowDown", "ArrowRight"]);
      const previous = keyAction("previous", keys.previous ?? ["ArrowUp", "ArrowLeft"]);
      const activateKey = keyAction("activate", keys.activate ?? ["Enter", "NumpadEnter", "Space"]);
      const close = keyAction("close", keys.close ?? ["Escape"]);
      const tap = keyAction("pointer", ["pointer.primary"])!;
      const kitKeys = [tab, next, previous, activateKey, close].filter((a) => !!a);
      // The pointer and the kit's keys first: for one key bound to both, the kit acts first under its rules.
      const all = [tap, ...kitKeys, ...gameActions];

      /** One of the kit's keys went down. Returns whether the kit acted on it; it consumes the key unless a passThrough control took it. */
      const key = (action: ActionType, ctx: SystemCtx): boolean => {
        const f = focus();
        if (action === tab) {
          const dir = tabs.shift() ?? 1;
          if (!order.length && f.id === null) return false;
          move(dir, LEAVE);
        } else if (action === next || action === previous) {
          const d = action === next ? 1 : -1;
          if (arrows === "wrap" ? f.id === null && !top : !order.length) return false;
          if (order.length) move(d, arrows === "wrap" ? WRAP : arrows === "linear" ? STOP : LEAVE);
        } else if (action === activateKey) {
          const l = find(f.id);
          if (!l) return false;
          activate(l, "key");
          if (l.c.passThrough) return true; // gameplay sees the key as its own press
        } else {
          const scope = top && scopes.get(top);
          if (!scope) return false;
          scope.onClose?.(ctx);
          refresh();
        }
        ctx.input.consume(action);
        return true;
      };

      let ring: Graphics | undefined;
      let ringKey = "";
      const newRing = (): Graphics => ((ringKey = ""), new Graphics({ label: "fenrir.ui.focusRing", visible: false }));
      let cursor = "";
      const attrs = ["aria-label", "aria-description"];
      let saved: (string | null)[] = [];

      /** The ring, the cursor and the canvas's accessibility output, for the controls as they are now. */
      const sync = (): void => {
        const ctx = run;
        if (!ctx) throw new Error("ui: the game is not running.");
        if (blurFocus === "clear" && !ctx.input.focused) focus().id = null;
        refresh();
        const f = focus();
        const focused = find(f.id);

        // The game may have cleared the container the ring was in.
        if (ring?.destroyed) space.addChild((ring = newRing()));
        if (ring) {
          const shown = f.visible && ctx.input.focused ? focused : undefined;
          ring.visible = !!shown;
          if (shown) {
            const box = info(shown);
            const key = JSON.stringify(box);
            if (key !== ringKey) {
              ring.clear();
              (focusRing as FocusRingDrawer)(ring, box.bounds, box);
              ringKey = key;
            }
            if (space.children.at(-1) !== ring) space.addChild(ring);
          }
        }

        if (canvas) {
          const { pointer } = ctx.input;
          const hover = pointer.inside ? hitAt(pointer) : undefined;
          const want = hover && !hover.c.disabled ? "pointer" : cursor;
          if (canvas.style.cursor !== want) canvas.style.cursor = want;
          const out = describeUi(
            order.map((l) => l.c),
            focused?.c,
            (top && scopes.get(top)?.label) ?? (typeof summary === "function" ? summary(ctx) ?? undefined : summary),
            hint,
          );
          set(canvas, attrs[0]!, out.label ?? saved[0]!);
          set(canvas, attrs[1]!, out.description ?? saved[1]!);
        }
      };

      resources.set(UiControls, {
        list: () => (refresh(), list()),
        call: (id) => {
          refresh();
          const l = find(id);
          return !!l && activate(l, "call");
        },
        move: (delta, wrap) => {
          refresh();
          if (delta) move(Math.trunc(delta), wrap ? WRAP : STOP);
          return focus().id;
        },
        sync,
        toJSON: () => ({ modal: (top && scopes.get(top)?.label) ?? null, controls: list() }),
      });

      // Tab stays on the canvas while it moves to a control, and leaves it past either end.
      if (tab) {
        game.input.onDown(tab, (event) => {
          refresh();
          const back = event && "shiftKey" in event ? event.shiftKey : input.isDown("ShiftLeft") || input.isDown("ShiftRight");
          // Where the Tabs still waiting for the frame leave focus, as an index into `order` (-1: none).
          let i = order.findIndex((l) => l.c.id === focus().id);
          for (const d of tabs) i = i < 0 ? (d > 0 ? 0 : order.length - 1) : i + d >= 0 && i + d < order.length ? i + d : -1;
          // The frame moves focus the way this event decided, even if Shift went down before the canvas had focus.
          if (!(event as KeyboardEvent | undefined)?.repeat) tabs.push(back ? -1 : 1);
          const j = i < 0 ? (back ? order.length - 1 : 0) : i + (back ? -1 : 1);
          // Another press waiting for the frame acts first and may move focus or open a sheet: stay on the canvas.
          return waiting || (j >= 0 && j < order.length);
        });
      }
      // Every other press the pass reads, so a Tab typed after one in the same frame stays on the canvas.
      for (const action of [tap, ...kitKeys, ...gameActions]) if (action !== tab) game.input.onDown(action, () => void (waiting = true));

      game
        .addSystem(Schedule.Init, function init(ctx) {
          run = ctx;
          if (focusRing) space.addChild((ring = newRing()));
          if (canvas) {
            cursor = canvas.style.cursor;
            saved = attrs.map((name) => canvas.getAttribute(name));
          }
          ctx.onCleanup(() => {
            ring?.destroy();
            ring = run = top = lastTop = at = owner = undefined;
            waiting = false;
            if (canvas) {
              canvas.style.cursor = cursor;
              attrs.forEach((name, i) => set(canvas, name, saved[i]!));
            }
            if (resources.has(UiFocus)) focus().id = null;
            live = order = tabs = [];
            pressed = lastId = null;
            stamps.clear();
            pressing = false;
          });
        }, { name: "fenrir.ui.init", ...(renderer && { after: "fenrir.pixi.init" }) })
        .addSystem(Schedule.PostInit, () => sync(), { name: "fenrir.ui.postInit" })
        .addSystem(Schedule.PreUpdate, function preUpdate(ctx) {
          const { input } = ctx;
          const { pointer } = input;
          run = ctx;
          frame++;
          waiting = false;
          if (blurFocus === "clear" && !input.focused) focus().id = null;
          const edges = input.edges(all);
          // Nothing arrived: the walk from the end of the last frame stands.
          if (!edges.length && !(pressing && !pointer.down)) return void ((tabs = []), (at = pointer));
          refresh();

          // One pass in arrival order. Edges of one key press are next to each other, the kit's first:
          // once the kit or the game acts on a press, the rest of its edges are skipped.
          let acted = false;
          edges.forEach((edge, i) => {
            const { action, kind, binding } = edge;
            const last = edges[i - 1];
            if (last?.binding !== binding || last.kind !== kind) acted = false;
            if (kind !== "pressed" || acted) return;
            if (action === tap) acted = press(pointer);
            else if (kitKeys.includes(action)) acted = key(action, ctx);
            else {
              acted = onAction!(ctx, action) === true;
              if (acted) input.consume(action);
              refresh(); // the game may have drawn a sheet for the next key
            }
          });
          if (pressing && !pointer.down) release(pointer.cancelled ? undefined : pointer);
          at = pointer;
          tabs = [];
          refresh();
        }, { name: "fenrir.ui.preUpdate" })
        .addSystem(Schedule.PostUpdate, () => sync(), { name: "fenrir.ui.postUpdate", ...(renderer && { before: "fenrir.pixi.postUpdate" }) });
    },
  };
}

function set(canvas: HTMLCanvasElement, name: string, value: string | null): void {
  if (canvas.getAttribute(name) === value) return;
  if (value === null) canvas.removeAttribute(name);
  else canvas.setAttribute(name, value);
}

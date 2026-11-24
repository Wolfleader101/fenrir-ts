import { Graphics, type Container } from "pixi.js";
import { defineEvent } from "../EventQueue";
import type { Game, GameBase, Plugin } from "../Game";
import type { ActionType, InputBinding } from "../Input/Action";
import type { InputImpl, InputPointer } from "../Input/Input";
import type { Pixi2DPlugin } from "../Renderer2D/pixi2d";
import { defineResource, peekResource } from "../Resource";
import { Schedule } from "../Schedule";
import type { SystemCtx } from "../SystemCtx";
import { describeUi } from "./Access";

/** A hit area in the node's own units: a rectangle, or a circle for round buttons. Pixi's `Rectangle` and `Circle` fit. */
export type HitArea =
  | { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  | { readonly x: number; readonly y: number; readonly radius: number };

/** How a control was activated: a pointer tap, a key on the focused control, or `activateControl`. */
export type Activation = "pointer" | "key" | "call";

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
}

export interface ModalScopeOptions {
  /** The canvas's `aria-label` while this scope is on top, such as `"Shop"`. */
  readonly label: string;
  /** Called on Escape (the `close` keys) while this scope is on top. The game closes it: hide or destroy the node. */
  readonly onClose?: (ctx: SystemCtx) => void;
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
  /** The hit area's box in logical units, as of the latest render: turn it into a click with `logicalToScreen`. */
  readonly bounds: ControlBounds;
}

/** Draws the focus ring into `ring`, which the kit has cleared, around `bounds` (logical units). */
export type FocusRingDrawer = (ring: Graphics, bounds: ControlBounds, control: ControlInfo) => void;

/** The keys the kit reads, as `KeyboardEvent.code` values. An empty list turns a key off. */
export interface UiKeys {
  /** Next control; with Shift the previous one. Leaves the canvas past either end. Default `["Tab"]`. */
  readonly tab?: readonly InputBinding[];
  /** Next control, wrapping, while a control has focus or a modal scope is open. Default `["ArrowDown", "ArrowRight"]`. */
  readonly next?: readonly InputBinding[];
  /** Previous control, wrapping, under the same rule. Default `["ArrowUp", "ArrowLeft"]`. */
  readonly previous?: readonly InputBinding[];
  /** Activates the focused control. Default `["Enter", "Space"]`. Left to the game while nothing is focused. */
  readonly activate?: readonly InputBinding[];
  /** Calls the top modal scope's `onClose`. Default `["Escape"]`. Left to the game while no scope is open. */
  readonly close?: readonly InputBinding[];
}

export interface UiOptions {
  /** The `pixi2d()` plugin, listed before `ui` in `plugins`. Controls live under its `root` and `backdrop`. */
  readonly pixi?: Pixi2DPlugin;
  /**
   * Instead of `pixi`: the container controls live under, whose local units are the logical
   * units `ctx.input.pointer` reports. For a test game, which has no renderer.
   */
  readonly root?: Container;
  readonly keys?: UiKeys;
  /** Replaces the default ring, or `false` for none. */
  readonly focusRing?: FocusRingDrawer | false;
  /** The canvas's `aria-label` while no modal scope is open. Without it the canvas keeps its own. */
  readonly summary?: string | ((ctx: SystemCtx) => string);
  /** The canvas's `aria-description` while controls exist and none has focus. */
  readonly hint?: string;
}

/** The focused control. Set `id` to move focus; it is cleared when that control is not live or is blocked. */
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
 * shown last is on top. It ends when the node is hidden, removed or destroyed. Returns `node`.
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

/** Internal. What `activateControl`, `listControls` and `inspect` reach in a game's kit. */
interface UiApi {
  list(): ControlInfo[];
  call(id: string): boolean;
  toJSON(): unknown;
}

/** Internal. `fenrir.UiControls`: shown by `inspect(game)` as `{ modal, controls }`, as of the latest frame. */
const UiControls = defineResource<UiApi>("fenrir.UiControls");

function api(game: GameBase): UiApi {
  const kit = peekResource(game.resources, UiControls);
  if (!kit) throw new Error("This game has no ui() plugin.");
  return kit;
}

/**
 * Activates the live, unblocked control `id` as a tap would, with `via: "call"`, while the game
 * runs. Returns false, activating nothing, when no such control is live or it is disabled.
 */
export function activateControl(game: GameBase, id: string): boolean {
  return api(game).call(id);
}

/** The live controls now, unblocked ones first in focus order, then those a modal scope blocks. */
export function listControls(game: GameBase): ControlInfo[] {
  return api(game).list();
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

/**
 * The controls kit as a plugin: list it after `pixi2d` and pass that plugin, `ui({ pixi })`.
 * Registers `fenrir.ui.init` (Init: the ring and the canvas's accessibility output) and
 * `fenrir.ui.preUpdate` (PreUpdate: pointer and keys to controls, before the game's own
 * PreUpdate systems). A game system that must see a press before the kit runs passes
 * `{ before: "fenrir.ui.preUpdate" }`.
 */
export function ui(options: UiOptions = {}): Plugin {
  const { pixi, root, keys = {}, focusRing = defaultRing, summary, hint = "Press Tab to move between the controls." } = options;
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
      /** When each live scope was first seen live: the latest is on top. */
      let stamps = new Map<Container, number>();
      let seq = 0;
      const warned = new Set<string>();
      let pressed: string | null = null;
      let wasDown = false;
      /** Directions of the Tab presses since the last frame, as each keydown decided them. */
      let tabs: number[] = [];
      let run: SystemCtx | undefined;

      const blocked = (l: Live): boolean => !!top && !l.s.includes(top);
      const find = (id: string | null): Live | undefined => order.find((l) => l.c.id === id);

      /** Walks the display tree for live controls and scopes. */
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

      /** Where Tab (1) or Shift+Tab (-1) moves focus: an index into `order`, out of range past either end. */
      const step = (dir: number): number => {
        const i = order.findIndex((l) => l.c.id === focus().id);
        return i < 0 ? (dir > 0 ? 0 : order.length - 1) : i + dir;
      };

      const move = (dir: number, wrap: boolean): void => {
        let j = step(dir);
        if (wrap) j = (j + order.length) % order.length;
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

      resources.set(UiControls, {
        list: () => (refresh(), list()),
        call: (id) => {
          refresh();
          const l = find(id);
          return !!l && activate(l, "call");
        },
        toJSON: () => ({ modal: (top && scopes.get(top)?.label) ?? null, controls: list() }),
      });

      const tab = keyAction("tab", keys.tab ?? ["Tab"]);
      const next = keyAction("next", keys.next ?? ["ArrowDown", "ArrowRight"]);
      const previous = keyAction("previous", keys.previous ?? ["ArrowUp", "ArrowLeft"]);
      const activateKey = keyAction("activate", keys.activate ?? ["Enter", "Space"]);
      const close = keyAction("close", keys.close ?? ["Escape"]);
      const actions = [tab, next, previous, activateKey, close].filter((a) => !!a);

      // Tab stays on the canvas while it moves to a control, and leaves it past either end.
      if (tab) {
        game.input.onDown(tab, (event) => {
          refresh();
          const back = event && "shiftKey" in event ? event.shiftKey : input.isDown("ShiftLeft") || input.isDown("ShiftRight");
          // The frame moves focus the way this event decided, even if Shift went down before the canvas had focus.
          if (!(event as KeyboardEvent | undefined)?.repeat) tabs.push(back ? -1 : 1);
          const j = step(back ? -1 : 1);
          return j >= 0 && j < order.length;
        });
      }

      let ring: Graphics | undefined;
      let ringKey = "";
      const newRing = (): Graphics => ((ringKey = ""), new Graphics({ label: "fenrir.ui.focusRing", visible: false }));
      let cursor = "";
      const attrs = ["aria-label", "aria-description"];
      let saved: (string | null)[] = [];

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
            ring = run = top = undefined;
            if (canvas) {
              canvas.style.cursor = cursor;
              attrs.forEach((name, i) => set(canvas, name, saved[i]!));
            }
            if (resources.has(UiFocus)) focus().id = null;
            live = order = tabs = [];
            pressed = null;
            stamps.clear();
            wasDown = false;
          });
        }, { name: "fenrir.ui.init", ...(renderer && { after: "fenrir.pixi.init" }) })
        .addSystem(Schedule.PreUpdate, function preUpdate(ctx) {
          const { input } = ctx;
          const f = focus();
          run = ctx;
          refresh();
          if (!find(f.id)) f.id = null;

          for (const { action, kind } of input.edges(actions)) {
            if (kind !== "pressed") continue;
            const scope = top && scopes.get(top);
            if (action === tab) {
              if (!order.length && f.id === null) continue;
              move(tabs.shift() ?? 1, false);
            } else if (action === next || action === previous) {
              if (f.id === null && !top) continue;
              if (order.length) move(action === next ? 1 : -1, true);
            } else if (action === activateKey) {
              const l = find(f.id);
              if (!l) continue;
              activate(l, "key");
            } else {
              if (!scope) continue;
              scope.onClose?.(ctx);
              refresh();
            }
            input.consume(action);
          }

          const pointer: InputPointer = input.pointer;
          if (pointer.down && !wasDown) {
            const hit = hitAt(pointer);
            if (hit) Object.assign(f, { id: (pressed = hit.c.id), visible: false });
            if (hit || top) input.consumePointer();
          } else if (!pointer.down && wasDown) {
            const hit = pressed !== null && !pointer.cancelled ? hitAt(pointer) : undefined;
            if (hit && hit.c.id === pressed) activate(hit, "pointer");
            pressed = null;
          }
          wasDown = pointer.down;
          tabs = [];
          const focused = find(f.id);
          if (!focused) f.id = null;

          // The game may have cleared the container the ring was in.
          if (ring?.destroyed) space.addChild((ring = newRing()));
          if (ring) {
            const shown = f.visible && input.focused ? focused : undefined;
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
            const hover = pointer.inside ? hitAt(pointer) : undefined;
            const want = hover && !hover.c.disabled ? "pointer" : cursor;
            if (canvas.style.cursor !== want) canvas.style.cursor = want;
            const out = describeUi(
              order.map((l) => l.c),
              focused?.c,
              (top && scopes.get(top)?.label) ?? (typeof summary === "function" ? summary(ctx) : summary),
              hint,
            );
            set(canvas, attrs[0]!, out.label ?? saved[0]!);
            set(canvas, attrs[1]!, out.description ?? saved[1]!);
          }
        }, { name: "fenrir.ui.preUpdate" });
    },
  };
}

function set(canvas: HTMLCanvasElement, name: string, value: string | null): void {
  if (canvas.getAttribute(name) === value) return;
  if (value === null) canvas.removeAttribute(name);
  else canvas.setAttribute(name, value);
}

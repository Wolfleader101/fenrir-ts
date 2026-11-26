import type { ActionType, InputBinding } from "./Action";
import { Viewport, screenToLogical, type ViewportPoint } from "../Renderer2D/Viewport";
import { peekResource, type Resources } from "../Resource";
import type { SystemCtx } from "../SystemCtx";
import { listenOnCanvas } from "./InputListeners";

/** The primary pointer as of the start of this frame. */
export interface InputPointer {
  /** Logical x of the last pointer position: design units with `pixi2d({ design })`, else CSS pixels from the canvas's left edge. */
  readonly x: number;
  /** Logical y of the last pointer position. */
  readonly y: number;
  /** The primary pointer is down: left mouse button, a finger or a pen tip. `consumePointer` does not change it. */
  readonly down: boolean;
  /** The pointer is over the canvas. False after a finger lifts or the mouse leaves. */
  readonly inside: boolean;
  /**
   * The primary pointer went up this frame without being lifted: the browser cancelled it
   * (`pointercancel` or lost pointer capture), the canvas lost focus, or the page was hidden.
   * `released` still reports the release; check this to ignore a cancelled press.
   */
  readonly cancelled: boolean;
}

/** One press or release of an action, from `input.edges(actions)`. */
export interface InputEdge {
  readonly action: ActionType;
  readonly kind: "pressed" | "released";
  /** The key or pointer button whose press or release made the edge. One key bound to several actions gives each an edge with the same binding, one after another. */
  readonly binding: InputBinding;
}

/** The DOM event an input handler runs inside: a `keydown`, or a `pointerdown` or `pointerup`. */
export type InputDomEvent = KeyboardEvent | PointerEvent;

/**
 * Runs inside the DOM event that pressed one of an action's bindings, with the current run's
 * ctx. Return `true` to claim the event: the engine calls `preventDefault()` on it. `event` is
 * `undefined` when a test game's input stands in for the player without one.
 */
export type InputDownHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => boolean | void;

/** Runs inside a user gesture on the canvas, with the current run's ctx. `event` is `undefined` in a test game. */
export type InputGestureHandler = (event: InputDomEvent | undefined, ctx: SystemCtx) => void;

/**
 * Actions and the pointer, latched when each frame starts: every system in a frame, in every
 * stage, reads the same answers. `game.input` and `ctx.input` are the same object.
 */
export interface Input {
  /**
   * The action went down this frame: none of its bindings was held last frame and one is now.
   * True for exactly one frame, even for a tap that went down and up between two frames. In the
   * `Tick` stage it is true in exactly one tick: the first that runs after the press.
   */
  pressed(action: ActionType): boolean;
  /** The action went up this frame: it was held last frame and no binding is down now. In `Tick`, true in exactly one tick. */
  released(action: ActionType): boolean;
  /** Any of the action's bindings is down. A tap is held for the one frame it is pressed in. */
  held(action: ActionType): boolean;
  readonly pointer: InputPointer;
  /** The canvas had keyboard focus when this frame started. Keys reach the game only while it has. */
  readonly focused: boolean;
  /**
   * This frame's presses and releases of `actions`, in the order they happened, every one kept:
   * two presses of one key between two frames are two `pressed` edges. An action is pressed
   * when its first binding goes down and released when its last goes up, as for `pressed` and
   * `released`. The list is what arrived since the last frame, so a quick tap is `pressed`
   * then `released` here in the frame where `pressed()` is true. Bindings hidden by `consume`
   * or `consumePointer` are left out until they lift; a press after the lift is listed again. In
   * `Tick` it is the frame's list in every tick: read it in `PreUpdate` or `Update`.
   */
  edges(actions: readonly ActionType[]): readonly InputEdge[];
  /**
   * Stops this frame's pointer press reaching actions: for UI that handled the tap. Systems that
   * run after this call see no `pressed`, `held` or `released` from the pointer bindings until
   * the pointer is lifted; keys bound to the same action still count. Systems that ran earlier
   * in the frame already saw the press, so the UI system must run first. `pointer.down` still
   * reports the pointer. Does nothing in a frame with no new pointer press. Only this press is
   * hidden: a press after the pointer lifts is seen again, even one in the next frame or one that
   * lifted and went down again between two frames.
   */
  consumePointer(): void;
  /**
   * Stops this frame's press of `action` reaching later systems, whichever binding pressed it:
   * for UI that handled the press. It hides the bindings that went down this frame as
   * `consumePointer` hides the pointer: until they lift, systems that run after the call see no
   * `pressed`, `held`, `released` or edges from them, for this action or any other bound to the
   * same key or button. Does nothing when no binding of the action went down this frame. As for
   * `consumePointer`, a later press of the same key is seen again.
   */
  consume(action: ActionType): void;
  /**
   * Calls `handler` synchronously inside each DOM event that presses one of `action`'s
   * bindings, before the press is latched: every `keydown` of a bound key, auto-repeats
   * included, and the `pointerdown` that presses a bound pointer button. Return `true` to claim
   * the event and the engine calls `preventDefault()` on it, for example to keep Tab on the
   * canvas while a canvas control can still take focus. The press is latched either way.
   *
   * Setup, like `game.on`: register once, not in a system. A handler stays across `stop()` and
   * `run()` and is called only while the game runs. Returns a function that removes it. A
   * handler that throws is logged and does not claim.
   */
  onDown(action: ActionType, handler: InputDownHandler): () => void;
  /**
   * Calls `handler` synchronously inside every user gesture on the canvas: each `keydown` that
   * is not an auto-repeat, `pointerdown` and `pointerup`. Some browser calls work only inside a
   * gesture, such as `audioContext.resume()` on iOS Safari, where a touch counts on `pointerup`.
   * Setup, like `onDown`: stays across runs, called only while the game runs. Returns a function
   * that removes it. A handler that throws is logged.
   */
  onGesture(handler: InputGestureHandler): () => void;
}

/**
 * `game.input` in a test game: `Input`, plus calls that stand in for the player. Each takes
 * effect when the next frame starts, as a DOM event would. Handlers (`onDown`, `onGesture`) run
 * at the call, as they would inside the DOM event, while the game runs.
 */
export interface TestInput extends Input {
  /**
   * Presses the action's first binding, as if that key or pointer button went down. Calls the
   * `onDown` handlers of every action bound to it, then the `onGesture` handlers, passing
   * `event`. Returns whether a handler claimed the press. A pointer binding also focuses the
   * canvas, as a press on it does.
   */
  press(action: ActionType, event?: InputDomEvent): boolean;
  /** Releases every binding of the action. */
  release(action: ActionType): void;
  /**
   * Moves the primary pointer to logical `x`, `y` over the canvas and presses it. Calls the
   * handlers and focuses the canvas as `press` does, and returns whether a handler claimed it.
   */
  pointerDown(x: number, y: number): boolean;
  /** Moves the primary pointer to logical `x`, `y` over the canvas. */
  pointerMove(x: number, y: number): void;
  /** Lifts the primary pointer where it is. A gesture: calls the `onGesture` handlers. */
  pointerUp(): void;
  /** The browser cancels the primary pointer: it goes up, with `pointer.cancelled` in the frame that releases it. */
  pointerCancel(): void;
  /** The canvas gains keyboard focus. */
  focus(): void;
  /** The canvas loses keyboard focus, which releases everything held, as in the browser. */
  blur(): void;
}

const POINTER_BINDINGS = ["pointer.primary", "pointer.secondary"] as const;
const NO_POINTER: InputPointer = Object.freeze({ x: 0, y: 0, down: false, inside: false, cancelled: false });
const NO_EDGES: readonly InputEdge[] = Object.freeze([]);

/** A binding going down or up between two frames. */
type LoggedEdge = { readonly binding: string; readonly down: boolean };
type DownEntry = { readonly action: ActionType; readonly handler: InputDownHandler };
type GestureEntry = { readonly handler: InputGestureHandler };

/** Internal. The one `Input` of a game: DOM listeners and test calls write it, the engine latches it. */
export class InputImpl implements TestInput {
  /** The canvas `createGame` listens on. A test game has none. */
  public canvas?: HTMLCanvasElement;

  // Written between frames by listeners and test calls.
  private readonly down = new Set<string>();
  private readonly wentDown = new Set<string>();
  private point: ViewportPoint | null = null;
  private pointIsLogical = false;
  private over = false;
  private hasFocus = false;
  /** The primary pointer's last release was a cancel, not a lift. */
  private upByCancel = false;
  /** Every binding that went down or up since the last frame started, in order. */
  private log: LoggedEdge[] = [];
  /** Bindings down when the last frame started. */
  private logStart = new Set<string>();

  // Kept across runs.
  private readonly downHandlers: DownEntry[] = [];
  private readonly gestureHandlers: GestureEntry[] = [];
  /** The ctx of the run in progress, passed to handlers. */
  private ctx: SystemCtx | undefined;

  // Latched when a frame starts.
  private held_ = new Set<string>();
  private next = new Set<string>();
  /** Bindings held, and not consumed, at the end of the last frame. */
  private readonly last = new Set<string>();
  /** Bindings that became held this frame. */
  private readonly fresh = new Set<string>();
  private readonly consumed = new Set<string>();
  private latchedPointer = NO_POINTER;
  private latchedFocus = false;
  private frameLog: LoggedEdge[] = [];
  private frameStart = new Set<string>();
  /** Bindings consumed when this frame started: their edges stay hidden until they lift. */
  private readonly hiddenAtStart = new Set<string>();

  // Edges for the Tick stage: kept until a tick runs.
  private inTick = false;
  private readonly lastTick = new Set<string>();
  private readonly tickDown = new Set<string>();
  private readonly tickUp = new Set<string>();

  private readonly resources: Resources;

  constructor(resources: Resources) {
    this.resources = resources;
  }

  public get pointer(): InputPointer {
    return this.latchedPointer;
  }

  public get focused(): boolean {
    return this.latchedFocus;
  }

  public held(action: ActionType): boolean {
    for (const binding of action.bindings) if (this.counts(binding)) return true;
    return false;
  }

  public pressed(action: ActionType): boolean {
    const before = this.inTick ? this.lastTick : this.last;
    let edge = false;
    for (const binding of action.bindings) {
      if (before.has(binding)) return false;
      edge ||= this.inTick ? this.tickDown.has(binding) : this.fresh.has(binding) && this.counts(binding);
    }
    return edge;
  }

  public released(action: ActionType): boolean {
    let edge = false;
    for (const binding of action.bindings) {
      if (this.counts(binding)) return false;
      edge ||= this.inTick ? this.tickUp.has(binding) : this.last.has(binding);
    }
    return edge;
  }

  public edges(actions: readonly ActionType[]): readonly InputEdge[] {
    if (this.frameLog.length === 0 || actions.length === 0) return NO_EDGES;
    // Consumed before this frame: hidden until the binding lifts. Consumed this frame: hidden.
    const hiding = new Set(this.hiddenAtStart);
    const hidden = (binding: string): boolean => this.consumed.has(binding) || hiding.has(binding);
    const down = new Set<string>();
    for (const binding of this.frameStart) if (!hidden(binding)) down.add(binding);
    const isHeld = (action: ActionType): boolean => action.bindings.some((binding) => down.has(binding));

    const edges: InputEdge[] = [];
    for (const { binding, down: goesDown } of this.frameLog) {
      if (hidden(binding)) {
        if (!goesDown) hiding.delete(binding);
        continue;
      }
      const affected = actions.filter((action) => action.bindings.includes(binding as InputBinding));
      const before = affected.map(isHeld);
      if (goesDown) down.add(binding);
      else down.delete(binding);
      affected.forEach((action, i) => {
        if (isHeld(action) !== before[i]) edges.push(Object.freeze({ action, kind: goesDown ? "pressed" : "released", binding: binding as InputBinding }));
      });
    }
    return Object.freeze(edges);
  }

  public consumePointer(): void {
    this.consumeBindings(POINTER_BINDINGS);
  }

  public consume(action: ActionType): void {
    this.consumeBindings(action.bindings);
  }

  private consumeBindings(bindings: readonly string[]): void {
    for (const binding of bindings) {
      // A press this frame: fresh, or a second press that pressed() folded into a hold.
      if (this.fresh.has(binding) || this.frameLog.some((edge) => edge.down && edge.binding === binding)) {
        this.consumed.add(binding);
        this.tickDown.delete(binding);
      }
    }
  }

  public onDown(action: ActionType, handler: InputDownHandler): () => void {
    const entry: DownEntry = { action, handler };
    this.downHandlers.push(entry);
    return () => remove(this.downHandlers, entry);
  }

  public onGesture(handler: InputGestureHandler): () => void {
    const entry: GestureEntry = { handler };
    this.gestureHandlers.push(entry);
    return () => remove(this.gestureHandlers, entry);
  }

  /**
   * Internal. Calls the `onDown` handlers of every action bound to `binding`, inside the event
   * that pressed it. Returns whether one claimed it. Does nothing while no run is going.
   */
  public claim(binding: string, event: InputDomEvent | undefined): boolean {
    const ctx = this.ctx;
    if (!ctx || this.downHandlers.length === 0) return false;
    let claimed = false;
    // A copy, so a handler that removes itself or adds another neither skips nor repeats one.
    for (const entry of [...this.downHandlers]) {
      if (!entry.action.bindings.includes(binding as InputBinding) || !this.downHandlers.includes(entry)) continue;
      try {
        if (entry.handler(event, ctx) === true) claimed = true;
      } catch (error) {
        ctx.logger.error(`onDown handler of action "${entry.action.name}" failed`, { error });
      }
    }
    return claimed;
  }

  /** Internal. Calls the `onGesture` handlers inside a user gesture. Does nothing while no run is going. */
  public gesture(event: InputDomEvent | undefined): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const entry of [...this.gestureHandlers]) {
      if (!this.gestureHandlers.includes(entry)) continue;
      try {
        entry.handler(event, ctx);
      } catch (error) {
        ctx.logger.error("onGesture handler failed", { error });
      }
    }
  }

  public press(action: ActionType, event?: InputDomEvent): boolean {
    const binding = action.bindings[0]!;
    if (binding.startsWith("pointer.")) this.hasFocus = true;
    const claimed = this.claim(binding, event);
    this.gesture(event);
    this.setDown(binding, true);
    return claimed;
  }

  public release(action: ActionType): void {
    for (const binding of action.bindings) this.setDown(binding, false);
  }

  public pointerDown(x: number, y: number): boolean {
    this.pointerMove(x, y);
    this.hasFocus = true;
    const claimed = this.claim("pointer.primary", undefined);
    this.gesture(undefined);
    this.setDown("pointer.primary", true);
    return claimed;
  }

  public pointerMove(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError(`The pointer goes to logical coordinates, which must be finite numbers. Got (${x}, ${y}).`);
    }
    this.point = { x, y };
    this.pointIsLogical = true;
    this.over = true;
  }

  public pointerUp(): void {
    this.gesture(undefined);
    this.setDown("pointer.primary", false);
  }

  public pointerCancel(): void {
    this.cancelPointer();
  }

  public focus(): void {
    this.setFocus(true);
  }

  public blur(): void {
    this.setFocus(false);
    this.releaseAll();
  }

  private counts(binding: string): boolean {
    return this.held_.has(binding) && !this.consumed.has(binding);
  }

  /** Internal. A key or pointer button went down or up. Repeats change nothing. */
  public setDown(binding: InputBinding | string, down: boolean): void {
    if (binding === "pointer.primary") this.upByCancel = false;
    if (!down) {
      if (this.down.delete(binding)) this.log.push({ binding, down: false });
    } else if (!this.down.has(binding)) {
      this.down.add(binding);
      this.wentDown.add(binding);
      this.log.push({ binding, down: true });
    }
  }

  /** Internal. Whether `binding` is down now, between frames. */
  public isDown(binding: string): boolean {
    return this.down.has(binding);
  }

  /** Internal. The canvas gained or lost keyboard focus. */
  public setFocus(focused: boolean): void {
    this.hasFocus = focused;
  }

  /** Internal. The pointer moved, in CSS pixels from the canvas's top-left corner. */
  public setPoint(point: ViewportPoint, inside: boolean): void {
    this.point = point;
    this.pointIsLogical = false;
    this.over = inside;
  }

  /** Internal. The pointer left the canvas. */
  public leave(): void {
    this.over = false;
  }

  /** Internal. The browser cancelled the primary pointer: its buttons go up and it leaves. */
  public cancelPointer(): void {
    const wasDown = this.down.has("pointer.primary");
    this.setDown("pointer.primary", false);
    this.setDown("pointer.secondary", false);
    if (wasDown) this.upByCancel = true;
    this.leave();
  }

  /** Internal. Lets go of every key and pointer button: on blur or a hidden page. Released edges follow next frame. */
  public releaseAll(): void {
    const pointerDown = this.down.has("pointer.primary");
    for (const binding of [...this.down]) this.setDown(binding, false);
    if (pointerDown) this.upByCancel = true;
  }

  /** Internal. Called when a run starts: listens on the canvas until the run stops, then clears input. */
  public start(ctx: SystemCtx): void {
    this.ctx = ctx;
    if (this.canvas) listenOnCanvas(this, this.canvas, ctx.signal, ctx.onCleanup);
    else ctx.onCleanup(() => this.reset());
  }

  /** Internal. Called when each frame starts, before PreUpdate. */
  public latch(): void {
    const { held_: held, next, last, fresh, consumed } = this;
    // Consumption hides the press it was given, not later ones: a consumed binding that went down
    // again since the last frame (after lifting, in the gap or right after a tap) is a new press.
    const renewed: string[] = [];
    for (const binding of consumed) if (this.wentDown.has(binding)) renewed.push(binding);
    this.hiddenAtStart.clear();
    // Only a binding still down when the log starts has edges of the consumed press to hide.
    for (const binding of consumed) if (this.logStart.has(binding)) this.hiddenAtStart.add(binding);
    this.frameStart = this.logStart;
    this.frameLog = this.log;
    this.logStart = new Set(this.down);
    this.log = [];
    this.latchedFocus = this.hasFocus;
    const pointerWasHeld = held.has("pointer.primary");

    last.clear();
    for (const binding of held) if (!consumed.has(binding)) last.add(binding);

    next.clear();
    for (const binding of this.down) next.add(binding);
    // A press and release between two frames still holds for one frame, so the tap is seen.
    for (const binding of this.wentDown) if (!held.has(binding)) next.add(binding);
    this.wentDown.clear();

    fresh.clear();
    for (const binding of next) {
      if (!held.has(binding)) fresh.add(binding), this.tickDown.add(binding);
    }
    for (const binding of renewed) {
      consumed.delete(binding);
      next.add(binding);
      fresh.add(binding);
      this.tickDown.add(binding);
    }
    for (const binding of held) {
      if (!next.has(binding) && !consumed.delete(binding)) this.tickUp.add(binding);
    }
    this.held_ = next;
    this.next = held;

    // Reported in the frame that releases the pointer, which may be after the cancel.
    const cancelled = pointerWasHeld && !next.has("pointer.primary") && this.upByCancel;
    if (cancelled) this.upByCancel = false;
    this.latchPointer(cancelled);
  }

  private latchPointer(cancelled: boolean): void {
    let { x, y } = this.latchedPointer;
    if (this.point) {
      const viewport = this.pointIsLogical ? undefined : peekResource(this.resources, Viewport);
      // Without a viewport the screen is the logical frame: CSS pixels from the canvas corner.
      const logical = viewport ? screenToLogical(viewport, this.point) : this.point;
      if (logical) ({ x, y } = logical);
    }
    const down = this.held_.has("pointer.primary");
    const inside = this.over;
    const old = this.latchedPointer;
    if (old.x !== x || old.y !== y || old.down !== down || old.inside !== inside || old.cancelled !== cancelled) {
      this.latchedPointer = Object.freeze({ x, y, down, inside, cancelled });
    }
  }

  /** Internal. Called around each Tick stage. */
  public tick(running: boolean): void {
    this.inTick = running;
    if (running) return;
    this.lastTick.clear();
    for (const binding of this.held_) if (this.counts(binding)) this.lastTick.add(binding);
    this.tickDown.clear();
    this.tickUp.clear();
  }

  /** Internal. Forgets everything the run saw: the run stopped. Handlers stay. */
  public reset(): void {
    for (const set of [this.down, this.wentDown, this.held_, this.next, this.last, this.fresh, this.consumed, this.lastTick, this.tickDown, this.tickUp, this.hiddenAtStart]) {
      set.clear();
    }
    this.log = [];
    this.logStart = new Set();
    this.frameLog = [];
    this.frameStart = new Set();
    this.hasFocus = false;
    this.latchedFocus = false;
    this.upByCancel = false;
    this.ctx = undefined;
    this.inTick = false;
    this.point = null;
    this.over = false;
    this.latchedPointer = NO_POINTER;
  }
}

function remove<T>(list: T[], item: T): void {
  const index = list.indexOf(item);
  if (index >= 0) list.splice(index, 1);
}

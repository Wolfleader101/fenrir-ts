import type { ActionType, InputBinding } from "./Action";
import { Viewport, screenToLogical, type ViewportPoint } from "../Renderer2D/Viewport";
import { peekResource, type Resources } from "../Resource";
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
}

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
  /**
   * Stops this frame's pointer press reaching actions: for UI that handled the tap. Systems that
   * run after this call see no `pressed`, `held` or `released` from the pointer bindings until
   * the pointer is lifted; keys bound to the same action still count. Systems that ran earlier
   * in the frame already saw the press, so the UI system must run first. `pointer.down` still
   * reports the pointer. Does nothing in a frame with no new pointer press.
   */
  consumePointer(): void;
}

/**
 * `game.input` in a test game: `Input`, plus calls that stand in for the player. Each takes
 * effect when the next frame starts, as a DOM event would.
 */
export interface TestInput extends Input {
  /** Presses the action's first binding, as if that key or pointer button went down. */
  press(action: ActionType): void;
  /** Releases every binding of the action. */
  release(action: ActionType): void;
  /** Moves the primary pointer to logical `x`, `y` over the canvas and presses it. */
  pointerDown(x: number, y: number): void;
  /** Moves the primary pointer to logical `x`, `y` over the canvas. */
  pointerMove(x: number, y: number): void;
  /** Lifts the primary pointer where it is. */
  pointerUp(): void;
}

const POINTER_BINDINGS = ["pointer.primary", "pointer.secondary"] as const;
const NO_POINTER: InputPointer = Object.freeze({ x: 0, y: 0, down: false, inside: false });

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

  // Latched when a frame starts.
  private held_ = new Set<string>();
  private next = new Set<string>();
  /** Bindings held, and not consumed, at the end of the last frame. */
  private readonly last = new Set<string>();
  /** Bindings that became held this frame. */
  private readonly fresh = new Set<string>();
  private readonly consumed = new Set<string>();
  private latchedPointer = NO_POINTER;

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

  public consumePointer(): void {
    for (const binding of POINTER_BINDINGS) {
      if (this.fresh.has(binding)) {
        this.consumed.add(binding);
        this.tickDown.delete(binding);
      }
    }
  }

  public press(action: ActionType): void {
    this.setDown(action.bindings[0]!, true);
  }

  public release(action: ActionType): void {
    for (const binding of action.bindings) this.setDown(binding, false);
  }

  public pointerDown(x: number, y: number): void {
    this.pointerMove(x, y);
    this.setDown("pointer.primary", true);
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
    this.setDown("pointer.primary", false);
  }

  private counts(binding: string): boolean {
    return this.held_.has(binding) && !this.consumed.has(binding);
  }

  /** Internal. A key or pointer button went down or up. Repeats change nothing. */
  public setDown(binding: InputBinding | string, down: boolean): void {
    if (!down) {
      this.down.delete(binding);
    } else if (!this.down.has(binding)) {
      this.down.add(binding);
      this.wentDown.add(binding);
    }
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

  /** Internal. Lets go of every key and pointer button: on blur, cancel or a hidden page. Released edges follow next frame. */
  public releaseAll(): void {
    this.down.clear();
  }

  /** Internal. Called when a run starts: listens on the canvas until the run stops, then clears input. */
  public start(signal: AbortSignal, onCleanup: (cleanup: () => void) => void): void {
    if (this.canvas) listenOnCanvas(this, this.canvas, signal, onCleanup);
    else onCleanup(() => this.reset());
  }

  /** Internal. Called when each frame starts, before PreUpdate. */
  public latch(): void {
    const { held_: held, next, last, fresh, consumed } = this;
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
    for (const binding of held) {
      if (!next.has(binding) && !consumed.delete(binding)) this.tickUp.add(binding);
    }
    this.held_ = next;
    this.next = held;

    this.latchPointer();
  }

  private latchPointer(): void {
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
    if (old.x !== x || old.y !== y || old.down !== down || old.inside !== inside) {
      this.latchedPointer = Object.freeze({ x, y, down, inside });
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

  /** Internal. Forgets everything: the run stopped. */
  public reset(): void {
    for (const set of [this.down, this.wentDown, this.held_, this.next, this.last, this.fresh, this.consumed, this.lastTick, this.tickDown, this.tickUp]) {
      set.clear();
    }
    this.inTick = false;
    this.point = null;
    this.over = false;
    this.latchedPointer = NO_POINTER;
  }
}

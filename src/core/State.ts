import type { ScheduleStage } from "./Schedule";
import type { SyncSystemFn, SystemCtx } from "./SystemCtx";
import type { Time } from "./Time";

/**
 * A state machine's definition: its name, its values and the value each run starts at.
 * Made by `defineState`. `V` is the union of the value strings.
 */
export interface StateType<V extends string> {
  readonly name: string;
  readonly values: readonly V[];
  readonly initial: V;
}

/** The current value of each state, for one game. `game.states` and `ctx.states` are the same object. */
export interface States {
  /** The current value. A change queued with `set` is not visible until it is applied. */
  get<V extends string>(state: StateType<V>): V;
  /**
   * Queues a change, applied after the current system returns: exit hooks for the old value,
   * then enter hooks for the new value, then the next system. Setting the current value does nothing.
   */
  set<V extends string>(state: StateType<V>, value: NoInfer<V>): void;
  /** Seconds of game time since the current value was entered. Pauses do not count. */
  timeIn(state: StateType<string>): number;
}

/** Transitions of one state allowed in one frame before `set` is treated as a loop. */
const MAX_TRANSITIONS_PER_FRAME = 16;

const quote = (values: readonly string[]): string => values.map((v) => JSON.stringify(v)).join(", ");

/**
 * Defines a state machine. As with components and events, the name is the identity: every game
 * keeps one current value per name. Prefix names with a namespace for your game or library.
 * Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Phase = defineState("myGame.Phase", { values: ["idle", "casting"], initial: "idle" });
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineState<V extends string>(
  name: string,
  options: { readonly values: readonly V[]; readonly initial: NoInfer<V> },
): StateType<V> {
  const values = [...options.values];
  if (values.length === 0) throw new Error(`defineState("${name}") needs at least one value in { values }.`);
  const repeated = values.find((value, i) => values.indexOf(value) !== i);
  if (repeated !== undefined) throw new Error(`defineState("${name}") lists the value "${repeated}" twice. Remove one.`);
  if (!values.includes(options.initial)) {
    throw new Error(`defineState("${name}") has initial "${options.initial}", which is not one of its values: ${quote(values)}.`);
  }
  return Object.freeze({ name, values: Object.freeze(values), initial: options.initial });
}

/**
 * A `runIf` condition: true while `state` has one of `values`.
 *
 * @example
 * game.addSystem(Schedule.Update, meter, { runIf: inState(Phase, "casting") });
 */
/* @__NO_SIDE_EFFECTS__ */
export function inState<V extends string>(
  state: StateType<V>,
  ...values: [NoInfer<V>, ...NoInfer<V>[]]
): (ctx: SystemCtx) => boolean {
  if (values.length === 0) throw new Error(`inState(${state.name}) needs at least one value to match.`);
  for (const value of values) checkValue(state, value, "inState");
  return (ctx) => values.includes(ctx.states.get(state));
}

function checkValue(state: StateType<string>, value: string, caller: string): void {
  if (!state.values.includes(value)) {
    throw new Error(`${caller}: state "${state.name}" has no value ${JSON.stringify(value)}. Use one of ${quote(state.values)}.`);
  }
}

type Machine = {
  readonly def: StateType<string>;
  current: string;
  /** `time.elapsed` when `current` was entered. */
  enteredAt: number;
  /** Transitions applied this frame, as "from -> to", for the loop guard's message. */
  readonly recent: string[];
  /** Hooks by `enter <value>` and `exit <value>`. */
  readonly hooks: Map<string, SyncSystemFn[]>;
};

/**
 * The `States` of one game. Internal: the engine drives it through `beforeStage` and
 * `afterSystem` below, and `Game` registers hooks with `hook`.
 */
export class GameStates implements States {
  private readonly machines = new Map<string, Machine>();
  /** Queued changes. One per state: a later `set` replaces an earlier one, keeping its place. */
  private readonly pending = new Map<Machine, string>();
  private time: Time | undefined;
  /** True from the start of a run until its first frame. */
  private starting = false;
  /** `time.elapsed` when the current run started. */
  private runStart = 0;

  public get<V extends string>(state: StateType<V>): V {
    return this.machine(state).current as V;
  }

  public set<V extends string>(state: StateType<V>, value: NoInfer<V>): void {
    checkValue(state, value, "states.set");
    this.pending.set(this.machine(state), value);
  }

  public timeIn(state: StateType<string>): number {
    const machine = this.machine(state);
    return this.time ? Math.max(0, this.time.elapsed - machine.enteredAt) : 0;
  }

  /** `game.onEnter` and `game.onExit`. */
  public hook(kind: "enter" | "exit", state: StateType<string>, value: string, system: SyncSystemFn): void {
    const method = kind === "enter" ? "onEnter" : "onExit";
    checkValue(state, value, method);
    if (typeof system !== "function") throw new TypeError(`${method}("${state.name}", "${value}", ...) needs a function, got ${typeof system}.`);
    const hooks = this.machine(state).hooks;
    const key = `${kind} ${value}`;
    hooks.set(key, [...(hooks.get(key) ?? []), system]);
  }

  /** Called by the scheduler before a stage's first system. */
  public beforeStage(stage: ScheduleStage, ctx: SystemCtx): void {
    if (stage === "preInit") {
      // A run starts: every state is at its initial value, then the initial values' enter hooks run.
      this.time = ctx.time;
      this.starting = true;
      this.runStart = ctx.time.elapsed;
      for (const machine of this.machines.values()) {
        machine.current = machine.def.initial;
        machine.enteredAt = this.runStart;
        machine.recent.length = 0;
      }
      for (const machine of [...this.machines.values()]) run(machine, `enter ${machine.current}`, ctx);
    } else if (stage === "preUpdate") {
      for (const machine of this.machines.values()) {
        machine.recent.length = 0;
        // The engine restarts game time at the first frame: startup takes no game time.
        if (this.starting) machine.enteredAt = 0;
      }
      this.starting = false;
      this.runStart = 0;
    } else if (stage === "exit") {
      // Stopping is not a transition. Changes nobody applied are dropped.
      this.pending.clear();
      return;
    }
    this.afterSystem(ctx);
  }

  /** Called by the scheduler after each system returns, before the next system's `runIf`. */
  public afterSystem(ctx: SystemCtx): void {
    try {
      // A set made in a hook joins the queue, so it is applied once the transition that ran the hook finishes.
      for (const [machine, value] of this.pending) {
        this.pending.delete(machine);
        if (value !== machine.current) this.transition(machine, value, ctx);
      }
    } catch (error) {
      this.pending.clear();
      throw error;
    }
  }

  private transition(machine: Machine, to: string, ctx: SystemCtx): void {
    const { recent, def } = machine;
    recent.push(`${JSON.stringify(machine.current)} -> ${JSON.stringify(to)}`);
    if (recent.length > MAX_TRANSITIONS_PER_FRAME) {
      throw new Error(
        `State "${def.name}" changed more than ${MAX_TRANSITIONS_PER_FRAME} times in one frame, so something sets it in a loop. ` +
          `Last transitions: ${recent.slice(-4).join(", ")}. ` +
          `Check the onEnter and onExit hooks and the systems that set "${def.name}".`,
      );
    }
    run(machine, `exit ${machine.current}`, ctx);
    machine.current = to;
    machine.enteredAt = this.time?.elapsed ?? 0;
    run(machine, `enter ${to}`, ctx);
  }

  private machine(state: StateType<string>): Machine {
    let machine = this.machines.get(state.name);
    if (!machine) {
      // A state first seen during a run has been at its initial value since the run began.
      machine = { def: state, current: state.initial, enteredAt: this.runStart, recent: [], hooks: new Map() };
      this.machines.set(state.name, machine);
    } else if (machine.def !== state && JSON.stringify(machine.def) !== JSON.stringify(state)) {
      throw new Error(`Two states are named "${state.name}" with different values or initial value. Give one of them another name.`);
    }
    return machine;
  }
}

/** Runs a machine's hooks for `key`. Hooks registered meanwhile wait for the next transition. */
function run(machine: Machine, key: string, ctx: SystemCtx): void {
  for (const hook of machine.hooks.get(key) ?? []) hook(ctx);
}

/** The engine's view of `ctx.states`. Undefined for a hand-made context without states. */
function machineOf(ctx: SystemCtx): GameStates | undefined {
  return ctx.states instanceof GameStates ? ctx.states : undefined;
}

/** Engine hook: before a stage's first system. Applies changes made outside a system. */
export function beforeStage(stage: ScheduleStage, ctx: SystemCtx): void {
  machineOf(ctx)?.beforeStage(stage, ctx);
}

/** Engine hook: after each system returns. Applies the changes it queued. */
export function afterSystem(ctx: SystemCtx): void {
  machineOf(ctx)?.afterSystem(ctx);
}

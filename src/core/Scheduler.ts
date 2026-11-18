import { Schedule } from "./Schedule";
import type { AsyncStage, ScheduleStage, SyncStage } from "./Schedule";
import type { AsyncSystemFn, SyncSystemFn, SystemCtx } from "./SystemCtx";
import { afterSystem, beforeStage } from "./State";

export { Schedule } from "./Schedule";
export type { AsyncStage, ScheduleStage, SyncStage } from "./Schedule";

/** How a system is registered. Every field is optional. */
export interface SystemOptions {
  /** The system's name. Defaults to the function's name. Unique within a stage. */
  name?: string;
  /** Run before these systems in the same stage. */
  before?: string | readonly string[];
  /** Run after these systems in the same stage. */
  after?: string | readonly string[];
  /** Checked each time the system would run. The system is skipped when it returns false. */
  runIf?: (ctx: SystemCtx) => boolean;
}

/** A registered system, in the order its stage runs it. */
export interface ScheduledSystem {
  readonly name: string;
  readonly stage: ScheduleStage;
  readonly system: SyncSystemFn | AsyncSystemFn;
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly runIf?: (ctx: SystemCtx) => boolean;
}

type Entry = {
  name: string;
  stage: ScheduleStage;
  system: SyncSystemFn | AsyncSystemFn;
  before: readonly string[];
  after: readonly string[];
  runIf?: (ctx: SystemCtx) => boolean;
};

const ALL_STAGES: readonly ScheduleStage[] = Object.values(Schedule);

const toList = (value: string | readonly string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : [...value];

const isPromise = (v: unknown): v is PromiseLike<unknown> =>
  v != null && typeof (v as { then?: unknown }).then === "function";

/**
 * Orders one stage: registration order, except where `before` or `after` says otherwise.
 * Throws when a constraint names a system that is not in the stage, or when constraints form a cycle.
 */
function resolveStage(stage: ScheduleStage, entries: readonly Entry[]): Entry[] {
  const byName = new Map(entries.map((e) => [e.name, e]));
  const runsAfter = new Map<Entry, Set<Entry>>(entries.map((e) => [e, new Set()]));

  for (const entry of entries) {
    for (const other of entry.after) {
      const target = byName.get(other);
      if (!target) throw unknownName(stage, entry.name, "after", other);
      runsAfter.get(entry)!.add(target);
    }
    for (const other of entry.before) {
      const target = byName.get(other);
      if (!target) throw unknownName(stage, entry.name, "before", other);
      runsAfter.get(target)!.add(entry);
    }
  }

  // The constrained system is the one that moves. A system with `after` waits until its targets
  // have run; a system with `before` is pulled to just ahead of its earliest target. Everything
  // else keeps registration order.
  const priority = new Map<Entry, number>();
  const visiting = new Set<Entry>();
  const priorityOf = (entry: Entry): number => {
    const known = priority.get(entry);
    if (known !== undefined) return known;
    let value = entries.indexOf(entry);
    if (visiting.has(entry)) return value; // a cycle; reported below
    visiting.add(entry);
    for (const other of entry.before) value = Math.min(value, priorityOf(byName.get(other)!) - 0.5);
    visiting.delete(entry);
    priority.set(entry, value);
    return value;
  };

  // Kahn's algorithm, taking the ready system with the lowest priority, then the earliest registered.
  const ordered: Entry[] = [];
  const remaining = [...entries];
  while (remaining.length > 0) {
    let best = -1;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      if (![...runsAfter.get(candidate)!].every((dep) => !remaining.includes(dep))) continue;
      if (best === -1 || priorityOf(candidate) < priorityOf(remaining[best]!)) best = i;
    }
    if (best === -1) throw cycleError(stage, remaining, runsAfter);
    ordered.push(remaining.splice(best, 1)[0]!);
  }
  return ordered;
}

function unknownName(stage: ScheduleStage, name: string, relation: "before" | "after", other: string): Error {
  return new Error(
    `System "${name}" in stage "${stage}" runs ${relation} "${other}", but no system named "${other}" is registered in "${stage}". ` +
      `Register "${other}" in "${stage}", or fix the name in "${name}"'s ${relation} option.`,
  );
}

function cycleError(stage: ScheduleStage, remaining: readonly Entry[], runsAfter: Map<Entry, Set<Entry>>): Error {
  // Walk dependencies among the stuck systems until one repeats; that loop is the cycle.
  const path: Entry[] = [];
  let current = remaining[0]!;
  while (!path.includes(current)) {
    path.push(current);
    current = [...runsAfter.get(current)!].find((dep) => remaining.includes(dep))!;
  }
  const loop = path.slice(path.indexOf(current)).reverse();
  const names = [...loop, loop[0]!].map((e) => `"${e.name}"`).join(" -> ");
  return new Error(
    `Systems ${loop.map((e) => `"${e.name}"`).join(" and ")} in stage "${stage}" have before/after constraints that form a cycle: ${names}. ` +
      `Remove one of these constraints.`,
  );
}

/**
 * Holds the systems of each stage and runs them.
 *
 * Order is resolved when a run begins (`beginRun`). While a run is active, adding, replacing
 * or removing a system is checked at once, so a bad change throws at the call, and takes effect
 * at the next `flush`, which the engine calls before each frame and between startup stages.
 */
export class Scheduler {
  private readonly entries = new Map<ScheduleStage, Entry[]>(ALL_STAGES.map((s) => [s, []]));
  private readonly resolved = new Map<ScheduleStage, Entry[]>();
  private readonly active = new Map<ScheduleStage, Entry[]>();
  private readonly functions = new WeakMap<readonly Entry[], readonly (SyncSystemFn | AsyncSystemFn)[]>();
  private running = false;

  public addSystem<S extends SyncStage>(stage: S, system: SyncSystemFn, options?: SystemOptions): this;
  public addSystem<S extends AsyncStage>(stage: S, system: AsyncSystemFn, options?: SystemOptions): this;
  public addSystem(stage: ScheduleStage, system: SyncSystemFn | AsyncSystemFn, options: SystemOptions = {}): this {
    if (typeof system !== "function") {
      throw new TypeError(`addSystem(${JSON.stringify(stage)}, ...) needs a function, got ${typeof system}.`);
    }
    const name = options.name ?? system.name;
    if (!name) {
      throw new Error(
        `Cannot add an anonymous system to stage "${stage}". Pass a named function, or pass { name: "myGame.mySystem" } as the third argument.`,
      );
    }
    const list = this.entries.get(stage)!;
    if (list.some((e) => e.name === name)) {
      throw new Error(
        `Stage "${stage}" already has a system named "${name}". Pass a different { name } for one of them.`,
      );
    }
    const entry: Entry = { name, stage, system, before: toList(options.before), after: toList(options.after), runIf: options.runIf };
    this.change(stage, [...list, entry]);
    return this;
  }

  public addSystems<S extends SyncStage>(stage: S, systems: readonly SyncSystemFn[]): this;
  public addSystems<S extends AsyncStage>(stage: S, systems: readonly AsyncSystemFn[]): this;
  public addSystems(stage: ScheduleStage, systems: readonly (SyncSystemFn | AsyncSystemFn)[]): this {
    for (const system of systems) this.addSystem(stage as SyncStage, system as SyncSystemFn);
    return this;
  }

  /**
   * Swaps the function of every system called `name`, keeping its stage, position and options.
   * While running, the new function runs from the next frame.
   */
  public replaceSystem(name: string, system: SyncSystemFn | AsyncSystemFn): this {
    if (typeof system !== "function") throw new TypeError(`replaceSystem("${name}", ...) needs a function, got ${typeof system}.`);
    const stages = this.stagesWith(name, "replaceSystem");
    for (const stage of stages) {
      this.change(stage, this.entries.get(stage)!.map((e) => (e.name === name ? { ...e, system } : e)));
    }
    return this;
  }

  /** Removes every system called `name`. While running, it stops running from the next frame. */
  public removeSystem(name: string): this {
    const stages = this.stagesWith(name, "removeSystem");
    // Check every stage before changing any, so a failed removal changes nothing.
    const next = stages.map((stage) => [stage, this.entries.get(stage)!.filter((e) => e.name !== name)] as const);
    if (this.running) for (const [stage, list] of next) resolveStage(stage, list);
    for (const [stage, list] of next) this.change(stage, list);
    return this;
  }

  /** The system functions of a stage, in the order they run. */
  public getSystems<S extends SyncStage>(stage: S): readonly SyncSystemFn[];
  public getSystems<S extends AsyncStage>(stage: S): readonly AsyncSystemFn[];
  public getSystems(stage: ScheduleStage): readonly (SyncSystemFn | AsyncSystemFn)[];
  public getSystems(stage: ScheduleStage): readonly (SyncSystemFn | AsyncSystemFn)[] {
    const order = this.getSchedule(stage) as readonly Entry[];
    let systems = this.functions.get(order);
    if (!systems) {
      systems = order.map((e) => e.system);
      this.functions.set(order, systems);
    }
    return systems;
  }

  /** The systems of a stage with their names and options, in the order they run. */
  public getSchedule(stage: ScheduleStage): readonly ScheduledSystem[] {
    let order = this.resolved.get(stage);
    if (!order) {
      order = resolveStage(stage, this.entries.get(stage)!);
      this.resolved.set(stage, order);
    }
    return order;
  }

  /** The whole schedule as text, one stage per line: `update: movePlayer, applyDamage`. */
  public describe(): string {
    return ALL_STAGES.map((stage) => `${stage}: ${this.getSchedule(stage).map((e) => e.name).join(", ")}`).join("\n");
  }

  /**
   * Resolves the order of every stage and starts applying changes at `flush` only.
   * Throws, naming the systems involved, if a constraint is unknown or cyclic.
   */
  public beginRun(): void {
    for (const stage of ALL_STAGES) this.getSchedule(stage);
    for (const stage of ALL_STAGES) this.active.set(stage, this.resolved.get(stage)!);
    this.running = true;
  }

  /** Applies changes made since the last flush. Called by the engine between frames. */
  public flush(): void {
    if (!this.running) return;
    for (const stage of ALL_STAGES) this.active.set(stage, this.resolved.get(stage)!);
  }

  /** Ends the run: changes apply immediately again and are checked when the next run begins. */
  public endRun(): void {
    this.running = false;
    this.active.clear();
  }

  /** The systems a stage runs now, as of the last flush while running. */
  public current(stage: ScheduleStage): readonly ScheduledSystem[] {
    return this.running ? this.active.get(stage)! : this.getSchedule(stage);
  }

  /**
   * Runs a stage's systems in order. State changes queued by a system are applied after it
   * returns, before the next system's `runIf`; changes made outside a system, before the first.
   */
  public runSyncStage<S extends SyncStage>(stage: S, ctx: SystemCtx): void {
    beforeStage(stage, ctx);
    for (const entry of this.current(stage)) {
      if (entry.runIf && !entry.runIf(ctx)) continue;
      entry.system(ctx);
      afterSystem(ctx);
    }
  }

  /** As `runSyncStage`, awaiting each system. Stops before the next system once `ctx.signal` aborts. */
  public async runAsyncStage<S extends AsyncStage>(stage: S, ctx: SystemCtx): Promise<void> {
    if (ctx.signal.aborted) return;
    beforeStage(stage, ctx);
    for (const entry of this.current(stage)) {
      if (ctx.signal.aborted) return;
      if (entry.runIf && !entry.runIf(ctx)) continue;
      const res = entry.system(ctx);
      if (isPromise(res)) await res;
      afterSystem(ctx);
    }
  }

  private stagesWith(name: string, method: string): ScheduleStage[] {
    const stages = ALL_STAGES.filter((stage) => this.entries.get(stage)!.some((e) => e.name === name));
    if (stages.length === 0) {
      const known = ALL_STAGES.flatMap((stage) => this.entries.get(stage)!.map((e) => `"${e.name}"`));
      throw new Error(
        `${method}: no system named "${name}" is registered. Registered systems: ${known.join(", ") || "none"}.`,
      );
    }
    return stages;
  }

  /** Replaces a stage's entries. While running, the new order is resolved now so errors throw here. */
  private change(stage: ScheduleStage, next: Entry[]): void {
    if (this.running) {
      this.resolved.set(stage, resolveStage(stage, next));
    } else {
      this.resolved.delete(stage);
    }
    this.entries.set(stage, next);
  }
}

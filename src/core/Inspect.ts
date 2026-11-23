import { Name, Relationship } from "./ECS/DefaultComponents";
import type { Entity, EntityList } from "./ECS/EntityList";
import type { Engine } from "./Engine";
import type { GameBase, GameImpl } from "./Game";
import { toJson, type JsonValue } from "./Json";
import type { Resources } from "./Resource";
import { Schedule, type ScheduleStage } from "./Schedule";
import type { GameStates } from "./State";

/** One entity of the active scene, as `inspect(game)` reports it. */
export interface EntitySnapshot {
  /** The entity handle: the value `entities.get` and `entities.set` take. */
  readonly id: number;
  /** From the engine's `fenrir.Name` component. */
  readonly name: string;
  /** The parent's handle, from the engine's `fenrir.Relationship` component; null for a root. */
  readonly parent: number | null;
  /** Every other component, `fenrir.Transform` included, by the name given to `defineComponent`. */
  readonly components: Readonly<Record<string, JsonValue>>;
}

/** What a game is doing, as plain JSON. Returned by `inspect(game)`. */
export interface GameSnapshot {
  /** Frames run since the current run started. 0 during startup; kept after `stop()` until the next `run()`. */
  readonly frame: number;
  /** `time.elapsed` and `time.delta` as of the start of the latest frame. */
  readonly time: { readonly elapsed: number; readonly delta: number };
  /** System names per stage, in run order. */
  readonly schedule: Readonly<Record<ScheduleStage, readonly string[]>>;
  /** Each state's current value and seconds in it, by the name given to `defineState`. */
  readonly states: Readonly<Record<string, { readonly value: string; readonly timeIn: number }>>;
  /** Each resource that has a value, by the name given to `defineResource`. */
  readonly resources: Readonly<Record<string, JsonValue>>;
  /** The active scene's entities, by id. */
  readonly entities: readonly EntitySnapshot[];
}

const FOLDED: readonly symbol[] = [Name, Relationship];
const PREFIX = "component:";

/** A component's name from its key. A symbol not made by `defineComponent` shows as `Symbol(description)`. */
function componentName(type: symbol): string {
  const id = Symbol.keyFor(type);
  return id?.startsWith(PREFIX) ? id.slice(PREFIX.length) : String(type);
}

const byKey = <T>(entries: Iterable<[string, T]>): [string, T][] => [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

function entitySnapshots(list: EntityList): EntitySnapshot[] {
  const nullEntity = list.nullEntity();
  const pools = byKey([...list["pools"]].map(([type, pool]) => [componentName(type), { type, pool }] as [string, { type: symbol; pool: typeof pool }]));
  const generations = list["generations"];
  const snapshots: EntitySnapshot[] = [];
  for (let id = 0; id < generations.length; id++) {
    if (list["nextFree"][id] !== id) continue;
    const entity: Entity = list["pack"](id, generations[id]!);
    const components: Record<string, JsonValue> = {};
    for (const [name, { type, pool }] of pools) {
      if (FOLDED.includes(type) || !pool.has(id)) continue;
      components[name] = toJson(pool.get(id));
    }
    const parent = list.tryGet(entity, Relationship)?.parent ?? nullEntity;
    snapshots.push({
      id: entity,
      name: String(list.tryGet(entity, Name)?.name ?? `Entity ${id}`),
      parent: parent === nullEntity ? null : parent,
      components,
    });
  }
  return snapshots;
}

/** Builds `inspect(game)`'s snapshot. Reads the engine's internals; changes nothing. */
export function inspectGame(engine: Engine, states: GameStates, resources: Resources): GameSnapshot {
  const { count, elapsed } = engine["frames"];
  const scheduler = engine.getScheduler();
  const schedule = {} as Record<ScheduleStage, readonly string[]>;
  for (const stage of Object.values(Schedule)) {
    let names: string[];
    try {
      names = scheduler.current(stage).map((s) => s.name);
    } catch {
      // An unresolvable order (unknown name or cycle): show registration order; run() reports the error.
      names = scheduler["entries"].get(stage)!.map((s) => s.name);
    }
    schedule[stage] = names;
  }

  const stateValues: Record<string, { value: string; timeIn: number }> = {};
  for (const [name, machine] of byKey(states["machines"])) {
    stateValues[name] = { value: machine.current, timeIn: Math.max(0, elapsed - machine.enteredAt) };
  }

  const resourceValues: Record<string, JsonValue> = {};
  for (const [name, value] of byKey(resources["values"])) resourceValues[name] = toJson(value);

  return {
    frame: count,
    time: { elapsed, delta: engine.getTime().delta },
    schedule,
    states: stateValues,
    resources: resourceValues,
    entities: entitySnapshots(engine["sceneManager"].getActiveScene().entityList),
  };
}

/** What `exposeInspector(game)` puts on `window.__FENRIR__`. */
export interface DebugGlobal {
  inspect(): GameSnapshot;
}

/**
 * What `game` is doing, as plain JSON: frame, time, schedule, states, resources and the active
 * scene's entities. Works on a `Game` and a `TestGame`, before the game runs, while paused and
 * after `stop()`; never throws. A function rather than a method, so a game that never calls it
 * ships none of the snapshot and JSON-encoding code. The serialisation rules are in README.md
 * under "Inspecting a game".
 *
 * ```ts
 * const { entities, resources } = inspect(game);
 * ```
 */
export function inspect(game: GameBase): GameSnapshot {
  const impl = game as GameImpl;
  return inspectGame(impl["engine"], impl.states as GameStates, impl.resources);
}

/**
 * Puts `inspect(game)` on `window.__FENRIR__.inspect` for browser tests and agents. The last
 * game exposed owns it, with a warning when it replaces another; it stays after the game stops.
 * Does nothing where there is no `window`. Call it only in builds that need it, such as a debug
 * or browser-tested build: a game that never calls it ships no inspection code.
 */
export function exposeInspector(game: GameBase): void {
  if (typeof window === "undefined") return;
  const target = window as { __FENRIR__?: DebugGlobal };
  if (target.__FENRIR__) game.logger.warn("window.__FENRIR__ now inspects the newest game passed to exposeInspector.");
  target.__FENRIR__ = { inspect: () => inspect(game) };
}

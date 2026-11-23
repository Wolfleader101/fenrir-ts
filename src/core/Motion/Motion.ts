import { defineComponent, type ComponentType } from "../ECS/Component";
import type { Entity, EntityList } from "../ECS/EntityList";
import { defineEvent } from "../EventQueue";
import type { Plugin } from "../Game";
import { defineResource, peekResource, type Resources } from "../Resource";
import { Schedule } from "../Schedule";
import type { StateType } from "../State";
import type { SystemCtx } from "../SystemCtx";
import { findEasing, type EasingName } from "./Easing";

/**
 * One timer, as plain data in an entity's `Timers`. Times are seconds of game time. The motion
 * system advances it each frame and sends `TimerFired` each time `elapsed` reaches `duration`.
 * Edit `paused` directly to pause and resume it.
 */
export interface Timer {
  /** Seconds from the start of the current period to the next firing. */
  duration: number;
  /** Seconds into the current period. */
  elapsed: number;
  /** `duration - elapsed`, kept up to date by the motion system. */
  remaining: number;
  /** Firings after the first: 0 fires once, `Infinity` repeats until cancelled. */
  repeat: number;
  /** Times it has fired. */
  fired: number;
  paused: boolean;
  /** Paused with every other timer and tween of its group by `MotionSettings.paused[group]`. */
  group: string | null;
  /** While set, the timer exists only while that state has that value; it is removed, unfired, once it has not. */
  state: { name: string; value: string } | null;
}

/** The timers of one entity, by name. */
export type Timers = Record<string, Timer>;
export const Timers = defineComponent<Timers>("fenrir.Timers");

/**
 * One tween, as plain data in an entity's `Tweens`: numeric fields of one component on the same
 * entity, from `from` to `to`. The motion system writes the fields each frame and removes the
 * tween when it finishes, sending `TweenDone`. Edit `paused` directly to pause and resume it.
 */
export interface Tween {
  /** The component's name, as given to `defineComponent`, for example `fenrir.Transform2D`. */
  component: string;
  /** Start values. Fields not given are read from the component when the delay ends. */
  from: Record<string, number>;
  /** End values, by field. */
  to: Record<string, number>;
  /** Seconds per play. */
  duration: number;
  /** Seconds before the first play starts. */
  delay: number;
  /** An easing name: a built-in (`EasingName`) or one added with `defineEasing`. */
  ease: string;
  /** Plays after the first: 0 plays once, `Infinity` repeats until cancelled. */
  repeat: number;
  /** Every second play runs from `to` back to `from`. */
  yoyo: boolean;
  /** Seconds since the tween was added, delay included, pauses excluded. */
  elapsed: number;
  /** True once the delay has ended and `from` holds every field. */
  started: boolean;
  paused: boolean;
  /** Paused with every other timer and tween of its group by `MotionSettings.paused[group]`. */
  group: string | null;
}

/** The tweens of one entity, by name. */
export type Tweens = Record<string, Tween>;
export const Tweens = defineComponent<Tweens>("fenrir.Tweens");

/** Sent each time a timer fires, in the frame it fires. `last` is true when the timer is gone. */
export const TimerFired = defineEvent<{ entity: Entity; name: string; count: number; last: boolean }>("fenrir.motion.timerFired");
/** Sent when a tween ends on its end values, in the frame it ends. Not sent when it is cancelled or replaced. */
export const TweenDone = defineEvent<{ entity: Entity; name: string }>("fenrir.motion.tweenDone");

/**
 * Settings for every timer and tween of a game. Set by the `motion()` plugin; edit the fields.
 *
 * They are read when `fenrir.motion.preUpdate` runs, first in `PreUpdate`. A change made by a
 * game system that runs after it (any later `PreUpdate` system, or `Update`) takes effect at the
 * next frame. To have a pause take effect in the frame that decides it, decide it in a system
 * ordered before the motion system: `{ before: "fenrir.motion.preUpdate" }` in `PreUpdate`,
 * where this frame's input is already latched.
 */
export interface MotionSettings {
  /** Groups whose timers and tweens are paused: `paused.ambient = true`. Remove or set false to resume. */
  paused: Record<string, boolean>;
  /**
   * Pauses every timer and tween, grouped or not, as if each were paused: a pause menu. Set it
   * back to false to resume. Defaults to false. Optional so settings written by hand before it
   * existed still type-check.
   */
  pausedAll?: boolean;
  /**
   * When true, every tween jumps to its end values at the next frame and sends `TweenDone`,
   * including tweens added later and repeating ones (which end where their last play would).
   * Timers are not affected: they measure game time, not motion.
   */
  reducedMotion: boolean;
}
export const MotionSettings = defineResource<MotionSettings>("fenrir.MotionSettings");

/** What the helpers need: a `SystemCtx`, or anything with the game's `entities` and `resources`. */
export type MotionCtx = { readonly entities: EntityList; readonly resources: Resources };

/** The keys of `T` whose values are numbers. */
export type NumericKeys<T> = { [K in keyof T]-?: T[K] extends number ? K : never }[keyof T] & string;

export interface TweenOptions<T> {
  /** End values of numeric fields of the component. */
  to: Partial<Record<NumericKeys<T>, number>>;
  /** Start values. Fields left out start from the component's value when the delay ends. */
  from?: Partial<Record<NumericKeys<T>, number>>;
  /** Seconds per play, at least 0. */
  duration: number;
  /** Seconds before the first play. Defaults to 0. */
  delay?: number;
  /** Defaults to `"linear"`. */
  ease?: EasingName | (string & {});
  /** Plays after the first. Defaults to 0; `Infinity` repeats until cancelled. */
  repeat?: number;
  /** Every second play runs back to the start. Defaults to false. */
  yoyo?: boolean;
  /**
   * Adding a tween with a running tween's name replaces it. Defaults to the component's name and
   * the fields, such as `fenrir.Transform2D:x,y`, so tweening the same fields again replaces.
   */
  name?: string;
  group?: string;
}

export interface TimerOptions {
  /** Seconds until it fires, and between firings. */
  duration: number;
  /** Firings after the first. Defaults to 0; `Infinity` repeats until cancelled. Needs a duration above 0. */
  repeat?: number;
  group?: string;
  /** Removes the timer, unfired, once `state` no longer has `value`. Pass the state and its value. */
  state?: [StateType<string>, string];
}

const fail = (caller: string, message: string): never => {
  throw new Error(`${caller}: ${message}.`);
};

const isTime = (value: number): boolean => value >= 0 && value < Infinity;

/** The checks timers and tweens share. */
function check(caller: string, { resources }: MotionCtx, duration: number, repeat: number, delay = 0): void {
  if (!peekResource(resources, MotionSettings)) fail(caller, "needs the motion() plugin, which runs timers and tweens: createGame({ canvas, plugins: [motion()] })");
  if (!isTime(duration) || !isTime(delay)) fail(caller, `duration and delay must be finite seconds, 0 or more, got ${duration} and ${delay}`);
  if (!(repeat === Infinity || (repeat >= 0 && Number.isInteger(repeat)))) fail(caller, `repeat must be a whole number or Infinity, got ${repeat}`);
  if (repeat > 0 && !duration) fail(caller, "a repeat needs a duration above 0");
}

type Records = ComponentType<Record<string, unknown>>;

/** Removes the component once its record is empty. */
function dropIfEmpty(entities: EntityList, entity: Entity, type: Records, record: object): void {
  for (const _ in record) return;
  entities.remove(entity, type);
}

/** Removes `name` from the entity's records of `type`, and the component once it is empty. */
function removeEntry(entities: EntityList, entity: Entity, type: Records, name: string): boolean {
  const record = entities.tryGet(entity, type);
  if (!record || !(name in record)) return false;
  delete record[name];
  dropIfEmpty(entities, entity, type, record);
  return true;
}

function addEntry<T>(entities: EntityList, entity: Entity, type: ComponentType<Record<string, T>>, name: string, entry: T): T {
  const record = entities.tryGet(entity, type);
  if (record) record[name] = entry;
  else entities.set(entity, type, { [name]: entry });
  return entry;
}

/**
 * Starts a timer called `name` on `entity`, replacing a timer of that name. It fires
 * `TimerFired` after `duration` seconds of game time, then `repeat` more times, each a
 * `duration` later, and is then removed. Cancel it with `cancelTimer`, by removing `Timers`, or
 * by destroying the entity. Needs the `motion()` plugin.
 *
 * For how long a state has had its value, read `states.timeIn` instead: a timer is for
 * something that must happen once, or again and again, at a time.
 *
 * @example
 * addTimer(ctx, entity, "myGame.toResults", { duration: 1.5, state: [Phase, "over"] });
 */
export function addTimer(ctx: MotionCtx, entity: Entity, name: string, options: TimerOptions): Timer {
  const caller = `addTimer("${name}")`;
  const { duration, repeat = 0, group = null, state } = options;
  check(caller, ctx, duration, repeat);
  if (state && !state[0].values.includes(state[1])) fail(caller, `state "${state[0].name}" has no value "${state[1]}"`);
  return addEntry<Timer>(ctx.entities, entity, Timers, name, {
    duration,
    elapsed: 0,
    remaining: duration,
    repeat,
    fired: 0,
    paused: false,
    group,
    state: state ? { name: state[0].name, value: state[1] } : null,
  });
}

/** Removes the timer called `name` from `entity`, unfired. Returns whether there was one. */
export function cancelTimer(ctx: MotionCtx, entity: Entity, name: string): boolean {
  return removeEntry(ctx.entities, entity, Timers as Records, name);
}

/**
 * Tweens numeric fields of `component` on `entity` to `to` over `duration` seconds of game time.
 * The entity must have the component. A tween with the same name is replaced, and fields this
 * tween drives are taken from any other tween of that component on the entity, so the newest
 * tween of a field wins. Returns the tween's name. Needs the `motion()` plugin.
 *
 * @example
 * addTween(ctx, fish, Transform2D, { to: { x: 300, rotation: Math.PI }, duration: 0.6, ease: "quadOut" });
 * addTween(ctx, fish, Display2D, { from: { alpha: 0 }, to: { alpha: 1 }, duration: 0.3 });
 */
export function addTween<T>(ctx: MotionCtx, entity: Entity, component: ComponentType<T>, options: TweenOptions<T>): string {
  const type = (Symbol.keyFor(component) ?? "").replace(/^component:/, "");
  const to = { ...options.to } as Record<string, number>;
  const from = { ...options.from } as Record<string, number>;
  const fields = Object.keys(to).sort();
  const name = options.name ?? `${type}:${fields}`;
  const caller = `addTween("${name}")`;
  const { entities } = ctx;
  const { duration, delay = 0, ease = "linear", repeat = 0, yoyo = false, group = null } = options;
  check(caller, ctx, duration, repeat, delay);
  if (!findEasing(ease)) fail(caller, `no easing is called "${ease}". Use a built-in such as "quadOut", or add it with defineEasing`);
  if (!fields.length) fail(caller, "{ to } names no fields");
  const target = entities.tryGet(entity, component) as Record<string, unknown> | undefined;
  if (!target) fail(caller, `the entity has no ${type} component. Add it first`);
  for (const field in from) if (!(field in to)) fail(caller, `{ from } has ${field}, which { to } does not`);
  for (const field of fields) {
    if (typeof target![field] !== "number") fail(caller, `${type}.${field} is not a number`);
    if (!Number.isFinite(to[field]) || (field in from && !Number.isFinite(from[field]))) fail(caller, `${field} must go between finite numbers`);
  }

  // The newest tween of a field wins: take these fields from the entity's other tweens of the component.
  const tweens = entities.tryGet(entity, Tweens);
  for (const other in tweens) {
    const tween = tweens[other]!;
    if (tween.component !== type) continue;
    for (const field of fields) {
      delete tween.to[field];
      delete tween.from[field];
    }
    if (!Object.keys(tween.to).length) delete tweens[other];
  }

  addEntry(entities, entity, Tweens, name, { component: type, from, to, duration, delay, ease, repeat, yoyo, elapsed: 0, started: false, paused: false, group });
  return name;
}

/** Removes the tween called `name` from `entity`, leaving its fields where they are. Returns whether there was one. */
export function cancelTween(ctx: MotionCtx, entity: Entity, name: string): boolean {
  return removeEntry(ctx.entities, entity, Tweens as Records, name);
}

const TIMERS = [Timers] as const;
const TWEENS = [Tweens] as const;

/** Advances one tween by `dt` and writes its fields. Returns true when it has ended on its end values. */
function advance(tween: Tween, target: Record<string, number>, dt: number, reduced: boolean): boolean {
  const { to, from, duration, repeat, yoyo } = tween;
  const local = (tween.elapsed += dt) - tween.delay;
  if (local < 0 && !reduced) return false;
  if (!tween.started) {
    for (const field in to) if (!(field in from)) from[field] = target[field]!;
    tween.started = true;
  }
  const play = duration ? Math.floor(local / duration) : 0;
  const ended = reduced || !duration || play > repeat;
  // Ended: where the last play ends, which is back at the start after an even number of yoyo plays.
  // Running: overshoot past the end of a play carries into the next one, and yoyo runs odd plays backwards.
  const p = ended ? (yoyo && (repeat === Infinity || repeat % 2) ? 0 : 1) : local / duration - play;
  const e = ended ? p : findEasing(tween.ease)!(yoyo && play % 2 ? 1 - p : p);
  // a * (1 - e) + b * e lands exactly on a at 0 and on b at 1.
  for (const field in to) target[field] = from[field]! * (1 - e) + to[field]! * e;
  return ended;
}

const held = (settings: MotionSettings, entry: Timer | Tween): boolean =>
  settings.pausedAll === true || entry.paused || (entry.group !== null && settings.paused[entry.group] === true);

/** The engine system: advances every timer and tween of the active scene by `time.delta`. */
function update({ entities, time, resources, states, events }: SystemCtx): void {
  const settings = resources.get(MotionSettings);
  const dt = time.delta;
  const sends: (() => void)[] = [];
  const machines = (states as unknown as { machines?: Map<string, { current: string }> }).machines;

  entities.each(TIMERS, (entity, timers) => {
    for (const name in timers) {
      const timer = timers[name]!;
      const { state, duration, repeat } = timer;
      // A state nothing has read or set yet is still at its initial value, so the timer stays.
      const current = state && machines?.get(state.name)?.current;
      if (current && current !== state!.value) delete timers[name];
      else if (!held(settings, timer)) {
        timer.elapsed += dt;
        // A long frame can hold several firings: each is sent, and the overshoot carries over.
        while (timer.elapsed >= duration && timer.fired <= repeat) {
          timer.elapsed -= duration;
          const payload = { entity, name, count: ++timer.fired, last: timer.fired > repeat };
          sends.push(() => events.send(TimerFired, payload));
        }
        if (timer.fired > repeat) delete timers[name];
        timer.remaining = duration - timer.elapsed;
      }
    }
    dropIfEmpty(entities, entity, Timers as Records, timers);
  });

  entities.each(TWEENS, (entity, tweens) => {
    for (const name in tweens) {
      const tween = tweens[name]!;
      if (held(settings, tween)) continue;
      const target = entities.tryGet(entity, defineComponent<Record<string, number>>(tween.component));
      // The tweened component was removed: the tween goes with it, unfinished and silently.
      if (!target) delete tweens[name];
      else if (advance(tween, target, dt, settings.reducedMotion)) {
        delete tweens[name];
        sends.push(() => events.send(TweenDone, { entity, name }));
      }
    }
    dropIfEmpty(entities, entity, Tweens as Records, tweens);
  });

  // Sent once every timer and tween has moved, so a listener sees this frame's values.
  for (const send of sends) send();
}

/**
 * Runs timers and tweens: `addTimer` and `addTween` need it. It adds the `MotionSettings`
 * resource and one system, `fenrir.motion.preUpdate`, which advances every timer and tween of
 * the active scene by `time.delta`. Plugins install before the game adds its systems, so it runs
 * before the game's `PreUpdate` systems, and the game's `Update` systems and the renderer see
 * this frame's values. A game without it ships none of this code.
 *
 * A game system that pauses motion (`MotionSettings.pausedAll` or a group) and must stop this
 * frame's advance too runs before it: `{ before: "fenrir.motion.preUpdate" }` in `PreUpdate`.
 *
 * @example
 * const game = await createGame({ canvas, plugins: [motion(), pixi2d()] });
 * game.addSystem(Schedule.PreUpdate, function pauseMenu({ input, resources }) {
 *   if (input.pressed(Pause)) resources.get(MotionSettings).pausedAll = !resources.get(MotionSettings).pausedAll;
 * }, { before: "fenrir.motion.preUpdate" });
 */
export function motion(): Plugin {
  return {
    name: "fenrir.motion",
    install(game) {
      game.resources.set(MotionSettings, { paused: {}, pausedAll: false, reducedMotion: false });
      // Named by option, not nameEngineSystems: SystemName.ts would pull its stage list into every core bundle.
      game.addSystem(Schedule.PreUpdate, update, { name: "fenrir.motion.preUpdate" });
    },
  };
}

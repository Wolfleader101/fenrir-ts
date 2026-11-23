import { describe, expect, it } from "vitest";
import { createTestGame } from "@/core/TestGame";
import type { TestGame } from "@/core/TestGame";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Schedule";
import { defineComponent } from "@/core/ECS/Component";
import { defineState } from "@/core/State";
import { Transform2D } from "@/core/ECS/Transform2D";
import { Display2D } from "@/core/ECS/Display2D";
import type { Entity } from "@/core/ECS/EntityList";
import type { SystemCtx } from "@/core/SystemCtx";
import {
  MotionSettings,
  TimerFired,
  Timers,
  TweenDone,
  Tweens,
  addTimer,
  addTween,
  cancelTimer,
  cancelTween,
  motion,
} from "@/core/Motion/Motion";
import { defineEasing, easings } from "@/core/Motion/Easing";
import { inspect } from "@/core/Inspect";

const logger = new NullLogger();

type Setup = { game: TestGame; ctx: SystemCtx; entity: Entity; fired: unknown[]; done: unknown[] };

/** A started test game with motion() and one entity at Transform2D (0, 0) and Display2D alpha 1. */
async function setup(spawn?: (ctx: SystemCtx, entity: Entity) => void): Promise<Setup> {
  const game = await createTestGame({ seed: 1, logger, plugins: [motion()] });
  const fired: unknown[] = [];
  const done: unknown[] = [];
  game.on(TimerFired, (payload) => void fired.push(payload));
  game.on(TweenDone, (payload) => void done.push(payload));
  const result = { game, fired, done } as Setup;
  game.addSystem(Schedule.Init, function spawnOne(ctx) {
    const entity = ctx.entities.createEntity();
    ctx.entities.set(entity, Transform2D, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
    ctx.entities.set(entity, Display2D, { alpha: 1, visible: true });
    result.ctx = ctx;
    result.entity = entity;
    spawn?.(ctx, entity);
  });
  await game.start();
  return result;
}

const at = ({ ctx, entity }: Setup) => ctx.entities.get(entity, Transform2D);

describe("motion() plugin", () => {
  it("adds MotionSettings and one system, fenrir.motion.preUpdate, first in PreUpdate", async () => {
    const game = await createTestGame({ seed: 1, logger, plugins: [motion()] });
    game.addSystem(Schedule.PreUpdate, function gameInput() {});
    const snapshot = inspect(game);
    expect(snapshot.schedule.preUpdate).toEqual(["fenrir.motion.preUpdate", "gameInput"]);
    expect(snapshot.resources["fenrir.MotionSettings"]).toEqual({ paused: {}, pausedAll: false, reducedMotion: false });
  });

  it("moves values before the game's Update systems, so they see this frame's values", async () => {
    const seen: number[] = [];
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1 }));
    s.game.addSystem(Schedule.Update, function readX({ entities }) {
      seen.push(entities.get(s.entity, Transform2D).x);
    });
    s.game.step(0.25, 2);
    expect(seen).toEqual([2, 4]);
  });

  it("makes addTimer and addTween throw, naming the plugin, when it is not installed", async () => {
    const game = await createTestGame({ seed: 1, logger });
    let ctx!: SystemCtx;
    game.addSystem(Schedule.Init, (c) => void (ctx = c), { name: "test.capture" });
    await game.start();
    const entity = ctx.entities.createEntity();
    ctx.entities.set(entity, Display2D, { alpha: 1, visible: true });
    expect(() => addTimer(ctx, entity, "t", { duration: 1 })).toThrow(/motion\(\) plugin/);
    expect(() => addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 1 })).toThrow(/motion\(\) plugin/);
  });
});

describe("timers", () => {
  it("fires a one-shot timer once, when elapsed reaches duration, then removes it", async () => {
    const s = await setup(({ entities, resources }, entity) => addTimer({ entities, resources }, entity, "test.once", { duration: 0.5 }));
    s.game.step(0.25);
    expect(s.ctx.entities.get(s.entity, Timers)["test.once"]).toMatchObject({ elapsed: 0.25, remaining: 0.25, fired: 0 });
    expect(s.fired).toEqual([]);
    s.game.step(0.25);
    expect(s.fired).toEqual([{ entity: s.entity, name: "test.once", count: 1, last: true }]);
    expect(s.ctx.entities.has(s.entity, Timers)).toBe(false);
    s.game.step(0.25, 4);
    expect(s.fired).toHaveLength(1);
  });

  it("sends every firing a long frame holds and carries the overshoot", async () => {
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "test.beat", { duration: 0.0625, repeat: Infinity }));
    s.game.step(0.25);
    expect(s.fired.map((f) => (f as { count: number }).count)).toEqual([1, 2, 3, 4]);
    s.game.step(0.09375); // 1.5 periods
    expect(s.fired).toHaveLength(5);
    expect(s.ctx.entities.get(s.entity, Timers)["test.beat"]).toMatchObject({ elapsed: 0.03125, remaining: 0.03125, fired: 5 });
  });

  it("stops a repeating timer after repeat more firings, the last one marked", async () => {
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "test.three", { duration: 0.125, repeat: 2 }));
    s.game.step(0.25, 2);
    expect(s.fired).toEqual([
      { entity: s.entity, name: "test.three", count: 1, last: false },
      { entity: s.entity, name: "test.three", count: 2, last: false },
      { entity: s.entity, name: "test.three", count: 3, last: true },
    ]);
    expect(s.ctx.entities.has(s.entity, Timers)).toBe(false);
  });

  it("pauses and resumes through the timer's paused field", async () => {
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "test.wait", { duration: 0.5 }));
    s.game.step(0.25);
    const timer = s.ctx.entities.get(s.entity, Timers)["test.wait"]!;
    timer.paused = true;
    s.game.step(0.25, 4);
    expect(timer.elapsed).toBe(0.25);
    timer.paused = false;
    s.game.step(0.25);
    expect(s.fired).toHaveLength(1);
  });

  it("is cancelled by cancelTimer, by removing Timers and by destroying the entity", async () => {
    const s = await setup((ctx, entity) => {
      addTimer(ctx, entity, "a", { duration: 0.25 });
      addTimer(ctx, entity, "b", { duration: 0.25 });
    });
    expect(cancelTimer(s.ctx, s.entity, "a")).toBe(true);
    expect(cancelTimer(s.ctx, s.entity, "a")).toBe(false);
    const other = s.ctx.entities.createEntity();
    addTimer(s.ctx, other, "c", { duration: 0.25 });
    const third = s.ctx.entities.createEntity();
    addTimer(s.ctx, third, "d", { duration: 0.25 });
    s.ctx.entities.remove(other, Timers);
    s.ctx.entities.destroyEntity(third);
    s.game.step(0.25);
    expect(s.fired).toEqual([{ entity: s.entity, name: "b", count: 1, last: true }]);
  });

  it("replaces a timer of the same name", async () => {
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "t", { duration: 0.25 }));
    s.game.step(0.125);
    addTimer(s.ctx, s.entity, "t", { duration: 0.25 });
    s.game.step(0.125);
    expect(s.fired).toEqual([]);
    s.game.step(0.125);
    expect(s.fired).toHaveLength(1);
  });

  it("is removed, unfired, once its state leaves the value", async () => {
    const Phase = defineState("test.motion.Phase", { values: ["playing", "over"], initial: "playing" });
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "test.hint", { duration: 0.5, state: [Phase, "playing"] }));
    s.game.step(0.25);
    expect(s.ctx.entities.has(s.entity, Timers)).toBe(true);
    s.game.states.set(Phase, "over");
    s.game.step(0.25, 2);
    expect(s.fired).toEqual([]);
    expect(s.ctx.entities.has(s.entity, Timers)).toBe(false);
    expect(() => addTimer(s.ctx, s.entity, "x", { duration: 1, state: [Phase, "nope" as "over"] })).toThrow(/no value "nope"/);
  });

  it("rejects bad durations and a repeating timer of duration 0", async () => {
    const s = await setup();
    expect(() => addTimer(s.ctx, s.entity, "x", { duration: -1 })).toThrow(/finite seconds/);
    expect(() => addTimer(s.ctx, s.entity, "x", { duration: Infinity })).toThrow(/finite seconds/);
    expect(() => addTimer(s.ctx, s.entity, "x", { duration: 0, repeat: 1 })).toThrow(/duration above 0/);
    expect(() => addTimer(s.ctx, s.entity, "x", { duration: 1, repeat: 1.5 })).toThrow(/whole number/);
  });

  it("fires a timer of duration 0 at the next frame, even one of dt 0", async () => {
    const s = await setup((ctx, entity) => addTimer(ctx, entity, "now", { duration: 0 }));
    s.game.step(0);
    expect(s.fired).toHaveLength(1);
  });
});

describe("tweens", () => {
  it("lands exactly on the end values and sends TweenDone once", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 0.3, y: -7 }, duration: 0.3 }));
    s.game.step(0.1, 2);
    expect(at(s).x).toBeCloseTo(0.2, 12);
    s.game.step(0.1);
    expect(at(s)).toMatchObject({ x: 0.3, y: -7 });
    expect(s.done).toEqual([{ entity: s.entity, name: "fenrir.Transform2D:x,y" }]);
    expect(s.ctx.entities.has(s.entity, Tweens)).toBe(false);
    s.game.step(0.25);
    expect(s.done).toHaveLength(1);
  });

  it("lands on the end value when a frame overshoots the end", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 0.2, ease: "quadOut" }));
    s.game.step(0.25);
    expect(s.ctx.entities.get(s.entity, Display2D).alpha).toBe(0);
    expect(s.done).toHaveLength(1);
  });

  it("applies the easing", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 100 }, duration: 1, ease: "quadIn" }));
    s.game.step(0.25, 2);
    expect(at(s).x).toBe(25);
    expect(easings.quadOut(0.5)).toBe(0.75);
    expect(easings.cubicInOut(0.25)).toBe(0.0625);
    expect(easings.sineInOut(0.5)).toBeCloseTo(0.5, 12);
    expect(easings.backOut(1)).toBe(1);
    for (const ease of Object.values(easings)) expect(ease(0)).toBeCloseTo(0, 12);
  });

  it("takes a custom easing by name and rejects an unknown one", async () => {
    defineEasing("test.steps", (t) => Math.floor(t * 4) / 4);
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1, ease: "test.steps" }));
    s.game.step(0.25, 3);
    expect(at(s).x).toBe(6);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: { x: 1 }, duration: 1, ease: "test.missing" })).toThrow(/no easing is called "test.missing"/);
    expect(() => defineEasing("linear", (t) => t)).toThrow(/built-in/);
  });

  it("waits out the delay, then starts from the values the component has then", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 10 }, duration: 0.5, delay: 0.25 }));
    s.game.step(0.125);
    at(s).x = 4; // moved by the game during the delay
    s.game.step(0.125);
    expect(at(s).x).toBe(4);
    expect(s.ctx.entities.get(s.entity, Tweens)["fenrir.Transform2D:x"]).toMatchObject({ started: true, from: { x: 4 } });
    s.game.step(0.25);
    expect(at(s).x).toBe(7);
  });

  it("starts from given values", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Display2D, { from: { alpha: 0 }, to: { alpha: 1 }, duration: 0.5 }));
    s.game.step(0.125);
    expect(s.ctx.entities.get(s.entity, Display2D).alpha).toBe(0.25);
  });

  it("repeats, carrying the overshoot into the next play", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 4 }, duration: 0.25, repeat: 2 }));
    s.game.step(0.25);
    expect(at(s).x).toBe(0); // the second play has just begun
    s.game.step(0.125);
    expect(at(s).x).toBe(2);
    s.game.step(0.25);
    expect(at(s).x).toBe(2); // half way through the third play
    expect(s.done).toEqual([]);
    s.game.step(0.25);
    expect(at(s).x).toBe(4);
    expect(s.done).toHaveLength(1);
  });

  it("yoyos: every second play runs back, and an even number of plays ends at the start", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { y: 8 }, duration: 0.25, repeat: 1, yoyo: true }));
    s.game.step(0.125);
    expect(at(s).y).toBe(4);
    s.game.step(0.25);
    expect(at(s).y).toBe(4); // half way back
    s.game.step(0.125);
    expect(at(s).y).toBe(0);
    expect(s.done).toHaveLength(1);
  });

  it("runs two tweens on one entity at once", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { x: 10 }, duration: 0.5 });
      addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 0.25 });
    });
    s.game.step(0.25);
    expect(at(s).x).toBe(5);
    expect(s.ctx.entities.get(s.entity, Display2D).alpha).toBe(0);
    expect(s.done).toEqual([{ entity: s.entity, name: "fenrir.Display2D:alpha" }]);
    s.game.step(0.25);
    expect(at(s).x).toBe(10);
  });

  it("replaces a tween of the same name, and the newest tween of a field takes it from older ones", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { x: 10, y: 10 }, duration: 0.5, name: "test.move" });
    });
    s.game.step(0.25);
    addTween(s.ctx, s.entity, Transform2D, { to: { x: -5 }, duration: 0.25 });
    expect(s.ctx.entities.get(s.entity, Tweens)["test.move"]!.to).toEqual({ y: 10 });
    s.game.step(0.25);
    expect(at(s)).toMatchObject({ x: -5, y: 10 });
    expect(s.done.map((d) => (d as { name: string }).name)).toEqual(["test.move", "fenrir.Transform2D:x"]);

    addTween(s.ctx, s.entity, Transform2D, { to: { x: 100 }, duration: 1, name: "test.again" });
    addTween(s.ctx, s.entity, Transform2D, { to: { x: 50 }, duration: 0.25, name: "test.again" });
    s.game.step(0.25);
    expect(at(s).x).toBe(50);
    expect(s.done).toHaveLength(3); // the replaced tween sends nothing
  });

  it("tweens a game-defined component of plain numbers", async () => {
    type Meter = { level: number; label: string };
    const Meter = defineComponent<Meter>("test.motion.Meter");
    const s = await setup((ctx, entity) => {
      ctx.entities.set(entity, Meter, { level: 0, label: "fish" });
      addTween(ctx, entity, Meter, { to: { level: 1 }, duration: 0.5 });
    });
    s.game.step(0.25);
    expect(s.ctx.entities.get(s.entity, Meter)).toEqual({ level: 0.5, label: "fish" });
    // @ts-expect-error label is not a number, so it is not a tweenable field
    expect(() => addTween(s.ctx, s.entity, Meter, { to: { label: 1 }, duration: 1 })).toThrow(/not a number/);
  });

  it("drops the tween, unfinished and silently, when the tweened component is removed", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 0.5 }));
    s.game.step(0.125);
    s.ctx.entities.remove(s.entity, Display2D);
    s.game.step(0.25, 3);
    expect(s.done).toEqual([]);
    expect(s.ctx.entities.has(s.entity, Tweens)).toBe(false);
  });

  it("is cancelled by cancelTween, leaving the field where it is", async () => {
    const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 0.5, name: "test.go" }));
    s.game.step(0.25);
    expect(cancelTween(s.ctx, s.entity, "test.go")).toBe(true);
    s.game.step(0.25);
    expect(at(s).x).toBe(4);
    expect(s.done).toEqual([]);
  });

  it("checks its options", async () => {
    const s = await setup();
    const bare = s.ctx.entities.createEntity();
    expect(() => addTween(s.ctx, bare, Transform2D, { to: { x: 1 }, duration: 1 })).toThrow(/no fenrir.Transform2D component/);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: {}, duration: 1 })).toThrow(/names no fields/);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: { x: NaN }, duration: 1 })).toThrow(/finite/);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: { x: 1 }, from: { y: 1 }, duration: 1 })).toThrow(/\{ from \} has y/);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: { x: 1 }, duration: 1, delay: -1 })).toThrow(/finite seconds/);
    expect(() => addTween(s.ctx, s.entity, Transform2D, { to: { x: 1 }, duration: 0, repeat: Infinity })).toThrow(/duration above 0/);
  });

  it("finishes a tween of duration 0 at the next frame, even one of dt 0, and moves nothing at dt 0 otherwise", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Display2D, { to: { alpha: 0.5 }, duration: 0 });
      addTween(ctx, entity, Transform2D, { to: { x: 9 }, duration: 1 });
    });
    s.game.step(0);
    expect(s.ctx.entities.get(s.entity, Display2D).alpha).toBe(0.5);
    expect(at(s).x).toBe(0);
    expect(s.done).toHaveLength(1);
  });
});

describe("groups and reduced motion", () => {
  it("pauses a group of timers and tweens while the rest run", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { y: 4 }, duration: 0.5, repeat: Infinity, yoyo: true, group: "ambient" });
      addTimer(ctx, entity, "test.blink", { duration: 0.25, repeat: Infinity, group: "ambient" });
      addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1 });
    });
    s.game.step(0.25);
    const settings = s.game.resources.get(MotionSettings);
    settings.paused.ambient = true;
    s.game.step(0.25, 2);
    expect(at(s)).toMatchObject({ x: 6, y: 2 });
    expect(s.fired).toHaveLength(1);
    settings.paused.ambient = false;
    s.game.step(0.25);
    expect(at(s)).toMatchObject({ x: 8, y: 4 });
    expect(s.fired).toHaveLength(2);
  });

  it("pauses everything, grouped or not, with pausedAll", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1 });
      addTimer(ctx, entity, "test.blink", { duration: 0.25, repeat: Infinity, group: "ambient" });
    });
    s.game.step(0.25);
    const settings = s.game.resources.get(MotionSettings);
    settings.pausedAll = true;
    s.game.step(0.25, 2);
    expect(at(s)).toMatchObject({ x: 2 });
    expect(s.fired).toHaveLength(1);
    // A group's own flag still holds it after pausedAll is lifted.
    settings.paused.ambient = true;
    settings.pausedAll = false;
    s.game.step(0.25);
    expect(at(s)).toMatchObject({ x: 4 });
    expect(s.fired).toHaveLength(1);
  });

  describe("pausing in the frame that decides it", () => {
    // The pause is decided in the second frame, by a PreUpdate system.
    async function pauseOnStep(options: { before?: string }) {
      const s = await setup((ctx, entity) => addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1 }));
      let pauseNow = false;
      s.game.addSystem(Schedule.PreUpdate, function pauseMenu({ resources }) {
        if (pauseNow) resources.get(MotionSettings).pausedAll = true;
      }, options);
      s.game.step(0.25);
      pauseNow = true;
      s.game.step(0.25);
      return s;
    }

    it("takes effect in the same frame from a system ordered before fenrir.motion.preUpdate", async () => {
      const s = await pauseOnStep({ before: "fenrir.motion.preUpdate" });
      expect(inspect(s.game).schedule.preUpdate).toEqual(["pauseMenu", "fenrir.motion.preUpdate"]);
      expect(at(s)).toMatchObject({ x: 2 });
    });

    it("takes effect a frame late from a system registered after the plugin, as before", async () => {
      const s = await pauseOnStep({});
      expect(inspect(s.game).schedule.preUpdate).toEqual(["fenrir.motion.preUpdate", "pauseMenu"]);
      expect(at(s)).toMatchObject({ x: 4 });
    });
  });

  it("completes tweens at once under reducedMotion, sending TweenDone, and leaves timers alone", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 2, delay: 1 });
      addTween(ctx, entity, Transform2D, { to: { y: 3 }, duration: 0.5, repeat: Infinity, yoyo: true });
      addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 0.5, repeat: Infinity });
      addTimer(ctx, entity, "test.later", { duration: 0.5 });
    });
    s.game.resources.get(MotionSettings).reducedMotion = true;
    s.game.step(0);
    expect(at(s)).toMatchObject({ x: 8, y: 0 });
    expect(s.ctx.entities.get(s.entity, Display2D).alpha).toBe(0);
    expect(s.done).toHaveLength(3);
    expect(s.fired).toEqual([]);
    s.game.step(0.25, 2);
    expect(s.fired).toHaveLength(1);
  });
});

describe("lifetime and determinism", () => {
  it("keeps timers and tweens across stop and run, continuing where they were", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Transform2D, { to: { x: 8 }, duration: 1 });
      addTimer(ctx, entity, "test.t", { duration: 0.75 });
    });
    s.game.removeSystem("spawnOne");
    s.game.step(0.25, 2);
    await s.game.stop();
    expect(at(s).x).toBe(4);
    await s.game.start();
    s.game.step(0.25);
    expect(at(s).x).toBe(6);
    expect(s.fired).toHaveLength(1);
    expect(s.game.resources.get(MotionSettings)).toEqual({ paused: {}, pausedAll: false, reducedMotion: false });
  });

  it("gives the same values for the same steps", async () => {
    const run = async () => {
      const s = await setup((ctx, entity) => {
        addTween(ctx, entity, Transform2D, { to: { x: 300, rotation: 3, scaleX: 2 }, duration: 0.7, ease: "backOut", repeat: 3, yoyo: true });
        addTween(ctx, entity, Display2D, { to: { alpha: 0.2 }, duration: 0.45, ease: "sineInOut", delay: 0.1 });
        addTimer(ctx, entity, "test.tick", { duration: 0.13, repeat: Infinity });
      });
      const trace: unknown[] = [];
      for (const dt of [1 / 60, 1 / 30, 0.2, 0, 1 / 144, 0.25, 1 / 60]) {
        s.game.step(dt, 3);
        trace.push(inspect(s.game).entities, s.fired.length, s.done.length);
      }
      return trace;
    };
    expect(await run()).toEqual(await run());
  });

  it("shows timers, tweens and settings in inspect() as plain JSON", async () => {
    const s = await setup((ctx, entity) => {
      addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 1, ease: "quadOut", group: "fade" });
      addTimer(ctx, entity, "test.t", { duration: 0.5 });
    });
    s.game.step(0.25);
    const snapshot = inspect(s.game);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    const { components } = snapshot.entities.find((e) => e.id === s.entity)!;
    expect(components["fenrir.Tweens"]).toEqual({
      "fenrir.Display2D:alpha": {
        component: "fenrir.Display2D", from: { alpha: 1 }, to: { alpha: 0 }, duration: 1, delay: 0, ease: "quadOut",
        repeat: 0, yoyo: false, elapsed: 0.25, started: true, paused: false, group: "fade",
      },
    });
    expect(components["fenrir.Timers"]).toEqual({
      "test.t": { duration: 0.5, elapsed: 0.25, remaining: 0.25, repeat: 0, fired: 0, paused: false, group: null, state: null },
    });
  });
});

describe("the AGENTS.md example", () => {
  it("settles a card, fades it in and holds a paused group's timer", async () => {
    const game = await createTestGame({ seed: 1, logger, plugins: [motion()] });
    const finished: string[] = [];
    game.on(TweenDone, ({ name }) => void finished.push(name));
    let card!: Entity;
    let ctx!: SystemCtx;
    game.addSystem(Schedule.Init, function spawn(c) {
      ctx = c;
      card = c.entities.createEntity();
      c.entities.set(card, Transform2D, { x: 0, y: 600, rotation: 0, scaleX: 1, scaleY: 1 });
      c.entities.set(card, Display2D, { alpha: 0, visible: true });
      addTween(c, card, Transform2D, { to: { y: 400 }, duration: 0.25, ease: "backOut", name: "myGame.settle" });
      addTween(c, card, Display2D, { to: { alpha: 1 }, duration: 0.25, delay: 0.1 });
      addTimer(c, card, "myGame.hint", { duration: 2, repeat: Infinity, group: "ambient" });
    });
    await game.start();
    game.resources.get(MotionSettings).paused.ambient = true;
    game.step(1 / 60, 30);
    expect(finished).toEqual(["myGame.settle", "fenrir.Display2D:alpha"]);
    expect(ctx.entities.get(card, Timers)["myGame.hint"]!.elapsed).toBe(0);
  });
});

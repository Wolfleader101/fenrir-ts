// Gameplay: components, resources, states and systems, with no Pixi. It runs the same in the
// browser (src/main.ts) and headless in tests (tests/game.test.ts).
import {
  EntityBuilder,
  Schedule,
  Transform2D,
  defineAction,
  defineComponent,
  defineResource,
  defineState,
  inState,
  type GameBase,
  type SystemCtx,
} from "fenrir-ts";

/** The design frame: the game draws in units of a 390-wide frame at least 640 tall. */
export const DESIGN = { width: 390, minHeight: 640 } as const;
export const ROUND_SECONDS = 10;
/** How close to a star's centre a tap must land to catch it, in design units. */
export const CATCH_RADIUS = 40;
const STAR_SPEED = 140;
const MARGIN = 32;

export const Phase = defineState("game.Phase", { values: ["ready", "playing", "over"], initial: "ready" });
export const Score = defineResource("game.Score", () => ({ points: 0, timeLeft: ROUND_SECONDS }));
export const Tap = defineAction("game.tap", ["pointer.primary"]);
/** A star that crosses the screen; `vx` is its speed in design units per second. */
export const Star = defineComponent<{ vx: number }>("game.Star");

const STARS = [Star, Transform2D] as const; // query tuples live at module level: views are cached by identity

function spawnStar({ entities }: SystemCtx): void {
  EntityBuilder.create().name("game.star").transform2D(DESIGN.width / 2, 260).with(Star, { vx: STAR_SPEED }).spawn(entities);
}

function start({ input, states }: SystemCtx): void {
  if (!input.pressed(Tap)) return;
  states.set(Phase, "playing"); // applied when this returns, so `play` runs in this same frame...
  input.consume(Tap); // ...and would count this tap as a catch without this
}

function moveStars({ entities, time }: SystemCtx): void {
  entities.each(STARS, (_entity, star, transform) => {
    transform.x += star.vx * time.delta;
    if (transform.x < MARGIN || transform.x > DESIGN.width - MARGIN) {
      transform.x = Math.min(Math.max(transform.x, MARGIN), DESIGN.width - MARGIN);
      star.vx = -star.vx;
    }
  });
}

function play({ entities, input, resources, states, time }: SystemCtx): void {
  const score = resources.get(Score);
  score.timeLeft = Math.max(0, score.timeLeft - time.delta);
  if (input.pressed(Tap)) {
    const { x, y } = input.pointer; // design units
    entities.each(STARS, (_entity, _star, transform) => {
      if (Math.hypot(transform.x - x, transform.y - y) <= CATCH_RADIUS) score.points += 1;
    });
  }
  if (score.timeLeft <= 0) states.set(Phase, "over");
}

/** Registers the gameplay on a browser game or a test game. */
export function addGameplay(game: GameBase): void {
  game
    .onEnter(Phase, "playing", ({ resources }) => resources.set(Score, { points: 0, timeLeft: ROUND_SECONDS }))
    .addSystem(Schedule.Init, spawnStar)
    .addSystem(Schedule.Update, start, { runIf: inState(Phase, "ready", "over") })
    .addSystem(Schedule.Update, moveStars, { runIf: inState(Phase, "playing") })
    .addSystem(Schedule.Update, play, { runIf: inState(Phase, "playing") });
}

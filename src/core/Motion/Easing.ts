/** Maps progress `t` from 0 to 1 onto eased progress, 0 at 0 and 1 at 1. */
export type Easing = (t: number) => number;

/**
 * The built-in easings, by the name a tween's `ease` takes. Each is a plain function, so code
 * can also call one directly: `easings.quadOut(0.5)`.
 */
export const easings = {
  linear: (t: number) => t,
  quadIn: (t: number) => t * t,
  quadOut: (t: number) => t * (2 - t),
  quadInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
  cubicIn: (t: number) => t * t * t,
  cubicOut: (t: number) => 1 - (1 - t) ** 3,
  cubicInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - 4 * (1 - t) ** 3),
  sineIn: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  sineOut: (t: number) => Math.sin((t * Math.PI) / 2),
  sineInOut: (t: number) => (1 - Math.cos(t * Math.PI)) / 2,
  /** Overshoots the end by about 10% and settles back. */
  backOut: (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
} satisfies Record<string, Easing>;

/** The name of a built-in easing. */
export type EasingName = keyof typeof easings;

const own = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key);

/** Easings added with `defineEasing`, by name. */
const defined: Record<string, Easing> = {};

/**
 * Adds an easing that tweens can name in `ease`, so tween data stays plain JSON. Prefix the
 * name with your game's namespace (`myGame.bounce`); the built-in names cannot be redefined.
 * Defining the same name again replaces the function.
 *
 * @example
 * defineEasing("myGame.steps", (t) => Math.floor(t * 4) / 4);
 * addTween(ctx, entity, Display2D, { to: { alpha: 0 }, duration: 1, ease: "myGame.steps" });
 */
export function defineEasing(name: string, easing: Easing): void {
  if (own(easings, name)) throw new Error(`defineEasing: "${name}" is a built-in easing. Give yours a namespaced name, such as "myGame.${name}".`);
  if (typeof easing !== "function") throw new TypeError(`defineEasing("${name}", ...) needs a function of t, got ${typeof easing}.`);
  defined[name] = easing;
}

/** The easing called `name`, or undefined. Internal. */
export function findEasing(name: string): Easing | undefined {
  return own(easings, name) ? easings[name as EasingName] : own(defined, name) ? defined[name] : undefined;
}

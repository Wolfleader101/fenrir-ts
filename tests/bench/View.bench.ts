// Benchmarks for ECS view iteration. Run with `pnpm bench`.
// Not part of `pnpm test:run` or CI: numbers depend on the machine, so nothing
// here asserts on them. Compare runs on the same machine before and after a change.
import { bench, describe } from "vitest";
import { EntityList } from "@/core/ECS/EntityList";
import { defineComponent } from "@/core/ECS/Component";
import { View } from "@/core/ECS/View";

type Vec = { x: number; y: number };
const A = defineComponent<Vec>("bench.A");
const B = defineComponent<Vec>("bench.B");
const C = defineComponent<Vec>("bench.C");
const D = defineComponent<Vec>("bench.D");
const E = defineComponent<Vec>("bench.E");

const ENTITY_COUNT = 10_000;

const entities = new EntityList();
for (let i = 0; i < ENTITY_COUNT; i++) {
  const entity = entities.createEntity();
  for (const type of [A, B, C, D, E]) entities.set(entity, type, { x: i, y: i });
}

const view1 = new View(entities, [A] as const);
const view2 = new View(entities, [A, B] as const);
const view3 = new View(entities, [A, B, C] as const);
const view4 = new View(entities, [A, B, C, D] as const);
const view5 = new View(entities, [A, B, C, D, E] as const);

// The generic loop `each` falls back to for five or more types, called with four
// pools so it does the same work as the unrolled `each4`.
type Internals = {
  drive: unknown;
  pools: unknown[];
  eachN(drive: unknown, pools: unknown[], fn: (...args: any[]) => void): void;
};
const view4Internals = view4 as unknown as Internals;

let sink = 0;

describe(`View.each over ${ENTITY_COUNT} entities`, () => {
  bench("1 component (each1)", () => {
    view1.each((_e, a) => { sink += a.x; });
  });
  bench("2 components (each2)", () => {
    view2.each((_e, a, b) => { sink += a.x + b.x; });
  });
  bench("3 components (each3)", () => {
    view3.each((_e, a, b, c) => { sink += a.x + b.x + c.x; });
  });
  bench("4 components (each4)", () => {
    view4.each((_e, a, b, c, d) => { sink += a.x + b.x + c.x + d.x; });
  });
  bench("4 components (generic eachN)", () => {
    view4Internals.eachN(view4Internals.drive, view4Internals.pools, (_e, a: Vec, b: Vec, c: Vec, d: Vec) => {
      sink += a.x + b.x + c.x + d.x;
    });
  });
  bench("5 components (eachN)", () => {
    view5.each((_e, a, b, c, d, e) => { sink += a.x + b.x + c.x + d.x + e.x; });
  });
});

// Keep `sink` observable so the loops are not optimised away.
export { sink };

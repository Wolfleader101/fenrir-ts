import { describe, expect, expectTypeOf, it } from "vitest";
import { ManualClock } from "@/core/Clock";
import { Random, seedFromClock } from "@/core/Random";

function draws(random: Random, count: number): number[] {
  return Array.from({ length: count }, () => random.next());
}

describe("Random", () => {
  it("is mulberry32: seed 0 gives the reference sequence", () => {
    const random = new Random(0);
    // The first outputs of the canonical mulberry32 with seed 0, as uint32.
    expect(draws(random, 3).map((x) => x * 2 ** 32)).toEqual([1144304738, 1416247, 958946056]);
  });

  it("gives the same sequence for the same seed and a different one for another seed", () => {
    expect(draws(new Random(42), 100)).toEqual(draws(new Random(42), 100));
    expect(draws(new Random(42), 100)).not.toEqual(draws(new Random(43), 100));
  });

  it("reduces the seed to 32 bits and reports it", () => {
    expect(new Random(-1).seed).toBe(0xffff_ffff);
    expect(new Random(2 ** 32 + 5).seed).toBe(5);
    expect(draws(new Random(2 ** 32 + 5), 10)).toEqual(draws(new Random(5), 10));
  });

  it("rejects seeds that are not safe integers", () => {
    for (const seed of [1.5, Number.NaN, Infinity, 2 ** 53]) {
      expect(() => new Random(seed)).toThrow(/safe integer/);
    }
  });

  it("keeps next() in [0, 1) and spreads it evenly", () => {
    const random = new Random(7);
    const buckets = new Array<number>(10).fill(0);
    let min = 1;
    let max = 0;
    for (const x of draws(random, 100_000)) {
      min = Math.min(min, x);
      max = Math.max(max, x);
      buckets[Math.floor(x * 10)]!++;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    // 10,000 expected per bucket; the standard deviation is about 95.
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it("draws every integer of an inclusive range evenly", () => {
    const random = new Random(11);
    const counts = new Map<number, number>();
    for (let i = 0; i < 60_000; i++) {
      const value = random.int(-2, 3);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2, 3]);
    for (const count of counts.values()) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it("handles single-value and full 32-bit ranges", () => {
    const random = new Random(3);
    expect(random.int(9, 9)).toBe(9);
    for (let i = 0; i < 100; i++) {
      const value = random.int(0, 2 ** 32 - 1);
      if (!Number.isInteger(value) || value < 0 || value >= 2 ** 32) throw new Error(`out of range: ${value}`);
    }
  });

  it("explains what to change when int arguments are wrong", () => {
    const random = new Random(1);
    expect(() => random.int(5, 1)).toThrow("random.int(min, max) needs min <= max, got (5, 1). Swap them.");
    expect(() => random.int(0.5, 2)).toThrow(TypeError);
    expect(() => random.int(0, Number.NaN)).toThrow(/safe integers/);
    expect(() => random.int(0, 2 ** 32)).toThrow(/at most 2\^32 values/);
  });

  it("picks every item and throws on an empty list", () => {
    const random = new Random(5);
    const items = ["a", "b", "c"] as const;
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(random.pick(items));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
    expect(() => random.pick([])).toThrow("random.pick(items) needs at least one item, got an empty list.");
  });

  it("types pick as the item type, without undefined", () => {
    const random = new Random(1);
    expectTypeOf(random.pick([1, 2, 3])).toEqualTypeOf<number>();
    expectTypeOf(random.pick(["idle", "run"] as const)).toEqualTypeOf<"idle" | "run">();
    const readonlyItems: readonly { id: number }[] = [{ id: 1 }];
    expectTypeOf(random.pick(readonlyItems)).toEqualTypeOf<{ id: number }>();
    // @ts-expect-error pick takes a list, not a single item
    expect(() => random.pick(1)).toThrow();
  });
});

describe("seedFromClock", () => {
  it("uses the clock's wall time reduced to 32 bits", () => {
    expect(seedFromClock(new ManualClock(2 ** 32 + 17.9))).toBe(17);
  });
});

import { describe, expect, it } from "vitest";
import { MAX_DEPTH, MAX_ITEMS, MAX_STRING, MAX_VALUES, toJson } from "@/core/Json";

const roundTrip = (value: unknown) => JSON.parse(JSON.stringify(value));

class Vec {
  public x: number;
  public y: number;
  constructor(x = 1, y = 2) {
    this.x = x;
    this.y = y;
  }
}
class Sprite {
  public texture = new Vec();
  public visible = true;
}

describe("toJson", () => {
  it("keeps strings, booleans, finite numbers and null, and writes -0 as 0", () => {
    expect(toJson("a")).toBe("a");
    expect(toJson(true)).toBe(true);
    expect(toJson(1.5)).toBe(1.5);
    expect(Object.is(toJson(-0), 0)).toBe(true);
    expect(toJson(null)).toBeNull();
  });

  it("tags the values JSON has no form for", () => {
    function jump() {}
    expect(toJson(undefined)).toEqual({ $type: "undefined" });
    expect(toJson(NaN)).toEqual({ $type: "number", value: "NaN" });
    expect(toJson(Infinity)).toEqual({ $type: "number", value: "Infinity" });
    expect(toJson(-Infinity)).toEqual({ $type: "number", value: "-Infinity" });
    expect(toJson(12n)).toEqual({ $type: "bigint", value: "12" });
    expect(toJson(Symbol("tag"))).toEqual({ $type: "symbol", value: "tag" });
    expect(toJson(jump)).toEqual({ $type: "function", name: "jump" });
    expect(toJson(new Date(Date.UTC(2026, 0, 2)))).toEqual({ $type: "Date", value: "2026-01-02T00:00:00.000Z" });
    expect(toJson(new Date(NaN))).toEqual({ $type: "Date", value: null });
  });

  it("keeps undefined fields as tags, so a key that exists is visible", () => {
    expect(toJson({ a: undefined, b: [undefined] })).toEqual({ a: { $type: "undefined" }, b: [{ $type: "undefined" }] });
  });

  it("encodes a Map as its entries and a Set as its values, in insertion order, keys included", () => {
    const map = new Map<unknown, unknown>([["gold", 3], [{ id: 1 }, new Set(["a", "b"])]]);
    expect(toJson(map)).toEqual({
      $type: "Map",
      entries: [["gold", 3], [{ id: 1 }, { $type: "Set", values: ["a", "b"] }]],
    });
  });

  it("encodes typed arrays by their class with their values", () => {
    expect(toJson(new Float32Array([1, 2]))).toEqual({ $type: "Float32Array", values: [1, 2] });
    expect(toJson(new Uint8Array(0))).toEqual({ $type: "Uint8Array", values: [] });
  });

  it("expands a class instance whose own fields are all primitives, and names any other", () => {
    expect(toJson(new Vec(3, 4))).toEqual({ $type: "Vec", x: 3, y: 4 });
    expect(toJson(new Sprite())).toEqual({ $type: "Sprite" });
    expect(toJson(new (class {})())).toEqual({});
    expect(toJson(new WeakMap())).toEqual({ $type: "WeakMap" });
    expect(toJson(new ArrayBuffer(8))).toEqual({ $type: "ArrayBuffer" });
  });

  it("adds a class instance's string label, a name that survives minification", () => {
    class Node {
      public children: Node[] = [];
      public label: string | null = null;
    }
    const ship = Object.assign(new Node(), { label: "myGame.ship" });
    expect(toJson(ship)).toEqual({ $type: "Node", label: "myGame.ship" });
    expect(toJson(new Node())).toEqual({ $type: "Node" });
    expect(toJson(Object.assign(new Node(), { label: "" }))).toEqual({ $type: "Node" });
  });

  it("names DOM nodes by their class", () => {
    expect(toJson(document.createElement("canvas"))).toEqual({ $type: "HTMLCanvasElement" });
  });

  it("treats null-prototype objects as plain objects", () => {
    const bare = Object.assign(Object.create(null) as object, { a: 1 });
    expect(toJson(bare)).toEqual({ a: 1 });
  });

  it("adds a $ to plain-data keys that start with $, so data never reads as a tag", () => {
    expect(toJson({ $type: "Map", $x: 1, y: 2 })).toEqual({ $$type: "Map", $$x: 1, y: 2 });
  });

  it("uses toJSON when there is one", () => {
    expect(toJson({ toJSON: () => ({ hp: 3 }) })).toEqual({ hp: 3 });
  });

  it("reports a throwing getter or toJSON as Thrown instead of throwing", () => {
    const getter = { ok: 1, get bad(): number { throw new Error("no"); } };
    expect(toJson(getter)).toEqual({ ok: 1, bad: { $type: "Thrown", message: "no" } });
    expect(toJson({ toJSON() { throw new Error("nope"); } })).toEqual({ $type: "Thrown", message: "nope" });
    class Odd { get x(): number { return 1; } }
    Object.defineProperty(Odd.prototype, "constructor", { get() { throw new Error("hidden"); } });
    expect(toJson(new Odd())).toEqual({});
    const proxy = new Proxy({}, { ownKeys() { throw new Error("trap"); } });
    expect(toJson(proxy)).toEqual({ $type: "Thrown", message: "trap" });
  });

  it("marks a cycle without following it, and repeats a shared reference", () => {
    const node: { name: string; self?: unknown } = { name: "a" };
    node.self = node;
    expect(toJson(node)).toEqual({ name: "a", self: { $type: "Object", $truncated: "cycle" } });
    const shared = { v: 1 };
    expect(toJson([shared, shared])).toEqual([{ v: 1 }, { v: 1 }]);
  });

  it(`cuts nesting below ${MAX_DEPTH} levels and marks it`, () => {
    let deep: unknown = "bottom";
    for (let i = 0; i < MAX_DEPTH + 2; i++) deep = [deep];
    let out = toJson(deep);
    for (let i = 0; i < MAX_DEPTH; i++) out = (out as unknown[])[0] as never;
    expect(out).toEqual({ $type: "Array", $truncated: "depth" });
  });

  it(`keeps the first ${MAX_ITEMS} items of arrays, Maps, Sets and objects, and says how many there were`, () => {
    const items = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => i);
    expect(toJson(items)).toEqual({ $type: "Array", size: MAX_ITEMS + 5, values: items.slice(0, MAX_ITEMS), $truncated: "length" });
    expect(toJson(items.slice(0, MAX_ITEMS))).toEqual(items.slice(0, MAX_ITEMS));
    const map = toJson(new Map(items.map((i) => [i, i]))) as Record<string, unknown>;
    expect(map).toMatchObject({ $type: "Map", size: MAX_ITEMS + 5, $truncated: "length" });
    expect(map.entries).toHaveLength(MAX_ITEMS);
    expect(toJson(new Set(items))).toMatchObject({ $type: "Set", size: MAX_ITEMS + 5, $truncated: "length" });
    expect(toJson(new Float64Array(items))).toMatchObject({ $type: "Float64Array", size: MAX_ITEMS + 5, $truncated: "length" });
    const object = toJson(Object.fromEntries(items.map((i) => [`k${i}`, i]))) as Record<string, Record<string, number>>;
    expect(object).toMatchObject({ $type: "Object", size: MAX_ITEMS + 5, $truncated: "length" });
    expect(Object.keys(object.value!)).toHaveLength(MAX_ITEMS);
  });

  it(`keeps the first ${MAX_STRING} characters of a long string`, () => {
    const long = "x".repeat(MAX_STRING + 1);
    expect(toJson(long)).toEqual({ $type: "string", size: MAX_STRING + 1, value: long.slice(0, MAX_STRING), $truncated: "length" });
  });

  it(`stops after ${MAX_VALUES} values and marks every value it left out`, () => {
    const row = Array.from({ length: MAX_ITEMS }, (_, i) => i);
    const grid = Array.from({ length: MAX_ITEMS }, () => row); // one shared row: 10,100 values
    const out = toJson(grid) as number[][];
    expect(out[0]).toEqual(row);
    expect(out.flat().filter((v) => typeof v === "number")).toHaveLength(MAX_VALUES - 51); // the grid and 50 rows count as values too
    expect(out.at(-1)).toEqual({ $type: "Array", $truncated: "size" });
  });

  it("always survives a JSON round trip unchanged", () => {
    const node: Record<string, unknown> = {};
    node.self = node;
    const value = {
      n: [1, -0, NaN, Infinity], u: undefined, b: 1n, s: Symbol("s"), f: () => 1, d: new Date(0),
      m: new Map([[1, { a: 1 }]]), set: new Set([1]), t: new Int16Array([1]), v: new Vec(), c: new Sprite(), node,
    };
    const json = toJson(value);
    expect(roundTrip(json)).toEqual(json);
  });
});

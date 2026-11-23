/** A value that `JSON.stringify` writes and `JSON.parse` reads back unchanged. */
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

/** Levels of nesting below a component or resource value before the rest is cut. */
export const MAX_DEPTH = 8;
/** Items kept from one array, typed array, Map or Set, and keys kept from one object. */
export const MAX_ITEMS = 100;
/** Characters kept from one string. */
export const MAX_STRING = 1000;
/** Values encoded for one component or resource, counting every nested value. */
export const MAX_VALUES = 5000;

/** The constructor's name, or "Object" for plain objects, null-prototype objects and anything that hides its class. */
function typeName(value: object): string {
  try {
    const proto: unknown = Object.getPrototypeOf(value);
    const name = proto && proto !== Object.prototype && (proto as { constructor?: { name?: unknown } }).constructor?.name;
    return typeof name === "string" && name ? name : "Object";
  } catch {
    return "Object";
  }
}

const thrown = (error: unknown): JsonValue => {
  try {
    return { $type: "Thrown", message: error instanceof Error ? error.message : String(error) };
  } catch {
    return { $type: "Thrown", message: "" };
  }
};

/**
 * Encodes any value as JSON for `inspect(game)`. Never throws, always terminates, and encodes at
 * most `MAX_VALUES` values. The rules are in README.md under "Inspecting a game".
 */
export function toJson(root: unknown): JsonValue {
  let budget = MAX_VALUES;
  const path: object[] = [];

  /** Up to MAX_ITEMS items; `tag` "Array" is a bare array unless it was cut. */
  const list = (items: readonly unknown[], size: number, depth: number, $type: string, field = "values"): JsonValue => {
    const values = items.slice(0, MAX_ITEMS).map((item) => encode(item, depth));
    if (size > MAX_ITEMS) return { $type, size, [field]: values, $truncated: "length" };
    return $type === "Array" ? values : { $type, [field]: values };
  };

  /** Own enumerable fields, up to MAX_ITEMS. A key starting with `$` gets one more `$`. */
  const fields = (source: Record<string, unknown>, keys: readonly string[], depth: number, into: JsonObject): JsonObject => {
    for (const k of keys.slice(0, MAX_ITEMS)) {
      let value: JsonValue;
      try {
        value = encode(source[k], depth);
      } catch (error) {
        value = thrown(error);
      }
      into[k[0] === "$" ? "$" + k : k] = value;
    }
    return into;
  };

  function encode(value: unknown, depth: number): JsonValue {
    const type = typeof value;
    if (--budget < 0) return { $type: value === null ? "null" : type === "object" ? typeName(value as object) : type, $truncated: "size" };
    if (value === null || type === "boolean") return value as JsonValue;
    if (type === "number") return Number.isFinite(value) ? (value as number) + 0 : { $type: type, value: String(value) };
    if (type === "string") {
      const text = value as string;
      return text.length > MAX_STRING ? { $type: type, size: text.length, value: text.slice(0, MAX_STRING), $truncated: "length" } : text;
    }
    if (type === "function") return { $type: type, name: (value as () => void).name };
    if (type === "symbol") return { $type: type, value: (value as symbol).description ?? "" };
    if (type !== "object") return type === "bigint" ? { $type: type, value: String(value) } : { $type: type };

    const object = value as object;
    const $type = typeName(object);
    if (path.includes(object)) return { $type, $truncated: "cycle" };
    if (depth >= MAX_DEPTH) return { $type, $truncated: "depth" };
    path.push(object);
    try {
      return encodeObject(object, $type, depth + 1);
    } catch (error) {
      return thrown(error);
    } finally {
      path.pop();
    }
  }

  function encodeObject(object: object, $type: string, depth: number): JsonValue {
    if (Array.isArray(object)) return list(object, object.length, depth, "Array");
    if (object instanceof Map) return list([...object].slice(0, MAX_ITEMS), object.size, depth, "Map", "entries");
    if (object instanceof Set) return list([...object].slice(0, MAX_ITEMS), object.size, depth, "Set");
    if (object instanceof Date) return { $type: "Date", value: Number.isNaN(+object) ? null : object.toISOString() };
    if (ArrayBuffer.isView(object) && !(object instanceof DataView)) {
      const items = Array.prototype.slice.call(object, 0, MAX_ITEMS) as unknown[];
      return list(items, (object as unknown as ArrayLike<unknown>).length, depth, $type);
    }
    const record = object as Record<string, unknown>;
    if (typeof record.toJSON === "function") return encode(record.toJSON(), depth);

    const keys = Object.keys(object);
    if ($type === "Object") {
      const value = fields(record, keys, depth, {});
      return keys.length > MAX_ITEMS ? { $type, size: keys.length, value, $truncated: "length" } : value;
    }
    // A class instance shows its fields only when every one is a string, number, boolean or null.
    const data = keys.length <= MAX_ITEMS && keys.every((k) => record[k] === null || ["string", "number", "boolean"].includes(typeof record[k]));
    if (data) return fields(record, keys, depth, { $type });
    // A string `label` (Pixi's display objects have one) is a name that survives minification,
    // which renames classes and so `$type`.
    const label = record.label;
    return typeof label === "string" && label ? { $type, label: encode(label, depth) } : { $type };
  }

  return encode(root, 0);
}

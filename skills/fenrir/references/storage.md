# Storage

<!-- Generated from README.md by scripts/agent-docs.mjs. Do not edit: change README.md, then run pnpm docs:agent. -->

The full rules for the `storage()` plugin, keys, migrations, families and `persistResource`. Start at [SKILL.md](../SKILL.md); signatures are in [the API reference](../api/README.md). A fragment that uses `game` means the game `createGame` or `createTestGame` returned.

## Storage

Typed, versioned values in `localStorage`, from the opt-in `storage()` plugin in `fenrir-ts`. A key has a default and a parser, so a read never throws and never returns a value of the wrong shape. Nothing throws on write either: when storage is unavailable or full, values live in memory for the session and the game carries on. A game that does not install `storage()` and import these names ships none of this code.

```ts
import { createGame, defineStorageKey, getStored, setStored, storage, updateStored, type SystemCtx } from "fenrir-ts";

const Muted = defineStorageKey("myGame.muted", { default: false });

type Progress = { best: number; level: number };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const Progress = defineStorageKey<Progress>("myGame.progress", {
  default: { best: 0, level: 1 },
  version: 2,
  parse: (v) => (isRecord(v) && typeof v.best === "number" && typeof v.level === "number" ? { best: v.best, level: v.level } : undefined),
  // Version 1, and the game's own localStorage code before it (version 0), stored the best score as a number.
  migrate: (v, from) => (from < 2 && typeof v === "number" ? { best: v, level: 1 } : v),
});

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [storage()] });

function finishRound(ctx: SystemCtx, score: number): void {
  updateStored(ctx, Progress, (p) => ({ ...p, best: Math.max(p.best, score) }));
  if (getStored(ctx, Muted)) setStored(ctx, Muted, false);
}
```

- **Keys.** `defineStorageKey(name, { default, parse?, version?, migrate? })`; `version` defaults to 1. The name is namespaced, like a component's (`myGame.muted`), and is the key in `localStorage`, so two games on one origin do not collide; `storage({ prefix: "slot2:" })` adds a prefix for save slots or players. Values are stored as JSON with their version: `{"v":2,"value":{"best":40,"level":1}}`. Without `parse`, a stored value must have the default's `typeof`; pass `parse` for objects.
- **Reads.** `getStored(ctx, key)` returns the value set this session, else the stored value if it parses, else the default (objects copied). A missing key, unreadable storage, text that is not JSON, a value from a newer version and a value that does not parse all give the default; all but the first log one warning per key. Reads are cached, so reading every frame is cheap; mutating a returned object changes the cache only, so call `setStored` to save it.
- **Writes.** `setStored`, `updateStored` and `removeStored` never throw. A write the backend refuses (quota, storage blocked in a webview) keeps the value in memory for the session, logs once per key and returns false.
- **Migration.** A value stored with an older `version` goes through `migrate(value, from)`, then `parse`, and is written back. A value not written by Fenrir is version 0: its JSON, or its raw text if it is not JSON, so a game can adopt the keys its own code wrote before.
- **Status.** `StorageStatus` (`fenrir.StorageStatus`, shown by `inspect(game)`) is `{ backend, persistent, lastError }`: `persistent` is false when `localStorage` was unavailable at install (one warning, then memory), and `lastError` is the latest failure with its key.
- **Backends.** `localStorage` by default. `storage({ backend: memoryStorage() })` in tests, where `backend.items` is the `Map` written to. A backend is synchronous (`getItem`, `setItem`, `removeItem`), so systems read without awaiting; one backed by an asynchronous store, such as a host app's bridge in a webview, adds `hydrate()`, which the plugin awaits once in `fenrir.storage.preInit` before the game's startup systems.
- **Lifetime.** Values are not tied to a run: they stay across `stop()` and `run()`. Changes from another tab are not picked up while a value is cached. To test a reload, build a second `createTestGame` with `storage({ backend })` on the same `memoryStorage()` object.
- **Families.** `defineStorageKeyFamily(prefix, options)` takes the options of `defineStorageKey` and returns `family(suffix)`: the key named `prefix + suffix`, made once and the same object on every call after, for keys per player, level or save slot. The prefix is used as given, so end it with its separator.
- **Keeping old builds working.** By default a migrated value is written back on its first read. `writeMigrated: false` keeps it in memory and leaves the old value stored until the game next writes the key, so an older build can still read it: a release can be rolled back. Each session then migrates on its first read.
- **Resource fields.** `persistResource(game, Resource, field, key)` keeps one field of a resource in a key: it loads the field at once (after `hydrate`, with a backend that has one), and saves it with `setStored` at the end of each frame it changed in and when the run stops. Objects compare as JSON, so an edit in place counts. Call it after `createGame`, once the plugin that adds the resource is installed; a resource with a factory counts as having a value (the factory runs at the call), and it throws if the resource has neither a value nor a factory or the key is already bound, and returns a function that ends the binding. The engine binds nothing by default.

```ts
import { createGame, defineResource, defineStorageKey, defineStorageKeyFamily, getStored, persistResource, setStored, storage, type SystemCtx } from "fenrir-ts";

const Settings = defineResource("myGame.Settings", () => ({ hints: true, sensitivity: 1 }));
const Hints = defineStorageKey("myGame.hints", { default: true });
const BestTime = defineStorageKeyFamily("myGame.bestTime.", { default: 0, writeMigrated: false });

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [storage()] });
persistResource(game, Settings, "hints", Hints); // Settings.hints now loads and saves itself

function finishLevel(ctx: SystemCtx, level: string, seconds: number): void {
  const best = getStored(ctx, BestTime(level)); // "myGame.bestTime.<level>"
  if (!best || seconds < best) setStored(ctx, BestTime(level), seconds);
}
```

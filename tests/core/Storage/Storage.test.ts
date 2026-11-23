import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestGame } from "@/core/TestGame";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Schedule";
import type { ILogger } from "@/core/ILogger";
import { defineResource } from "@/core/Resource";
import { AudioState, audio } from "@/core/Audio/Audio";
import { testAudio } from "@/core/Audio/TestAudio";
import {
  StorageStatus,
  defineStorageKey,
  defineStorageKeyFamily,
  getStored,
  memoryStorage,
  persistResource,
  removeStored,
  setStored,
  storage,
  updateStored,
  type StorageBackend,
} from "@/core/Storage/Storage";
import { inspect } from "@/core/Inspect";

const Muted = defineStorageKey("test.muted", { default: false });
const Volume = defineStorageKey("test.volume", { default: 0.8 });

type Best = { score: number; level: number };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const Best = defineStorageKey<Best>("test.best", {
  default: { score: 0, level: 1 },
  version: 2,
  parse: (v) => (isRecord(v) && typeof v.score === "number" && typeof v.level === "number" ? { score: v.score, level: v.level } : undefined),
  // Version 1 (and the game's own code before it, version 0) stored a bare number.
  migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v, level: 1 } : v),
});

function recordingLogger(): ILogger & { warnings: string[] } {
  const warnings: string[] = [];
  return { ...new NullLogger(), warnings, warn: (message: string) => void warnings.push(message) } as ILogger & { warnings: string[] };
}

async function gameWith(backend: StorageBackend = memoryStorage(), logger: ILogger = new NullLogger(), prefix?: string) {
  return createTestGame({ seed: 1, logger, plugins: [storage({ backend, prefix })] });
}

const envelope = (v: number, value: unknown) => JSON.stringify({ v, value });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("storage() plugin", () => {
  it("round-trips typed values through the backend, in a versioned envelope", async () => {
    const backend = memoryStorage();
    const game = await gameWith(backend);
    expect(getStored(game, Muted)).toBe(false);
    expect(setStored(game, Muted, true)).toBe(true);
    setStored(game, Best, { score: 120, level: 3 });
    expect(backend.items.get("test.muted")).toBe(envelope(1, true));
    expect(backend.items.get("test.best")).toBe(envelope(2, { score: 120, level: 3 }));

    // A second game on the same backend reads them back.
    const next = await gameWith(backend);
    expect(getStored(next, Muted)).toBe(true);
    expect(getStored(next, Best)).toEqual({ score: 120, level: 3 });
  });

  it("returns the default for missing, corrupt and invalid values, warning once per key", async () => {
    const logger = recordingLogger();
    const backend = memoryStorage({ "test.volume": "{not json", "test.best": envelope(2, { score: "lots" }) });
    const game = await gameWith(backend, logger);
    expect(getStored(game, Muted)).toBe(false);
    expect(getStored(game, Volume)).toBe(0.8);
    expect(getStored(game, Best)).toEqual({ score: 0, level: 1 });
    expect(logger.warnings).toHaveLength(2);
    expect(logger.warnings[0]).toMatch(/"test.volume": holds an invalid value/);

    // Cached: reading again neither re-parses nor warns again.
    for (let i = 0; i < 10; i++) getStored(game, Volume);
    expect(logger.warnings).toHaveLength(2);
    // The corrupt value stays stored until the game writes the key.
    expect(backend.items.get("test.volume")).toBe("{not json");
    expect(game.resources.get(StorageStatus).lastError).toMatchObject({ key: "test.best" });
  });

  it("copies object defaults, so mutating one does not change the default", async () => {
    const game = await gameWith();
    getStored(game, Best).score = 99;
    removeStored(game, Best);
    expect(getStored(game, Best)).toEqual({ score: 0, level: 1 });
    expect(Best.default).toEqual({ score: 0, level: 1 });
  });

  it("checks the default's type when no parse is given", async () => {
    const game = await gameWith(memoryStorage({ "test.muted": envelope(1, "yes"), "test.volume": envelope(1, [1]) }));
    expect(getStored(game, Muted)).toBe(false);
    expect(getStored(game, Volume)).toBe(0.8);
  });

  it("migrates older versions and values the game stored itself, and writes them back", async () => {
    const backend = memoryStorage({ "test.best": envelope(1, 40) });
    const game = await gameWith(backend);
    expect(getStored(game, Best)).toEqual({ score: 40, level: 1 });
    expect(backend.items.get("test.best")).toBe(envelope(2, { score: 40, level: 1 }));

    // A bare value from before the game used Fenrir is version 0.
    const legacy = memoryStorage({ "test.best": "75" });
    expect(getStored(await gameWith(legacy), Best)).toEqual({ score: 75, level: 1 });
    // So is a string that is not JSON, passed to migrate and parse as it is.
    const Name = defineStorageKey("test.name", { default: "", migrate: (v) => v });
    expect(getStored(await gameWith(memoryStorage({ "test.name": "ana" })), Name)).toBe("ana");
  });

  it("uses the default for a value from a newer version and leaves it stored", async () => {
    const logger = recordingLogger();
    const backend = memoryStorage({ "test.best": envelope(3, { score: 1, level: 1, stars: 2 }) });
    const game = await gameWith(backend, logger);
    expect(getStored(game, Best)).toEqual({ score: 0, level: 1 });
    expect(logger.warnings[0]).toMatch(/written by version 3, newer than this game's 2/);
    expect(backend.items.get("test.best")).toBe(envelope(3, { score: 1, level: 1, stars: 2 }));
  });

  it("updates and removes", async () => {
    const backend = memoryStorage();
    const game = await gameWith(backend);
    expect(updateStored(game, Best, (best) => ({ ...best, score: best.score + 5 }))).toEqual({ score: 5, level: 1 });
    expect(updateStored(game, Best, (best) => ({ ...best, score: best.score + 5 })).score).toBe(10);
    removeStored(game, Best);
    expect(backend.items.has("test.best")).toBe(false);
    expect(getStored(game, Best)).toEqual({ score: 0, level: 1 });
  });

  it("namespaces keys with a prefix, so two players or games on one origin do not collide", async () => {
    const backend = memoryStorage();
    const one = await gameWith(backend, undefined, "one:");
    const two = await gameWith(backend, undefined, "two:");
    setStored(one, Muted, true);
    expect(getStored(two, Muted)).toBe(false);
    expect([...backend.items.keys()]).toEqual(["one:test.muted"]);
  });

  it("keeps a write that the backend refuses in memory, with one warning per key", async () => {
    const logger = recordingLogger();
    const backend = memoryStorage();
    backend.setItem = () => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    };
    const game = await gameWith(backend, logger);
    expect(setStored(game, Best, { score: 7, level: 2 })).toBe(false);
    expect(setStored(game, Best, { score: 8, level: 2 })).toBe(false);
    expect(getStored(game, Best)).toEqual({ score: 8, level: 2 });
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).toMatch(/"test.best": could not be saved/);
    expect(inspect(game).resources["fenrir.StorageStatus"]).toEqual({
      backend: "memory",
      persistent: true,
      lastError: { key: "test.best", message: expect.stringMatching(/could not be saved.*quota has been exceeded/) },
    });
  });

  it("never throws when the backend throws on read or remove", async () => {
    const backend: StorageBackend = {
      name: "broken",
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
      removeItem: () => {
        throw new Error("denied");
      },
    };
    const game = await gameWith(backend);
    expect(getStored(game, Volume)).toBe(0.8);
    expect(() => removeStored(game, Volume)).not.toThrow();
  });

  it("uses localStorage by default", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [storage()] });
    setStored(game, Muted, true);
    expect(localStorage.getItem("test.muted")).toBe(envelope(1, true));
    expect(localStorage.getItem("fenrir.storage.probe")).toBeNull();
    expect(game.resources.get(StorageStatus)).toEqual({ backend: "localStorage", persistent: true, lastError: null });
  });

  it("falls back to memory with one warning when localStorage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    const logger = recordingLogger();
    const game = await createTestGame({ seed: 1, logger, plugins: [storage()] });
    expect(setStored(game, Muted, true)).toBe(true);
    expect(getStored(game, Muted)).toBe(true);
    expect(logger.warnings).toEqual(["Storage: localStorage is unavailable; values last only this session"]);
    expect(inspect(game).resources["fenrir.StorageStatus"]).toMatchObject({ backend: "memory", persistent: false, lastError: { key: null } });
  });

  it("throws a clear error without the plugin", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    expect(() => getStored(game, Muted)).toThrow(/needs the storage\(\) plugin/);
  });

  it("keeps values across stop() and run()", async () => {
    const game = await gameWith();
    game.addSystem(Schedule.Init, function count(ctx) {
      updateStored(ctx, Volume, (v) => v + 0.1);
    });
    await game.start();
    await game.stop();
    await game.start();
    expect(getStored(game, Volume)).toBeCloseTo(1.0);
    await game.stop();
  });

  it("awaits an async backend's hydrate in PreInit, before the game's startup systems", async () => {
    const items = memoryStorage();
    let resolve!: () => void;
    const backend: StorageBackend = {
      ...items,
      name: "host",
      hydrate: () => new Promise<void>((r) => (resolve = () => {
        items.setItem("test.muted", envelope(1, true));
        r();
      })),
    };
    const game = await gameWith(backend);
    let seen: boolean | undefined;
    game.addSystem(Schedule.PreInit, function readSetting(ctx) {
      seen = getStored(ctx, Muted);
    });
    expect(inspect(game).schedule.preInit).toEqual(["fenrir.storage.preInit", "readSetting"]);
    const started = game.start();
    await Promise.resolve();
    expect(seen).toBeUndefined();
    resolve();
    await started;
    expect(seen).toBe(true);
    await game.stop();
  });

  it("carries on with memory when hydrate rejects", async () => {
    const logger = recordingLogger();
    const backend: StorageBackend = { ...memoryStorage(), name: "host", hydrate: () => Promise.reject(new Error("bridge gone")) };
    const game = await gameWith(backend, logger);
    await game.start();
    expect(setStored(game, Muted, true)).toBe(true);
    expect(game.resources.get(StorageStatus)).toMatchObject({ backend: "memory", persistent: false });
    expect(logger.warnings[0]).toMatch(/host failed to load; values last only this session/);
    await game.stop();
  });

  it("rejects a version that is not a whole number above 0", () => {
    expect(() => defineStorageKey("test.bad", { default: 1, version: 0 })).toThrow(/whole number, 1 or more/);
  });

  describe("writeMigrated: false", () => {
    const LazyBest = defineStorageKey<Best>("test.best", {
      default: { score: 0, level: 1 },
      version: 2,
      parse: (v) => (isRecord(v) && typeof v.score === "number" && typeof v.level === "number" ? { score: v.score, level: v.level } : undefined),
      migrate: (v, from) => (from < 2 && typeof v === "number" ? { score: v, level: 1 } : v),
      writeMigrated: false,
    });

    it("keeps the migrated value in memory and the old one stored until the game writes", async () => {
      const backend = memoryStorage({ "test.best": envelope(1, 40) });
      const game = await gameWith(backend);
      expect(getStored(game, LazyBest)).toEqual({ score: 40, level: 1 });
      // The regression: an eager key has already overwritten version 1 here, so an older build could no longer read it.
      expect(backend.items.get("test.best")).toBe(envelope(1, 40));
      expect(updateStored(game, LazyBest, (best) => ({ ...best, score: best.score + 1 }))).toEqual({ score: 41, level: 1 });
      expect(backend.items.get("test.best")).toBe(envelope(2, { score: 41, level: 1 }));
    });

    it("migrates again in each session until then", async () => {
      const backend = memoryStorage({ "test.best": "75" });
      expect(getStored(await gameWith(backend), LazyBest)).toEqual({ score: 75, level: 1 });
      expect(getStored(await gameWith(backend), LazyBest)).toEqual({ score: 75, level: 1 });
      expect(backend.items.get("test.best")).toBe("75");
    });

    it("is off by default, and only set on keys that ask for it", () => {
      expect(Best).not.toHaveProperty("writeMigrated");
      expect(LazyBest.writeMigrated).toBe(false);
      expect(defineStorageKey("test.eager", { default: 0, writeMigrated: true })).not.toHaveProperty("writeMigrated");
    });
  });
});

describe("defineStorageKeyFamily", () => {
  const BestTime = defineStorageKeyFamily("test.bestTime.", { default: 0 });

  it("makes one key per suffix, named prefix + suffix, the same object each time", async () => {
    const backend = memoryStorage();
    const game = await gameWith(backend);
    expect(BestTime("reef")).toBe(BestTime("reef"));
    expect(BestTime("reef")).not.toBe(BestTime("deep"));
    expect(BestTime("reef").name).toBe("test.bestTime.reef");
    expect(BestTime.prefix).toBe("test.bestTime.");
    setStored(game, BestTime("reef"), 42.5);
    expect(getStored(game, BestTime("deep"))).toBe(0);
    expect([...backend.items]).toEqual([["test.bestTime.reef", envelope(1, 42.5)]]);
  });

  it("shares parse, version and migrate across the family", async () => {
    const Scores = defineStorageKeyFamily<number[]>("test.scores.", {
      default: [],
      version: 2,
      parse: (v) => (Array.isArray(v) && v.every((n) => typeof n === "number") ? v : undefined),
      migrate: (v, from) => (from < 2 && typeof v === "number" ? [v] : v),
    });
    const game = await gameWith(memoryStorage({ "test.scores.a": envelope(1, 3), "test.scores.b": envelope(2, ["x"]) }));
    expect(getStored(game, Scores("a"))).toEqual([3]);
    expect(getStored(game, Scores("b"))).toEqual([]);
  });

  it("is a key like any other: two families with one prefix share values, as keys with one name do", async () => {
    const game = await gameWith();
    setStored(game, BestTime("reef"), 9);
    expect(getStored(game, defineStorageKey("test.bestTime.reef", { default: 0 }))).toBe(9);
  });

  it("checks options when defined and suffixes when used", () => {
    expect(() => defineStorageKeyFamily("test.bad.", { default: 1, version: 1.5 })).toThrow(/whole number, 1 or more/);
    expect(() => BestTime("")).toThrow(/defineStorageKeyFamily\("test.bestTime."\): a key needs a suffix, a non-empty string, got ""/);
  });
});

describe("persistResource", () => {
  type Settings = { muted: boolean; volume: number; seen: string[] };
  const Settings = defineResource<Settings>("test.Settings", () => ({ muted: false, volume: 1, seen: [] }));
  const MutedKey = defineStorageKey("test.settings.muted", { default: false });
  const SeenKey = defineStorageKey<string[]>("test.settings.seen", { default: [] });

  it("loads the field at once and saves it at the end of the frame it changed in", async () => {
    const backend = memoryStorage({ "test.settings.muted": envelope(1, true) });
    const game = await gameWith(backend);
    persistResource(game, Settings, "muted", MutedKey);
    expect(game.resources.get(Settings).muted).toBe(true);
    game.addSystem(Schedule.Update, function unmute({ resources }) {
      resources.get(Settings).muted = false;
    });
    await game.start();
    expect(inspect(game).schedule.postUpdate).toEqual(["fenrir.storage.postUpdate"]);
    game.step();
    expect(backend.items.get("test.settings.muted")).toBe(envelope(1, false));
    await game.stop();
  });

  it("writes only when the value changed, and sees an object edited in place", async () => {
    const backend = memoryStorage();
    const setItem = vi.spyOn(backend, "setItem");
    const game = await gameWith(backend);
    persistResource(game, Settings, "seen", SeenKey);
    await game.start();
    game.step(1 / 60, 3);
    expect(setItem).not.toHaveBeenCalled();
    game.resources.get(Settings).seen.push("intro");
    game.step(1 / 60, 3);
    expect(setItem).toHaveBeenCalledOnce();
    expect(backend.items.get("test.settings.seen")).toBe(envelope(1, ["intro"]));
    await game.stop();
  });

  it("saves a change made after the last frame when the run stops", async () => {
    const backend = memoryStorage();
    const game = await gameWith(backend);
    persistResource(game, Settings, "muted", MutedKey);
    await game.start();
    game.resources.get(Settings).muted = true;
    await game.stop();
    expect(backend.items.get("test.settings.muted")).toBe(envelope(1, true));
  });

  it("loads after a backend hydrates, before the game's startup systems", async () => {
    const items = memoryStorage();
    const backend: StorageBackend = {
      ...items,
      name: "host",
      hydrate: async () => items.setItem("test.settings.muted", envelope(1, true)),
    };
    const game = await gameWith(backend);
    persistResource(game, Settings, "muted", MutedKey);
    // Not yet: the store is empty until hydrate, so loading now would read the default.
    expect(game.resources.get(Settings).muted).toBe(false);
    let seen: boolean | undefined;
    game.addSystem(Schedule.PreInit, function readSetting({ resources }) {
      seen = resources.get(Settings).muted;
    });
    await game.start();
    expect(seen).toBe(true);
    await game.stop();
  });

  it("keeps AudioState.muted across sessions, with audio installed after storage", async () => {
    const backend = memoryStorage();
    const Muted = defineStorageKey("test.muted", { default: false });
    const first = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [storage({ backend }), audio({ backend: testAudio() })] });
    persistResource(first, AudioState, "muted", Muted);
    await first.start();
    first.resources.get(AudioState).muted = true;
    first.step();
    await first.stop();

    const second = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [storage({ backend }), audio({ backend: testAudio() })] });
    persistResource(second, AudioState, "muted", Muted);
    expect(second.resources.get(AudioState).muted).toBe(true);
  });

  it("stops saving once the returned function is called", async () => {
    const backend = memoryStorage();
    const game = await gameWith(backend);
    const unbind = persistResource(game, Settings, "muted", MutedKey);
    await game.start();
    unbind();
    game.resources.get(Settings).muted = true;
    game.step();
    expect(backend.items.size).toBe(0);
    await game.stop();
  });

  it("persists nothing by default", async () => {
    const backend = memoryStorage();
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [storage({ backend }), audio({ backend: testAudio() })] });
    expect(inspect(game).schedule.postUpdate).toEqual(["fenrir.audio.postUpdate"]);
    await game.start();
    game.resources.get(AudioState).muted = true;
    game.step();
    await game.stop();
    expect(backend.items.size).toBe(0);
  });

  it("throws without storage, without the resource, and for a key bound twice", async () => {
    const plain = await createTestGame({ seed: 1, logger: new NullLogger() });
    expect(() => persistResource(plain, Settings, "muted", MutedKey)).toThrow(/needs the storage\(\) plugin/);
    const game = await gameWith();
    // AudioState comes from the audio() plugin, which this game does not have.
    expect(() => persistResource(game, AudioState, "muted", MutedKey)).toThrow(
      /persistResource\(fenrir.AudioState.muted\): the resource has no value. Install the plugin that adds it/,
    );
    persistResource(game, Settings, "muted", MutedKey);
    expect(() => persistResource(game, Settings, "muted", MutedKey)).toThrow(/storage key "test.settings.muted" is already bound/);
    // @ts-expect-error the key's type must match the field's
    expect(() => persistResource(game, Settings, "volume", MutedKey)).toThrow(/already bound/);
  });
});

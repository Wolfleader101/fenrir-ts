import { afterEach, describe, expect, it, vi } from "vitest";
import type { Texture } from "pixi.js";
import {
  AssetBundleError,
  AssetBundleFailed,
  AssetBundleLoaded,
  AssetFailed,
  AssetLoaded,
  AssetLoadError,
  defineAssets,
  getAsset,
  loadAsset,
  loadAssets,
  setAssetLoader,
  unloadAsset,
  unloadAssets,
  type ManifestLoader,
} from "@/core/Assets/Manifest";
import { NullLogger } from "@/core/NullLogger";
import { Schedule } from "@/core/Scheduler";
import { createTestGame, type TestGame } from "@/core/TestGame";
import type { SystemCtx } from "@/core/SystemCtx";
import "@/core/Assets/Assets2D";
import { inspect } from "@/core/Inspect";

/** A stand-in texture: the manifest only passes values through. */
const texture = (label: string) => ({ label }) as unknown as Texture;

/** A loader a test drives: each asset resolves or fails only when the test says so. */
function fakeLoader() {
  const pending = new Map<string, { resolve(value: unknown): void; reject(error: unknown): void }>();
  const calls: string[] = [];
  const unloaded: string[] = [];
  const loader: ManifestLoader = {
    load: ({ name }) => {
      calls.push(name);
      return new Promise((resolve, reject) => pending.set(name, { resolve, reject }));
    },
    unload: ({ name }) => void unloaded.push(name),
  };
  const take = (name: string) => {
    const entry = pending.get(name);
    if (!entry) throw new Error(`"${name}" is not loading`);
    pending.delete(name);
    return entry;
  };
  return {
    loader,
    calls,
    unloaded,
    pending: () => [...pending.keys()],
    async resolve(name: string, value: unknown = texture(name)) {
      take(name).resolve(value);
      await settle();
    },
    async reject(name: string, error: unknown = new Error("404 Not Found")) {
      take(name).reject(error);
      await settle();
    },
  };
}

/** Lets every queued promise callback run. */
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const GameAssets = defineAssets("test.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
    rock: { kind: "texture2d", src: "img/rock.png" },
    cave: { kind: "texture2d", src: "img/cave.png" },
  },
  bundles: {
    boot: ["logo", "rock"],
    reef: ["reef", "logo"],
    cave: ["cave", "rock"],
  },
});

class RecordingLogger extends NullLogger {
  readonly errors: string[] = [];
  readonly warnings: string[] = [];
  override error(message: string): void {
    this.errors.push(message);
  }
  override warn(message: string): void {
    this.warnings.push(message);
  }
}

async function setUp(): Promise<{ game: TestGame; fake: ReturnType<typeof fakeLoader>; logger: RecordingLogger }> {
  const logger = new RecordingLogger();
  const game = await createTestGame({ seed: 1, logger });
  const fake = fakeLoader();
  setAssetLoader(game, fake.loader);
  return { game, fake, logger };
}

const progressOf = (game: TestGame) => game.resources.get(GameAssets.progress);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("defineAssets", () => {
  it("keeps the declaration as plain data", () => {
    expect(GameAssets.name).toBe("test.assets");
    expect(GameAssets.bundles.reef).toEqual(["reef", "logo"]);
    expect(JSON.parse(JSON.stringify(GameAssets))).toEqual({
      name: "test.assets",
      assets: GameAssets.assets,
      bundles: GameAssets.bundles,
      progress: { name: "test.assets" },
    });
  });

  it("rejects a manifest whose bundles or fallbacks name no asset, or that loads one source twice", () => {
    const define = (manifest: unknown) => () => defineAssets("test.bad", manifest as Parameters<typeof defineAssets>[1]);
    expect(define({ assets: { a: { kind: "texture2d", src: "a.png" } }, bundles: { boot: ["a", "b"] } })).toThrow(
      'defineAssets("test.bad"): bundle "boot" lists "b", which is not an asset.',
    );
    expect(define({ assets: { a: { kind: "texture2d", src: "a.png", fallback: "b" } }, bundles: {} })).toThrow(
      'the fallback of "a" must be another texture2d asset with no fallback of its own; "b" is not',
    );
    expect(define({
      assets: { a: { kind: "texture2d", src: "a.png", fallback: "b" }, b: { kind: "texture2d", src: "b.png", fallback: "a" } },
      bundles: {},
    })).toThrow('the fallback of "a" must be another texture2d asset');
    expect(define({
      assets: { a: { kind: "texture2d", src: "a.png" }, b: { kind: "model", src: "b.glb" }, c: { kind: "texture2d", src: "c.png", fallback: "b" } },
      bundles: {},
    })).toThrow('the fallback of "c" must be another texture2d asset');
    expect(define({ assets: { a: { kind: "texture2d", src: "a.png" }, b: { kind: "texture2d", src: "a.png" } }, bundles: {} })).toThrow(
      '"a" and "b" both load texture2d from "a.png". Declare it once.',
    );
  });
});

describe("loading a bundle", () => {
  it("steps progress through each asset, then sends AssetBundleLoaded and resolves", async () => {
    const { game, fake } = await setUp();
    const loadedEvents: unknown[] = [];
    game.on(AssetBundleLoaded, (payload) => void loadedEvents.push(payload));
    await game.start();

    let done = false;
    const loading = loadAssets(game, GameAssets, "boot").then(() => (done = true));
    expect(progressOf(game).bundles.boot).toEqual({ status: "loading", loaded: 0, missing: 0, failed: 0, total: 2, fraction: 0 });
    expect(progressOf(game).assets.logo).toEqual({ status: "loading", error: null, bundles: ["boot"], direct: false });
    expect(progressOf(game).assets.reef.status).toBe("unloaded");
    await settle();
    expect(fake.pending()).toEqual(["logo", "rock"]);

    await fake.resolve("rock");
    expect(progressOf(game)).toMatchObject({ loaded: 1, total: 2, fraction: 0.5 });
    expect(progressOf(game).bundles.boot).toMatchObject({ status: "loading", loaded: 1, fraction: 0.5 });
    expect(progressOf(game).assets.rock.status).toBe("loaded");
    expect(done).toBe(false);

    await fake.resolve("logo");
    await loading;
    expect(progressOf(game).bundles.boot).toEqual({ status: "loaded", loaded: 2, missing: 0, failed: 0, total: 2, fraction: 1 });
    expect(loadedEvents).toEqual([{ manifest: "test.assets", bundle: "boot", fallbacks: [], missing: [] }]);
    expect(getAsset(game, GameAssets, "logo")).toEqual(texture("logo"));
    await game.stop();
  });

  it("de-duplicates a second request: one load per asset and the same promise", async () => {
    const { game, fake } = await setUp();
    const first = loadAssets(game, GameAssets, "boot");
    const second = loadAssets(game, GameAssets, "boot");
    const both = loadAssets(game, GameAssets, ["boot", "boot"]);
    await settle();
    expect(fake.calls).toEqual(["logo", "rock"]);
    await fake.resolve("logo");
    await fake.resolve("rock");
    await Promise.all([first, second, both]);
    await loadAssets(game, GameAssets, "boot");
    expect(fake.calls).toEqual(["logo", "rock"]);
  });

  it("loads an asset shared by two bundles once, and counts it in both", async () => {
    const { game, fake } = await setUp();
    const boot = loadAssets(game, GameAssets, "boot");
    const reef = loadAssets(game, GameAssets, "reef");
    await settle();
    expect(fake.calls).toEqual(["logo", "rock", "reef", "missing"]);
    await fake.resolve("logo");
    expect(progressOf(game).bundles.boot.loaded).toBe(1);
    expect(progressOf(game).bundles.reef.loaded).toBe(1);
    expect(progressOf(game).assets.logo.bundles).toEqual(["boot", "reef"]);
    // Four distinct assets: logo, rock, and reef with its fallback.
    expect(progressOf(game)).toMatchObject({ loaded: 1, total: 4 });
    for (const name of ["rock", "reef", "missing"]) await fake.resolve(name);
    await Promise.all([boot, reef]);
    expect(progressOf(game)).toMatchObject({ loaded: 4, total: 4, fraction: 1 });
  });

  it("puts each asset in the game's asset store under its name, where the 2D getters find it", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "boot");
    await settle();
    await fake.resolve("logo");
    await fake.resolve("rock");
    await loading;
    await expect(game.assets.getTexture2D("logo")).resolves.toEqual(texture("logo"));
    expect(game.assets.kindOf("logo")).toBe("texture2d");
  });

  it("can be awaited in a PreInit system, so start() and run() wait for it", async () => {
    const { game, fake } = await setUp();
    const seen: string[] = [];
    game
      .addSystem(Schedule.PreInit, async function loadBoot(ctx) {
        await loadAssets(ctx, GameAssets, "boot");
      })
      .addSystem(Schedule.Init, function spawn(ctx) {
        seen.push(getAsset(ctx, GameAssets, "logo") === texture("logo") ? "same" : "loaded");
      });
    let started = false;
    const starting = game.start().then(() => (started = true));
    await settle();
    expect(started).toBe(false);
    await fake.resolve("logo");
    await fake.resolve("rock");
    await starting;
    expect(seen).toEqual(["loaded"]);
    await game.stop();
  });

  it("rolls startup back when a bundle awaited in PreInit fails", async () => {
    const { game, fake } = await setUp();
    game.addSystem(Schedule.PreInit, async function loadBoot(ctx) {
      await loadAssets(ctx, GameAssets, "boot");
    });
    const starting = game.start().catch((error: unknown) => error);
    await settle();
    await fake.resolve("logo");
    await fake.reject("rock");
    expect(await starting).toBeInstanceOf(AssetBundleError);
    expect(await starting).toHaveProperty("message", 'Bundle "boot" of test.assets failed: asset "rock" from "img/rock.png": 404 Not Found');
    expect(game.isRunning()).toBe(false);
  });

  it("is reachable from a sync system through ctx.assets, the game's own store", async () => {
    const { game, fake } = await setUp();
    let assets: unknown;
    game.addSystem(Schedule.Update, function loadCave(ctx: SystemCtx) {
      assets = ctx.assets;
      void loadAssets(ctx, GameAssets, "cave");
    });
    await game.start();
    game.step();
    expect(assets).toBe(game.assets);
    await settle();
    expect(fake.pending()).toEqual(["cave", "rock"]);
    await game.stop();
  });

  it("throws at the call for a bundle the manifest does not have", async () => {
    const { game } = await setUp();
    expect(() => loadAssets(game, GameAssets, "sea" as "boot")).toThrow(
      'loadAssets: test.assets has no bundle "sea". Its bundles: boot, reef, cave.',
    );
  });
});

describe("failures", () => {
  it("tries every asset, then fails the bundle with an error naming each asset, bundle and source", async () => {
    const { game, fake, logger } = await setUp();
    const failedEvents: unknown[] = [];
    game.on(AssetBundleFailed, (payload) => void failedEvents.push(payload));
    await game.start();

    const loading = loadAssets(game, GameAssets, "boot");
    await settle();
    await fake.reject("logo", new Error("network down"));
    expect(progressOf(game).bundles.boot).toMatchObject({ status: "loading", failed: 1, loaded: 0 });
    await fake.resolve("rock");

    const error = await loading.catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(AssetBundleError);
    expect(error).toMatchObject({
      message: 'Bundle "boot" of test.assets failed: asset "logo" from "img/logo.png": network down',
      manifest: "test.assets",
      bundle: "boot",
      failures: [{ asset: "logo", src: "img/logo.png", error: "network down" }],
      cause: new Error("network down"),
    });
    expect(failedEvents).toEqual([{ manifest: "test.assets", bundle: "boot", failures: [{ asset: "logo", src: "img/logo.png", error: "network down" }] }]);
    expect(logger.errors).toEqual([(error as Error).message]);
    expect(progressOf(game).bundles.boot).toEqual({ status: "failed", loaded: 1, missing: 0, failed: 1, total: 2, fraction: 0.5 });
    expect(progressOf(game).assets.logo).toEqual({ status: "failed", error: "network down", bundles: ["boot"], direct: false });
    // The asset that loaded stays loaded; the failed one says why.
    expect(getAsset(game, GameAssets, "rock")).toEqual(texture("rock"));
    expect(() => getAsset(game, GameAssets, "logo")).toThrow('getAsset: "logo" of test.assets is failed: network down');
    await game.stop();
  });

  it("retries only the failed assets when the bundle is requested again", async () => {
    const { game, fake } = await setUp();
    const first = loadAssets(game, GameAssets, "boot");
    await settle();
    await fake.reject("logo");
    await fake.resolve("rock");
    await expect(first).rejects.toThrow(AssetBundleError);

    const retry = loadAssets(game, GameAssets, "boot");
    expect(progressOf(game).bundles.boot).toMatchObject({ status: "loading", loaded: 1, failed: 0 });
    await settle();
    expect(fake.calls).toEqual(["logo", "rock", "logo"]);
    await fake.resolve("logo");
    await retry;
    expect(progressOf(game).bundles.boot.status).toBe("loaded");
  });

  it("shows the declared fallback in place of an asset that fails, and the bundle loads", async () => {
    const { game, fake, logger } = await setUp();
    const loadedEvents: unknown[] = [];
    game.on(AssetBundleLoaded, (payload) => void loadedEvents.push(payload));
    await game.start();

    const loading = loadAssets(game, GameAssets, "reef");
    await settle();
    expect(fake.pending()).toEqual(["reef", "missing", "logo"]);
    await fake.reject("reef");
    // The fallback is not ready yet, so the asset is still loading.
    expect(progressOf(game).assets.reef.status).toBe("loading");
    await fake.resolve("missing");
    await fake.resolve("logo");
    await loading;

    expect(getAsset(game, GameAssets, "reef")).toEqual(texture("missing"));
    await expect(game.assets.getTexture2D("reef")).resolves.toEqual(texture("missing"));
    expect(progressOf(game).assets.reef).toEqual({ status: "fallback", error: "404 Not Found", bundles: ["reef"], direct: false });
    expect(progressOf(game).bundles.reef).toEqual({ status: "loaded", loaded: 3, missing: 0, failed: 0, total: 3, fraction: 1 });
    expect(loadedEvents).toEqual([{ manifest: "test.assets", bundle: "reef", fallbacks: ["reef"], missing: [] }]);
    expect(logger.warnings).toEqual(['Asset "reef" of test.assets failed to load from "img/reef.webp"; showing "missing"']);
    await game.stop();
  });

  it("fails the asset with its own error when its fallback fails too", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "reef");
    await settle();
    await fake.reject("missing", new Error("placeholder gone"));
    await fake.reject("reef", new Error("reef gone"));
    await fake.resolve("logo");
    await expect(loading).rejects.toMatchObject({
      failures: [
        { asset: "reef", src: "img/reef.webp", error: "reef gone" },
        { asset: "missing", src: "img/missing.png", error: "placeholder gone" },
      ],
    });
  });

  it("fails an asset whose kind has no loader for its extension, naming the supported ones", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    const Odd = defineAssets("test.odd", { assets: { sheet: { kind: "texture2d", src: "sheet.tga" } }, bundles: { boot: ["sheet"] } });
    await expect(loadAssets(game, Odd, "boot")).rejects.toThrow(
      'asset "sheet" from "sheet.tga": Unsupported texture2d format: .tga. Supported extensions: bmp, gif, jpeg, jpg, png, webp',
    );
  });
});

describe("unloading", () => {
  async function loadAll(game: TestGame, fake: ReturnType<typeof fakeLoader>, bundles: ("boot" | "reef" | "cave")[]) {
    const loading = loadAssets(game, GameAssets, bundles);
    await settle();
    for (const name of fake.pending()) await fake.resolve(name);
    await loading;
  }

  it("keeps an asset shared with a loaded bundle until the last bundle holding it is unloaded", async () => {
    const { game, fake } = await setUp();
    await loadAll(game, fake, ["boot", "reef"]);

    unloadAssets(game, GameAssets, "reef");
    await settle();
    expect(fake.unloaded.sort()).toEqual(["missing", "reef"]);
    expect(getAsset(game, GameAssets, "logo")).toEqual(texture("logo"));
    expect(() => getAsset(game, GameAssets, "reef")).toThrow('getAsset: "reef" of test.assets is not loaded. Load a bundle that lists it (reef) or call loadAsset.');
    await expect(game.assets.getTexture2D("reef")).rejects.toThrow("Asset not loaded: reef");
    expect(progressOf(game).bundles.reef.status).toBe("unloaded");
    expect(progressOf(game).assets.logo.bundles).toEqual(["boot"]);
    expect(progressOf(game)).toMatchObject({ loaded: 2, total: 2 });

    unloadAssets(game, GameAssets, "boot");
    await settle();
    expect(fake.unloaded.sort()).toEqual(["logo", "missing", "reef", "rock"]);
    expect(progressOf(game)).toMatchObject({ loaded: 0, total: 0, fraction: 1 });
    expect(() => getAsset(game, GameAssets, "logo")).toThrow("not loaded");
  });

  it("loads the bundle again after an unload, and unloading twice is a no-op", async () => {
    const { game, fake } = await setUp();
    await loadAll(game, fake, ["cave"]);
    unloadAssets(game, GameAssets, "cave");
    unloadAssets(game, GameAssets, "cave");
    await loadAll(game, fake, ["cave"]);
    expect(fake.calls).toEqual(["cave", "rock", "cave", "rock"]);
    expect(getAsset(game, GameAssets, "cave")).toEqual(texture("cave"));
  });

  it("does not unload the fallback's value through the asset that showed it", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "reef");
    await settle();
    await fake.reject("reef");
    await fake.resolve("missing");
    await fake.resolve("logo");
    await loading;
    unloadAssets(game, GameAssets, "reef");
    await settle();
    // reef never loaded, so only the two values that did are freed, once each.
    expect(fake.unloaded.sort()).toEqual(["logo", "missing"]);
  });

  it("unloads a bundle that is still loading: its promise rejects and late assets are freed", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "cave");
    await settle();
    await fake.resolve("rock");
    unloadAssets(game, GameAssets, "cave");
    await fake.resolve("cave");
    await expect(loading).rejects.toThrow('Bundle "cave" of test.assets was unloaded before it finished loading.');
    expect(fake.unloaded.sort()).toEqual(["cave", "rock"]);
    expect(progressOf(game).bundles.cave.status).toBe("unloaded");
  });

  it("runs the store loader's unload for the assets it loaded", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    const unload = vi.fn();
    const sheet = texture("sheet");
    game.assets.registerTexture2DLoader("test-sheet", { loader: async () => sheet, extensions: ["sheet"], unload });
    const Sheets = defineAssets("test.sheets", { assets: { hud: { kind: "texture2d", src: "hud.sheet" } }, bundles: { hud: ["hud"] } });
    await loadAssets(game, Sheets, "hud");
    expect(getAsset(game, Sheets, "hud")).toBe(sheet);
    unloadAssets(game, Sheets, "hud");
    await settle();
    expect(unload).toHaveBeenCalledExactlyOnceWith(sheet, { url: "hud.sheet" });
  });
});

describe("lifetime and inspection", () => {
  it("keeps loaded bundles and their progress across stop() and start()", async () => {
    const { game, fake } = await setUp();
    await game.start();
    const loading = loadAssets(game, GameAssets, "boot");
    await settle();
    await fake.resolve("logo");
    await game.stop();
    // A load in flight at stop finishes; it is not tied to the run.
    await fake.resolve("rock");
    await loading;

    await game.start();
    expect(getAsset(game, GameAssets, "rock")).toEqual(texture("rock"));
    expect(progressOf(game).bundles.boot.status).toBe("loaded");
    await loadAssets(game, GameAssets, "boot");
    expect(fake.calls).toEqual(["logo", "rock"]);
    await game.stop();
  });

  it("treats assets.clear() as an unload of everything it held: the bundle loads again", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "cave");
    await settle();
    await fake.resolve("cave");
    await fake.resolve("rock");
    await loading;
    game.assets.clear();
    expect(() => getAsset(game, GameAssets, "cave")).toThrow("not loaded");
    unloadAssets(game, GameAssets, "cave");
    void loadAssets(game, GameAssets, "cave");
    await settle();
    expect(fake.pending()).toEqual(["cave", "rock"]);
  });

  it("shows progress in inspect() as plain JSON under the manifest's name", async () => {
    const { game, fake } = await setUp();
    expect(inspect(game).resources["test.assets"]).toBeUndefined();
    const loading = loadAssets(game, GameAssets, "reef");
    await settle();
    await fake.reject("reef");
    await fake.resolve("missing");
    await fake.resolve("logo");
    await loading;

    const snapshot = inspect(game).resources["test.assets"];
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot).toEqual({
      loaded: 3,
      missing: 0,
      failed: 0,
      total: 3,
      fraction: 1,
      bundles: {
        boot: { status: "unloaded", loaded: 0, missing: 0, failed: 0, total: 0, fraction: 1 },
        reef: { status: "loaded", loaded: 3, missing: 0, failed: 0, total: 3, fraction: 1 },
        cave: { status: "unloaded", loaded: 0, missing: 0, failed: 0, total: 0, fraction: 1 },
      },
      assets: {
        logo: { status: "loaded", error: null, bundles: ["reef"], direct: false },
        missing: { status: "loaded", error: null, bundles: ["reef"], direct: false },
        reef: { status: "fallback", error: "404 Not Found", bundles: ["reef"], direct: false },
        rock: { status: "unloaded", error: null, bundles: [], direct: false },
        cave: { status: "unloaded", error: null, bundles: [], direct: false },
      },
    });
  });

  it("keeps two games apart", async () => {
    const a = await setUp();
    const b = await setUp();
    const loading = loadAssets(a.game, GameAssets, "cave");
    await settle();
    expect(b.fake.calls).toEqual([]);
    expect(progressOf(b.game).bundles.cave.status).toBe("unloaded");
    for (const name of a.fake.pending()) await a.fake.resolve(name);
    await loading;
    expect(() => getAsset(b.game, GameAssets, "cave")).toThrow("not loaded");
  });

  it("refuses an asset name another manifest loaded from a different source", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, GameAssets, "cave");
    const Other = defineAssets("test.other", { assets: { cave: { kind: "texture2d", src: "img/other-cave.png" } }, bundles: { all: ["cave"] } });
    expect(() => loadAssets(game, Other, "all")).toThrow(
      'loadAssets: "cave" of test.other is texture2d from "img/other-cave.png", but "cave" is already loaded as texture2d from "img/cave.png". Rename one.',
    );
    await settle();
    for (const name of fake.pending()) await fake.resolve(name);
    await loading;
  });
});

describe("loading one asset by name", () => {
  it("loads an asset with no bundle: progress, AssetLoaded and getAsset, and no bundle entry", async () => {
    const { game, fake } = await setUp();
    const loaded: unknown[] = [];
    game.on(AssetLoaded, (payload) => void loaded.push(payload));
    await game.start();

    const loading = loadAsset(game, GameAssets, "cave");
    expect(progressOf(game).assets.cave).toEqual({ status: "loading", error: null, bundles: [], direct: true });
    expect(progressOf(game)).toMatchObject({ loaded: 0, total: 1, fraction: 0 });
    await settle();
    expect(fake.calls).toEqual(["cave"]);
    await fake.resolve("cave");
    await loading;

    expect(getAsset(game, GameAssets, "cave")).toEqual(texture("cave"));
    expect(progressOf(game).assets.cave).toEqual({ status: "loaded", error: null, bundles: [], direct: true });
    expect(progressOf(game)).toMatchObject({ loaded: 1, total: 1, fraction: 1 });
    // No bundle was loaded, so none says it was.
    expect(Object.values(progressOf(game).bundles).map((b) => b.status)).toEqual(["unloaded", "unloaded", "unloaded"]);
    expect(loaded).toEqual([{ manifest: "test.assets", asset: "cave", status: "loaded" }]);
    await expect(game.assets.getTexture2D("cave")).resolves.toEqual(texture("cave"));
    await game.stop();
  });

  it("de-duplicates repeated requests and shares the load with a bundle that lists the asset", async () => {
    const { game, fake } = await setUp();
    const first = loadAsset(game, GameAssets, "logo");
    const second = loadAsset(game, GameAssets, ["logo", "logo"]);
    const boot = loadAssets(game, GameAssets, "boot");
    await settle();
    expect(fake.calls).toEqual(["logo", "rock"]);
    await fake.resolve("logo");
    await fake.resolve("rock");
    await Promise.all([first, second, boot]);
    expect(progressOf(game).assets.logo).toMatchObject({ bundles: ["boot"], direct: true });

    // The bundle's unload leaves the asset held by name; the by-name unload then releases it.
    unloadAssets(game, GameAssets, "boot");
    await settle();
    expect(fake.unloaded).toEqual(["rock"]);
    expect(getAsset(game, GameAssets, "logo")).toEqual(texture("logo"));
    unloadAsset(game, GameAssets, "logo");
    await settle();
    expect(fake.unloaded).toEqual(["rock", "logo"]);
    expect(progressOf(game).assets.logo).toEqual({ status: "unloaded", error: null, bundles: [], direct: false });
    expect(() => getAsset(game, GameAssets, "logo")).toThrow("not loaded");
    // Unloading again, or a name never loaded, is a no-op.
    unloadAsset(game, GameAssets, ["logo", "cave"]);
  });

  it("keeps an asset a bundle still holds when its by-name hold is dropped", async () => {
    const { game, fake } = await setUp();
    const loading = Promise.all([loadAsset(game, GameAssets, "rock"), loadAssets(game, GameAssets, "cave")]);
    await settle();
    for (const name of fake.pending()) await fake.resolve(name);
    await loading;
    unloadAsset(game, GameAssets, "rock");
    await settle();
    expect(fake.unloaded).toEqual([]);
    expect(progressOf(game).assets.rock).toMatchObject({ status: "loaded", bundles: ["cave"], direct: false });
  });

  it("loads the asset's fallback with it, and reports the fallback", async () => {
    const { game, fake, logger } = await setUp();
    const loaded: unknown[] = [];
    game.on(AssetLoaded, (payload) => void loaded.push(payload));
    await game.start();
    const loading = loadAsset(game, GameAssets, "reef");
    await settle();
    expect(fake.pending()).toEqual(["reef", "missing"]);
    await fake.reject("reef");
    await fake.resolve("missing");
    await loading;
    expect(getAsset(game, GameAssets, "reef")).toEqual(texture("missing"));
    expect(loaded).toEqual([{ manifest: "test.assets", asset: "reef", status: "fallback" }]);
    expect(logger.warnings).toHaveLength(1);
    expect(progressOf(game)).toMatchObject({ loaded: 2, total: 2 });
    await game.stop();
  });

  it("fails with AssetLoadError and AssetFailed, logged as an error, then retries on the next call", async () => {
    const { game, fake, logger } = await setUp();
    const failed: unknown[] = [];
    game.on(AssetFailed, (payload) => void failed.push(payload));
    await game.start();

    const loading = loadAsset(game, GameAssets, "cave");
    await settle();
    await fake.reject("cave", new Error("network down"));
    const error = await loading.catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(AssetLoadError);
    expect(error).toMatchObject({
      message: 'Asset "cave" of test.assets failed to load from "img/cave.png": network down',
      manifest: "test.assets",
      asset: "cave",
      src: "img/cave.png",
      cause: new Error("network down"),
    });
    expect(failed).toEqual([{ manifest: "test.assets", asset: "cave", src: "img/cave.png", error: "network down" }]);
    expect(logger.errors).toEqual([(error as Error).message]);
    expect(progressOf(game).assets.cave).toEqual({ status: "failed", error: "network down", bundles: [], direct: true });
    expect(progressOf(game)).toMatchObject({ loaded: 0, failed: 1, total: 1 });

    const retry = loadAsset(game, GameAssets, "cave");
    await settle();
    expect(fake.calls).toEqual(["cave", "cave"]);
    await fake.resolve("cave");
    await retry;
    expect(getAsset(game, GameAssets, "cave")).toEqual(texture("cave"));
    await game.stop();
  });

  it("rejects an asset still loading when it is unloaded, and frees it when it lands", async () => {
    const { game, fake } = await setUp();
    const loading = loadAsset(game, GameAssets, "cave");
    await settle();
    unloadAsset(game, GameAssets, "cave");
    await fake.resolve("cave");
    await expect(loading).rejects.toThrow('Asset "cave" of test.assets was unloaded before it finished loading.');
    expect(fake.unloaded).toEqual(["cave"]);
    expect(progressOf(game).assets.cave.status).toBe("unloaded");
  });

  it("throws at the call for a name the manifest does not have", async () => {
    const { game } = await setUp();
    expect(() => loadAsset(game, GameAssets, "boot" as never)).toThrow('loadAsset: test.assets has no asset "boot". Its assets: logo, missing, reef, rock, cave.');
    expect(() => unloadAsset(game, GameAssets, "boot" as never)).toThrow('unloadAsset: test.assets has no asset "boot".');
  });
});

describe("optional assets", () => {
  const Art = defineAssets("test.optionalArt", {
    assets: {
      hero: { kind: "texture2d", src: "img/hero.png" },
      glow: { kind: "texture2d", src: "img/glow.png", optional: true },
      blank: { kind: "texture2d", src: "img/blank.png" },
      shine: { kind: "texture2d", src: "img/shine.png", optional: true, fallback: "blank" },
    },
    bundles: { boot: ["hero", "glow"], shiny: ["shine"] },
  });
  const artOf = (game: TestGame) => game.resources.get(Art.progress);

  it("does not fail the bundle: the asset is missing, warned, counted as done, and getAsset returns undefined", async () => {
    const { game, fake, logger } = await setUp();
    const loaded: unknown[] = [];
    const failed: unknown[] = [];
    game.on(AssetBundleLoaded, (payload) => void loaded.push(payload));
    game.on(AssetBundleFailed, (payload) => void failed.push(payload));
    await game.start();

    const loading = loadAssets(game, Art, "boot");
    await settle();
    await fake.reject("glow");
    await fake.resolve("hero");
    await loading;

    expect(getAsset(game, Art, "glow")).toBeUndefined();
    expect(getAsset(game, Art, "hero")).toEqual(texture("hero"));
    expect(artOf(game).assets.glow).toEqual({ status: "missing", error: "404 Not Found", bundles: ["boot"], direct: false });
    expect(artOf(game).bundles.boot).toEqual({ status: "loaded", loaded: 1, missing: 1, failed: 0, total: 2, fraction: 1 });
    expect(artOf(game)).toMatchObject({ loaded: 1, missing: 1, failed: 0, fraction: 1 });
    expect(loaded).toEqual([{ manifest: "test.optionalArt", bundle: "boot", fallbacks: [], missing: ["glow"] }]);
    expect(failed).toEqual([]);
    expect(logger.errors).toEqual([]);
    expect(logger.warnings).toEqual(['Optional asset "glow" of test.optionalArt failed to load from "img/glow.png"; it is missing']);
    // The store's getter resolves with nothing rather than rejecting.
    await expect(game.assets.getTexture2D("glow")).resolves.toBeUndefined();
    await game.stop();
  });

  it("shows its fallback first, and is missing only when the fallback fails too", async () => {
    const { game, fake } = await setUp();
    const first = loadAssets(game, Art, "shiny");
    await settle();
    await fake.reject("shine");
    await fake.resolve("blank");
    await first;
    expect(getAsset(game, Art, "shine")).toEqual(texture("blank"));
    expect(artOf(game).assets.shine.status).toBe("fallback");

    unloadAssets(game, Art, "shiny");
    const second = loadAssets(game, Art, "shiny");
    await settle();
    await fake.reject("shine");
    await fake.reject("blank");
    // The bundle fails on `blank`, which is not optional; `shine` itself is only missing.
    await expect(second).rejects.toThrow('asset "blank" from "img/blank.png"');
    expect(artOf(game).assets.shine.status).toBe("missing");
    expect(getAsset(game, Art, "shine")).toBeUndefined();
  });

  it("counts a missing asset as settled: not loaded again until its bundle is unloaded and loaded", async () => {
    const { game, fake } = await setUp();
    const first = loadAssets(game, Art, "boot");
    await settle();
    await fake.reject("glow");
    await fake.resolve("hero");
    await first;
    await loadAssets(game, Art, "boot");
    expect(fake.calls).toEqual(["hero", "glow"]);
    // Unloading and loading again tries it again.
    unloadAssets(game, Art, "boot");
    const again = loadAssets(game, Art, "boot");
    await settle();
    expect(fake.calls).toEqual(["hero", "glow", "hero", "glow"]);
    await fake.resolve("hero");
    await fake.resolve("glow");
    await again;
    expect(getAsset(game, Art, "glow")).toEqual(texture("glow"));
  });

  it("loaded by name, it sends AssetLoaded with status missing and resolves", async () => {
    const { game, fake } = await setUp();
    const loaded: unknown[] = [];
    game.on(AssetLoaded, (payload) => void loaded.push(payload));
    await game.start();
    const loading = loadAsset(game, Art, "glow");
    await settle();
    await fake.reject("glow");
    await loading;
    expect(loaded).toEqual([{ manifest: "test.optionalArt", asset: "glow", status: "missing" }]);
    expect(getAsset(game, Art, "glow")).toBeUndefined();
    await game.stop();
  });

  it("leaves a non-optional asset failing its bundle, as before", async () => {
    const { game, fake } = await setUp();
    const loading = loadAssets(game, Art, "boot");
    await settle();
    await fake.reject("hero");
    await fake.resolve("glow");
    await expect(loading).rejects.toThrow(AssetBundleError);
    expect(artOf(game).bundles.boot).toMatchObject({ status: "failed", failed: 1, missing: 0 });
  });
});

describe("the README testing example", () => {
  it("shows the reef's progress and falls back when reef.webp fails", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    const textures: Record<string, Texture> = { logo: {} as Texture, missing: {} as Texture };
    setAssetLoader(game, {
      load: async ({ name }) => textures[name] ?? Promise.reject(new Error("404")),
    });
    await loadAssets(game, GameAssets, "reef");
    expect(game.resources.get(GameAssets.progress).bundles.reef).toMatchObject({ status: "loaded", fraction: 1 });
    expect(getAsset(game, GameAssets, "reef")).toBe(textures.missing);
  });
});

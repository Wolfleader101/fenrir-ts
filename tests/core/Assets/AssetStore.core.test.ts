import { describe, expect, it, vi } from "vitest";
import { AssetStore, assetKey } from "@/core/Assets/AssetStore";

// A game adds its own asset kinds the way the 2D and 3D entries do.
declare module "@/core/Assets/AssetStore" {
  interface AssetKinds {
    "test.level": { level: number };
    "test.installed": { installed: true };
  }
}

/**
 * The store as the core entry ships it, with no renderer entry loaded. The 2D
 * and 3D asset kinds are covered in AssetStore.test.ts and Texture2DHandle.test.ts.
 */
describe("AssetStore without a renderer entry", () => {
  it("has no texture or model methods and no loaders", () => {
    const store = new AssetStore() as AssetStore & Record<string, unknown>;

    for (const method of ["requestTexture2D", "loadTexture2D", "getTexture2D", "loadModel", "loadTexture", "getTexture"]) {
      expect(store[method]).toBeUndefined();
    }
    expect(store.getSupportedExtensions("texture2d")).toEqual([]);
    expect(store.getSupportedExtensions("model")).toEqual([]);
  });

  it("loads through a registered loader picked by extension", async () => {
    const store = new AssetStore();
    const loader = vi.fn(async () => ({ level: 1 }));
    store.registerLoader("test.level", "json-level", { loader, extensions: ["level"] });

    const key = assetKey("first");
    store.setAsset(key, "test.level", store.resolveLoader("test.level", "maps/First.LEVEL?v=2")({ url: "maps/First.LEVEL" }));

    expect(store.kindOf(key)).toBe("test.level");
    await expect(store.get(key)).resolves.toEqual({ level: 1 });
    expect(store.peek(key, "test.level")).toBeInstanceOf(Promise);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("names the kind and the supported extensions when none matches", () => {
    const store = new AssetStore();
    store.registerLoader("test.level", "b", { loader: vi.fn(), extensions: ["map"] });
    store.registerLoader("test.level", "a", { loader: vi.fn(), extensions: ["level", "map"] });

    expect(store.getSupportedExtensions("test.level")).toEqual(["level", "map"]);
    expect(() => store.resolveLoader("test.level", "x.png", "game level")).toThrow(
      "Unsupported game level format: .png. Supported extensions: level, map",
    );
  });

  it("warns when a loader name is registered twice", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = new AssetStore();
    store.registerLoader("test.level", "a", { loader: vi.fn(), extensions: ["level"] }, "game level");
    store.registerLoader("test.level", "a", { loader: vi.fn(), extensions: ["level"] }, "game level");

    expect(warn).toHaveBeenCalledExactlyOnceWith("Game level loader 'a' is being overridden");
    warn.mockRestore();
  });

  it("runs installers for stores constructed after they are added", () => {
    const before = new AssetStore();
    AssetStore.addInstaller((store) => {
      store.registerLoader("test.installed", "default", { loader: vi.fn(), extensions: ["inst"] });
    });
    const after = new AssetStore();

    expect(before.getSupportedExtensions("test.installed")).toEqual([]);
    expect(after.getSupportedExtensions("test.installed")).toEqual(["inst"]);
  });

  it("returns an asset by kind and rejects one of another kind", async () => {
    const store = new AssetStore();
    const key = assetKey("first");
    store.setAsset(key, "test.level", Promise.resolve({ level: 1 }));

    await expect(store.get(key, "test.level")).resolves.toEqual({ level: 1 });
    await expect(store.get(key, "test.installed")).rejects.toThrow(
      'Asset "first" is not a test.installed',
    );
    await expect(store.get(key, "test.installed", "installed thing")).rejects.toThrow(
      'Asset "first" is not a installed thing',
    );
    await expect(store.get(assetKey("missing"), "test.level")).rejects.toThrow(
      "Asset not loaded: missing",
    );
  });

  it("rejects with the load error before checking the kind", async () => {
    const store = new AssetStore();
    const key = assetKey("broken");
    const failed = Promise.reject(new Error("404"));
    store.setAsset(key, "test.level", failed);

    await expect(store.get(key, "test.installed")).rejects.toThrow("404");
  });

  it("peeks only at an asset of the given kind", () => {
    const store = new AssetStore();
    const key = assetKey("first");
    const promise = Promise.resolve({ level: 1 });
    store.setAsset(key, "test.level", promise);

    expect(store.peek(key, "test.level")).toBe(promise);
    expect(store.peek(key, "test.installed")).toBeUndefined();
    expect(store.peek(assetKey("missing"), "test.level")).toBeUndefined();
  });

  it("forgets everything on clear", async () => {
    const store = new AssetStore();
    const key = assetKey("a");
    store.setAsset(key, "test.level", Promise.resolve({ level: 1 }));
    store.clear();

    expect(store.kindOf(key)).toBeUndefined();
    await expect(store.get(key)).rejects.toThrow("Asset not loaded: a");
  });
});

import { describe, expect, it, vi } from "vitest";
import { AssetStore, assetKey } from "@/core/Assets/AssetStore";

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
    store.registerLoader("level", "json-level", { loader, extensions: ["level"] });

    const key = assetKey("first");
    store.setAsset(key, "level", store.resolveLoader("level", "maps/First.LEVEL?v=2")({ url: "maps/First.LEVEL" }));

    expect(store.kindOf(key)).toBe("level");
    await expect(store.get(key)).resolves.toEqual({ level: 1 });
    expect(store.peek(key)).toBeInstanceOf(Promise);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("names the kind and the supported extensions when none matches", () => {
    const store = new AssetStore();
    store.registerLoader("level", "b", { loader: vi.fn(), extensions: ["map"] });
    store.registerLoader("level", "a", { loader: vi.fn(), extensions: ["level", "map"] });

    expect(store.getSupportedExtensions("level")).toEqual(["level", "map"]);
    expect(() => store.resolveLoader("level", "x.png", "game level")).toThrow(
      "Unsupported game level format: .png. Supported extensions: level, map",
    );
  });

  it("warns when a loader name is registered twice", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = new AssetStore();
    store.registerLoader("level", "a", { loader: vi.fn(), extensions: ["level"] }, "game level");
    store.registerLoader("level", "a", { loader: vi.fn(), extensions: ["level"] }, "game level");

    expect(warn).toHaveBeenCalledExactlyOnceWith("Game level loader 'a' is being overridden");
    warn.mockRestore();
  });

  it("runs installers for stores constructed after they are added", () => {
    const before = new AssetStore();
    AssetStore.addInstaller((store) => {
      store.registerLoader("installed", "default", { loader: vi.fn(), extensions: ["inst"] });
    });
    const after = new AssetStore();

    expect(before.getSupportedExtensions("installed")).toEqual([]);
    expect(after.getSupportedExtensions("installed")).toEqual(["inst"]);
  });

  it("forgets everything on clear", async () => {
    const store = new AssetStore();
    const key = assetKey("a");
    store.setAsset(key, "level", Promise.resolve(1));
    store.clear();

    expect(store.kindOf(key)).toBeUndefined();
    await expect(store.get(key)).rejects.toThrow("Asset not loaded: a");
  });
});

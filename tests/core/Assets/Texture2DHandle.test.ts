import { describe, expect, it, vi } from "vitest";
import { Texture } from "pixi.js";
import { AssetStore, assetKey } from "../../../src/core/Assets/AssetStore";
import { getTexture2D, loadTexture2D, registerTexture2DLoader, requestTexture2D } from "../../../src/core/Assets/Assets2D";
import { AssetStore3D } from "../../../src/core/Assets/Assets3D";

describe("2D texture handles", () => {
  it("shares an in-flight request with async consumers and publishes the texture", async () => {
    const store = new AssetStore();
    const loader = vi.fn(async () => Texture.EMPTY);
    registerTexture2DLoader(store, "texture-test", { loader, extensions: ["texturetest"] });
    const key = assetKey("art");
    const handle = requestTexture2D(store, key, "art.texturetest");
    const notify = vi.fn();
    const removed = vi.fn();
    handle.subscribe(notify);
    handle.subscribe(removed)();

    expect(handle.state).toEqual({ status: "loading" });
    expect(requestTexture2D(store, key, "art.texturetest")).toBe(handle);
    await loadTexture2D(store, key, "art.texturetest");
    expect(await getTexture2D(store, key)).toBe(Texture.EMPTY);
    expect(handle.state).toEqual({ status: "ready", texture: Texture.EMPTY });
    expect(notify).toHaveBeenCalledExactlyOnceWith(handle.state);
    expect(removed).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("reports failure and gives a later retry a new handle", async () => {
    const store = new AssetStore();
    const failure = new Error("offline");
    const loader = vi.fn<() => Promise<Texture>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(Texture.EMPTY);
    registerTexture2DLoader(store, "texture-test", { loader, extensions: ["texturetest"] });

    const first = requestTexture2D(store, "art", "art.texturetest");
    await expect(first.ready).rejects.toBe(failure);
    expect(first.state).toEqual({ status: "failed", error: failure });

    const second = requestTexture2D(store, "art", "art.texturetest");
    expect(second).not.toBe(first);
    await expect(second.ready).resolves.toBe(Texture.EMPTY);
  });

  it("ends a request when another asset is loaded under the key", async () => {
    const store = new AssetStore3D();
    const loader = vi.fn(async () => Texture.EMPTY);
    registerTexture2DLoader(store, "texture-test", { loader, extensions: ["texturetest"] });
    store.registerModelLoader("model-test", {
      loader: vi.fn(async () => ({ geometry: {}, animations: [], materials: [] }) as never),
      extensions: ["modeltest"],
    });

    const first = requestTexture2D(store, "art", "art.texturetest");
    await first.ready;
    await store.loadModel("art", "art.modeltest");
    await expect(getTexture2D(store, "art")).rejects.toThrow('Asset "art" is not a 2D texture');

    const second = requestTexture2D(store, "art", "art.texturetest");
    expect(second).not.toBe(first);
    await expect(getTexture2D(store, "art")).resolves.toBe(Texture.EMPTY);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("ends every request on clear", async () => {
    const store = new AssetStore();
    const loader = vi.fn(async () => Texture.EMPTY);
    registerTexture2DLoader(store, "texture-test", { loader, extensions: ["texturetest"] });

    const first = requestTexture2D(store, "art", "art.texturetest");
    await first.ready;
    store.clear();

    const second = requestTexture2D(store, "art", "art.texturetest");
    expect(second).not.toBe(first);
    await second.ready;
    expect(loader).toHaveBeenCalledTimes(2);
  });
});

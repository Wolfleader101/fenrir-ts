import { describe, expect, it, vi } from "vitest";
import { Texture } from "pixi.js";
import { AssetStore, assetKey } from "../../../src/core/Assets/AssetStore";

describe("2D texture handles", () => {
  it("shares an in-flight request with async consumers and publishes the texture", async () => {
    const store = new AssetStore();
    const loader = vi.fn(async () => Texture.EMPTY);
    store.registerTexture2DLoader("texture-test", { loader, extensions: ["texturetest"] });
    const key = assetKey("art");
    const handle = store.requestTexture2D(key, "art.texturetest");
    const notify = vi.fn();
    const removed = vi.fn();
    handle.subscribe(notify);
    handle.subscribe(removed)();

    expect(handle.state).toEqual({ status: "loading" });
    expect(store.requestTexture2D(key, "art.texturetest")).toBe(handle);
    await store.loadTexture2D(key, "art.texturetest");
    expect(await store.getTexture2D(key)).toBe(Texture.EMPTY);
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
    store.registerTexture2DLoader("texture-test", { loader, extensions: ["texturetest"] });

    const first = store.requestTexture2D("art", "art.texturetest");
    await expect(first.ready).rejects.toBe(failure);
    expect(first.state).toEqual({ status: "failed", error: failure });

    const second = store.requestTexture2D("art", "art.texturetest");
    expect(second).not.toBe(first);
    await expect(second.ready).resolves.toBe(Texture.EMPTY);
  });
});

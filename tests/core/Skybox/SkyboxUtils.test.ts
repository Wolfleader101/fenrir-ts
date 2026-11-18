import { describe, expect, it, vi } from "vitest";
import { SkyboxUtils } from "@/core/Skybox/SkyboxUtils";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import type { Scene } from "@/core/Scene";

describe("SkyboxUtils.setupDefaultSkybox", () => {
  it("loads the six embedded faces and sets a cubemap skybox on the scene", async () => {
    const loadTexture = vi.fn(async (_key: string, _url: string) => {});
    const setSkybox = vi.fn();
    const assets = { loadTexture } as unknown as IAssetStore;
    const scene = { setSkybox } as unknown as Scene;

    await SkyboxUtils.setupDefaultSkybox(scene, assets, { enabled: false });

    const faces = ["right", "left", "top", "bottom", "front", "back"];
    expect(loadTexture.mock.calls.map(([key]) => key)).toEqual(faces.map((face) => `skybox/${face}.png`));
    // The embedded image for each face, loaded on demand from its own module.
    const images = await import("@/core/Skybox/defaultSkyboxImages");
    expect(loadTexture.mock.calls.map(([, url]) => url)).toEqual(faces.map((face) => images[face as keyof typeof images]));
    for (const [, url] of loadTexture.mock.calls) expect(url).toMatch(/right|left|top|bottom|front|back|^data:image\/png/);

    expect(setSkybox).toHaveBeenCalledWith({
      type: "cubemap",
      textures: {
        posX: "skybox/right.png",
        negX: "skybox/left.png",
        posY: "skybox/top.png",
        negY: "skybox/bottom.png",
        posZ: "skybox/front.png",
        negZ: "skybox/back.png",
      },
      enabled: false,
    });
  });
});

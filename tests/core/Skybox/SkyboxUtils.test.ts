import { describe, expect, it, vi } from "vitest";
import { SkyboxUtils } from "@/core/Skybox/SkyboxUtils";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import { Scene } from "@/core/Scene";

describe("SkyboxUtils.setupCubemapSkybox", () => {
  it("loads the six faces from basePath and sets a cubemap skybox on the scene", async () => {
    const loadTexture = vi.fn(async (_key: string, _url: string) => {});
    const assets = { loadTexture } as unknown as IAssetStore;
    // A core Scene: SkyboxUtils works on it without the members fenrir-ts/3d adds.
    const scene = new Scene("test.skybox");

    await SkyboxUtils.setupCubemapSkybox(scene, assets, { basePath: "/textures/skybox", enabled: false });

    const faces = ["right", "left", "top", "bottom", "front", "back"].map((face) => `/textures/skybox/${face}.png`);
    // Each face is loaded from its URL, under that URL as its key.
    expect(loadTexture.mock.calls).toEqual(faces.map((face) => [face, face]));
    expect(scene.skybox).toEqual({
      type: "cubemap",
      textures: { posX: faces[0], negX: faces[1], posY: faces[2], negY: faces[3], posZ: faces[4], negZ: faces[5] },
      enabled: false,
    });
  });

  it("names other face files with faces", async () => {
    const loadTexture = vi.fn(async (_key: string, _url: string) => {});
    const scene = new Scene("test.skybox.faces");

    await SkyboxUtils.setupCubemapSkybox(scene, { loadTexture } as unknown as IAssetStore, { faces: { posY: "sky.jpg" } });

    expect(loadTexture.mock.calls.map(([url]) => url)).toContain("skybox/sky.jpg");
  });
});

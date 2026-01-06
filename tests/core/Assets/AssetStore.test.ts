import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AssetStore,
  assetKey,
  type AssetStoreConfig,
} from "@/core/Assets/AssetStore";
import * as THREE from "three";

// Mock Three.js and loaders
vi.mock("three", () => {
  const MockTexture = vi.fn(function () {
    return {
      mapping: 301, // THREE.EquirectangularReflectionMapping
      dispose: vi.fn(),
    };
  });

  return {
    Texture: MockTexture,
    EquirectangularReflectionMapping: 301, // THREE.js constant value
  };
});

// Mock the loaders - use the actual mocked functions for default behavior
const mockGltfLoaderFn = vi.fn().mockResolvedValue({
  geometry: { name: "MockGeometry" },
  animations: [{ name: "mockAnimation" }],
  materials: [{ name: "MockMaterial" }],
});

const mockTextureLoaderFn = vi.fn().mockResolvedValue({
  mapping: 301,
  dispose: vi.fn(),
});

vi.mock("@/core/Assets/loaders/gltfLoader", () => ({
  createGltfLoader: vi.fn(() => mockGltfLoaderFn),
}));

vi.mock("@/core/Assets/loaders/textureLoader", () => ({
  createTextureLoader: vi.fn(() => mockTextureLoaderFn),
}));

describe("AssetStore", () => {
  let assetStore: AssetStore;
  let customGltfLoader: any;
  let customTextureLoader: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create custom loaders for specific tests
    customGltfLoader = vi.fn().mockResolvedValue({
      geometry: { name: "TestGeometry" },
      animations: [{ name: "testAnimation" }],
      materials: [{ name: "TestMaterial" }],
    });

    customTextureLoader = vi.fn().mockResolvedValue({
      mapping: 301,
      dispose: vi.fn(),
    });

    assetStore = new AssetStore();
  });

  describe("initialization", () => {
    it("should create AssetStore with default loaders", () => {
      expect(assetStore).toBeDefined();
      expect(assetStore.getSupportedModelExtensions()).toContain("glb");
      expect(assetStore.getSupportedModelExtensions()).toContain("gltf");
      expect(assetStore.getSupportedTextureExtensions()).toContain("jpg");
      expect(assetStore.getSupportedTextureExtensions()).toContain("png");
    });

    it("should create AssetStore with custom config", () => {
      const config: AssetStoreConfig = {
        modelLoaders: {
          customModel: {
            loader: customGltfLoader,
            extensions: ["custom"],
          },
        },
        textureLoaders: {
          customTexture: {
            loader: customTextureLoader,
            extensions: ["ct"],
          },
        },
      };

      const customAssetStore = new AssetStore(config);

      expect(customAssetStore.getSupportedModelExtensions()).toContain(
        "custom"
      );
      expect(customAssetStore.getSupportedTextureExtensions()).toContain("ct");
    });
  });

  describe("assetKey utility", () => {
    it("should create typed asset key", () => {
      const key = assetKey("test-asset");
      expect(key).toBe("test-asset");
      expect(typeof key).toBe("string");
    });
  });

  describe("loader registration", () => {
    it("should register model loader", () => {
      const initialExtensions = assetStore.getSupportedModelExtensions();

      assetStore.registerModelLoader("test", {
        loader: customGltfLoader,
        extensions: ["test"],
      });

      const newExtensions = assetStore.getSupportedModelExtensions();
      expect(newExtensions).toContain("test");
      expect(newExtensions.length).toBe(initialExtensions.length + 1);
    });

    it("should register texture loader", () => {
      const initialExtensions = assetStore.getSupportedTextureExtensions();

      assetStore.registerTextureLoader("test", {
        loader: customTextureLoader,
        extensions: ["test"],
      });

      const newExtensions = assetStore.getSupportedTextureExtensions();
      expect(newExtensions).toContain("test");
      expect(newExtensions.length).toBe(initialExtensions.length + 1);
    });

    it("should warn when overriding existing model loader", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      assetStore.registerModelLoader("gltf", {
        loader: customGltfLoader,
        extensions: ["glb"],
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Model loader 'gltf' is being overridden"
      );
      consoleSpy.mockRestore();
    });

    it("should warn when overriding existing texture loader", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      assetStore.registerTextureLoader("texture", {
        loader: customTextureLoader,
        extensions: ["jpg"],
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Texture loader 'texture' is being overridden"
      );
      consoleSpy.mockRestore();
    });
  });

  describe("supported extensions", () => {
    it("should return sorted model extensions", () => {
      const extensions = assetStore.getSupportedModelExtensions();
      expect(extensions).toEqual([...extensions].sort());
      expect(extensions).toContain("glb");
      expect(extensions).toContain("gltf");
    });

    it("should return sorted texture extensions", () => {
      const extensions = assetStore.getSupportedTextureExtensions();
      expect(extensions).toEqual([...extensions].sort());
      expect(extensions).toContain("jpg");
      expect(extensions).toContain("png");
    });

    it("should handle multiple loaders with same extensions", () => {
      assetStore.registerModelLoader("test1", {
        loader: customGltfLoader,
        extensions: ["glb", "test"],
      });

      assetStore.registerModelLoader("test2", {
        loader: customGltfLoader,
        extensions: ["glb", "other"],
      });

      const extensions = assetStore.getSupportedModelExtensions();
      expect(extensions.filter((ext) => ext === "glb")).toHaveLength(1); // No duplicates
      expect(extensions).toContain("test");
      expect(extensions).toContain("other");
    });
  });

  describe("model loading", () => {
    it("should load model with supported extension", async () => {
      // Register a custom loader with unique extension
      assetStore.registerModelLoader("test-model", {
        loader: customGltfLoader,
        extensions: ["test"],
      });

      const key = assetKey("test-model");
      await assetStore.loadModel(key, "test.test");

      expect(customGltfLoader).toHaveBeenCalledWith({ url: "test.test" });
    });

    it("should throw error for unsupported model extension", async () => {
      const key = assetKey("test-model");

      await expect(
        assetStore.loadModel(key, "test.unsupported")
      ).rejects.toThrow("Unsupported model format: .unsupported");
    });

    it("should handle URLs without extensions", async () => {
      const key = assetKey("test-model");

      await expect(assetStore.loadModel(key, "test")).rejects.toThrow(
        "Unsupported model format: ."
      );
    });
  });

  describe("texture loading", () => {
    it("should load texture with supported extension", async () => {
      // Register a custom loader with unique extension
      assetStore.registerTextureLoader("test-texture", {
        loader: customTextureLoader,
        extensions: ["test"],
      });

      const key = assetKey("test-texture");
      await assetStore.loadTexture(key, "test.test");

      expect(customTextureLoader).toHaveBeenCalledWith({ url: "test.test" });
    });

    it("should throw error for unsupported texture extension", async () => {
      const key = assetKey("test-texture");

      await expect(
        assetStore.loadTexture(key, "test.unsupported")
      ).rejects.toThrow("Unsupported texture format: .unsupported");
    });
  });

  describe("asset retrieval", () => {
    beforeEach(async () => {
      // Set up test assets using default loaders (already mocked)
      await assetStore.loadModel(assetKey("model"), "test.gltf");
      await assetStore.loadTexture(assetKey("texture"), "test.jpg");
    });

    it("should get geometry from model asset", async () => {
      const geometry = await assetStore.getGeometry(assetKey("model"));
      expect(geometry).toEqual({ name: "MockGeometry" });
    });

    it("should get animations from model asset", async () => {
      const animations = await assetStore.getAnimations(assetKey("model"));
      expect(animations).toEqual([{ name: "mockAnimation" }]);
      // Should return a copy, not the original array
      expect(animations).not.toBe(
        mockGltfLoaderFn.mock.results[0].value.animations
      );
    });

    it("should get materials from model asset", async () => {
      const materials = await assetStore.getMaterials(assetKey("model"));
      expect(materials).toEqual([{ name: "MockMaterial" }]);
      // Should return a copy, not the original array
      expect(materials).not.toBe(
        mockGltfLoaderFn.mock.results[0].value.materials
      );
    });

    it("should get texture asset", async () => {
      const texture = await assetStore.getTexture(assetKey("texture"));
      expect(texture).toEqual({ mapping: 301, dispose: expect.any(Function) });
    });

    it("should get generic asset", async () => {
      const modelAsset = await assetStore.get(assetKey("model"));
      expect(modelAsset).toEqual({
        geometry: { name: "MockGeometry" },
        animations: [{ name: "mockAnimation" }],
        materials: [{ name: "MockMaterial" }],
      });

      const textureAsset = await assetStore.get(assetKey("texture"));
      expect(textureAsset).toEqual({
        mapping: 301,
        dispose: expect.any(Function),
      });
    });

    it("should throw error when getting geometry from texture", async () => {
      await expect(assetStore.getGeometry(assetKey("texture"))).rejects.toThrow(
        'Asset "texture" is not a model'
      );
    });

    it("should throw error when getting animations from texture", async () => {
      await expect(
        assetStore.getAnimations(assetKey("texture"))
      ).rejects.toThrow('Asset "texture" is not a model');
    });

    it("should throw error when getting materials from texture", async () => {
      await expect(
        assetStore.getMaterials(assetKey("texture"))
      ).rejects.toThrow('Asset "texture" is not a model');
    });

    it("should throw error when getting texture from model", async () => {
      await expect(assetStore.getTexture(assetKey("model"))).rejects.toThrow(
        'Asset "model" is not a texture'
      );
    });

    it("should throw error when getting non-existent asset", async () => {
      await expect(assetStore.get(assetKey("nonexistent"))).rejects.toThrow(
        "Asset not loaded: nonexistent"
      );
    });
  });

  describe("cache management", () => {
    it("should cache loaded assets", async () => {
      const key = assetKey("cached-texture");

      // Load asset twice using default loader
      await assetStore.loadTexture(key, "test.jpg");
      const texture1 = await assetStore.getTexture(key);
      const texture2 = await assetStore.getTexture(key);

      // Should return same instance from cache
      expect(texture1).toBe(texture2);
      // Default loader should only be called once (cache working)
      expect(mockTextureLoaderFn).toHaveBeenCalledTimes(1);
    });

    it("should clear cache", async () => {
      const key = assetKey("test-texture");
      await assetStore.loadTexture(key, "test.jpg");

      // Verify asset exists
      await expect(assetStore.getTexture(key)).resolves.toBeDefined();

      // Clear cache
      assetStore.clear();

      // Asset should no longer be available
      await expect(assetStore.getTexture(key)).rejects.toThrow(
        "Asset not loaded: test-texture"
      );
    });
  });

  describe("error handling", () => {
    it("should handle loader errors for models", async () => {
      const errorLoader = vi.fn().mockRejectedValue(new Error("Load failed"));
      assetStore.registerModelLoader("error-loader", {
        loader: errorLoader,
        extensions: ["err"],
      });

      const key = assetKey("error-model");

      await expect(assetStore.loadModel(key, "test.err")).rejects.toThrow(
        "Load failed"
      );
    });

    it("should handle loader errors for textures", async () => {
      const errorLoader = vi.fn().mockRejectedValue(new Error("Load failed"));
      assetStore.registerTextureLoader("error-loader", {
        loader: errorLoader,
        extensions: ["err"],
      });

      const key = assetKey("error-texture");

      await expect(assetStore.loadTexture(key, "test.err")).rejects.toThrow(
        "Load failed"
      );
    });
  });

  describe("file extension handling", () => {
    it("should handle case insensitive extensions", async () => {
      assetStore.registerModelLoader("test", {
        loader: customGltfLoader,
        extensions: ["gltf"],
      });

      const key = assetKey("test-model");

      // Should work with uppercase extension
      await expect(
        assetStore.loadModel(key, "test.GLTF")
      ).resolves.not.toThrow();
    });

    it("should handle multiple dots in filename", async () => {
      assetStore.registerTextureLoader("test", {
        loader: customTextureLoader,
        extensions: ["jpg"],
      });

      const key = assetKey("test-texture");

      // Should use last extension
      await expect(
        assetStore.loadTexture(key, "my.file.name.jpg")
      ).resolves.not.toThrow();
    });
  });
});

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
      mapping: THREE.EquirectangularReflectionMapping,
      dispose: vi.fn(),
    };
  });

  return {
    Texture: MockTexture,
    EquirectangularReflectionMapping: 301, // THREE.js constant value
  };
});

// Mock the loaders
vi.mock("@/core/Assets/loaders/gltfLoader", () => ({
  createGltfLoader: vi.fn(() =>
    vi.fn().mockResolvedValue({
      geometry: { name: "MockGeometry" },
      animations: [{ name: "mockAnimation" }],
      materials: [{ name: "MockMaterial" }],
    })
  ),
}));

vi.mock("@/core/Assets/loaders/textureLoader", () => ({
  createTextureLoader: vi.fn(() =>
    vi.fn().mockResolvedValue(new THREE.Texture())
  ),
}));

describe("AssetStore", () => {
  let assetStore: AssetStore;
  let mockGltfLoader: any;
  let mockTextureLoader: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock loaders
    mockGltfLoader = vi.fn().mockResolvedValue({
      geometry: { name: "TestGeometry" },
      animations: [{ name: "testAnimation" }],
      materials: [{ name: "TestMaterial" }],
    });

    mockTextureLoader = vi.fn().mockResolvedValue(new THREE.Texture());

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
            loader: mockGltfLoader,
            extensions: ["custom"],
          },
        },
        textureLoaders: {
          customTexture: {
            loader: mockTextureLoader,
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
        loader: mockGltfLoader,
        extensions: ["test"],
      });

      const newExtensions = assetStore.getSupportedModelExtensions();
      expect(newExtensions).toContain("test");
      expect(newExtensions.length).toBe(initialExtensions.length + 1);
    });

    it("should register texture loader", () => {
      const initialExtensions = assetStore.getSupportedTextureExtensions();

      assetStore.registerTextureLoader("test", {
        loader: mockTextureLoader,
        extensions: ["test"],
      });

      const newExtensions = assetStore.getSupportedTextureExtensions();
      expect(newExtensions).toContain("test");
      expect(newExtensions.length).toBe(initialExtensions.length + 1);
    });

    it("should warn when overriding existing model loader", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      assetStore.registerModelLoader("gltf", {
        loader: mockGltfLoader,
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
        loader: mockTextureLoader,
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
        loader: mockGltfLoader,
        extensions: ["glb", "test"],
      });

      assetStore.registerModelLoader("test2", {
        loader: mockGltfLoader,
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
      // Register a mock loader that will be called
      assetStore.registerModelLoader("test-gltf", {
        loader: mockGltfLoader,
        extensions: ["gltf"],
      });

      const key = assetKey("test-model");
      await assetStore.loadModel(key, "test.gltf");

      expect(mockGltfLoader).toHaveBeenCalledWith({ url: "test.gltf" });
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
      // Register a mock loader that will be called
      assetStore.registerTextureLoader("test-texture", {
        loader: mockTextureLoader,
        extensions: ["jpg"],
      });

      const key = assetKey("test-texture");
      await assetStore.loadTexture(key, "test.jpg");

      expect(mockTextureLoader).toHaveBeenCalledWith({ url: "test.jpg" });
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
      // Set up test assets
      assetStore.registerModelLoader("test-gltf", {
        loader: mockGltfLoader,
        extensions: ["gltf"],
      });

      assetStore.registerTextureLoader("test-texture", {
        loader: mockTextureLoader,
        extensions: ["jpg"],
      });

      await assetStore.loadModel(assetKey("model"), "test.gltf");
      await assetStore.loadTexture(assetKey("texture"), "test.jpg");
    });

    it("should get geometry from model asset", async () => {
      const geometry = await assetStore.getGeometry(assetKey("model"));
      expect(geometry).toEqual({ name: "TestGeometry" });
    });

    it("should get animations from model asset", async () => {
      const animations = await assetStore.getAnimations(assetKey("model"));
      expect(animations).toEqual([{ name: "testAnimation" }]);
      // Should return a copy, not the original array
      expect(animations).not.toBe(
        mockGltfLoader.mock.results[0].value.animations
      );
    });

    it("should get materials from model asset", async () => {
      const materials = await assetStore.getMaterials(assetKey("model"));
      expect(materials).toEqual([{ name: "TestMaterial" }]);
      // Should return a copy, not the original array
      expect(materials).not.toBe(
        mockGltfLoader.mock.results[0].value.materials
      );
    });

    it("should get texture asset", async () => {
      const texture = await assetStore.getTexture(assetKey("texture"));
      expect(texture).toBeInstanceOf(THREE.Texture);
    });

    it("should get generic asset", async () => {
      const modelAsset = await assetStore.get(assetKey("model"));
      expect(modelAsset).toEqual({
        geometry: { name: "TestGeometry" },
        animations: [{ name: "testAnimation" }],
        materials: [{ name: "TestMaterial" }],
      });

      const textureAsset = await assetStore.get(assetKey("texture"));
      expect(textureAsset).toBeInstanceOf(THREE.Texture);
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
      assetStore.registerTextureLoader("test", {
        loader: mockTextureLoader,
        extensions: ["jpg"],
      });

      const key = assetKey("cached-texture");

      // Load asset twice
      await assetStore.loadTexture(key, "test.jpg");
      const texture1 = await assetStore.getTexture(key);
      const texture2 = await assetStore.getTexture(key);

      // Should return same instance from cache
      expect(texture1).toBe(texture2);
      // Loader should only be called once
      expect(mockTextureLoader).toHaveBeenCalledTimes(1);
    });

    it("should clear cache", async () => {
      assetStore.registerTextureLoader("test", {
        loader: mockTextureLoader,
        extensions: ["jpg"],
      });

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
        loader: mockGltfLoader,
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
        loader: mockTextureLoader,
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as THREE from "three";
import { createTextureLoader } from "@/core/Assets/loaders/textureLoader";

// Mock Three.js TextureLoader
vi.mock("three", async () => {
  const actual = await vi.importActual("three");

  function MockTextureLoader() {
    return {
      loadAsync: vi.fn(),
    };
  }

  return {
    ...actual,
    TextureLoader: vi.fn(MockTextureLoader),
  };
});

describe("textureLoader", () => {
  let mockTexture: THREE.Texture;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTexture = new THREE.Texture();
  });

  it("should create a texture loader function", () => {
    const loader = createTextureLoader();

    expect(typeof loader).toBe("function");
  });

  it("should use default TextureLoader when no options provided", () => {
    createTextureLoader();

    expect(THREE.TextureLoader).toHaveBeenCalledWith();
  });

  it("should use provided loader when specified in options", () => {
    const customLoader = {
      loadAsync: vi.fn().mockResolvedValue(mockTexture),
    } as unknown as THREE.TextureLoader;

    createTextureLoader({ loader: customLoader });

    // TextureLoader constructor should not be called when custom loader is provided
    expect(THREE.TextureLoader).not.toHaveBeenCalled();
  });

  it("should load texture from URL", async () => {
    // Setup mock for this specific test
    const mockLoadAsync = vi.fn().mockResolvedValue(mockTexture);
    (THREE.TextureLoader as any).mockImplementation(function () {
      return {
        loadAsync: mockLoadAsync,
      };
    });

    const loader = createTextureLoader();
    const testUrl = "test-texture.jpg";

    const result = await loader({ url: testUrl });

    expect(mockLoadAsync).toHaveBeenCalledWith(testUrl);
    expect(result).toBe(mockTexture);
  });

  it("should handle URL with format hint", async () => {
    // Setup mock for this specific test
    const mockLoadAsync = vi.fn().mockResolvedValue(mockTexture);
    (THREE.TextureLoader as any).mockImplementation(function () {
      return {
        loadAsync: mockLoadAsync,
      };
    });

    const loader = createTextureLoader();
    const testUrl = "test-texture.jpg";
    const format = "jpg";

    const result = await loader({ url: testUrl, format });

    expect(mockLoadAsync).toHaveBeenCalledWith(testUrl);
    expect(result).toBe(mockTexture);
  });

  it("should propagate loader errors", async () => {
    const error = new Error("Failed to load texture");
    const mockLoadAsync = vi.fn().mockRejectedValue(error);
    (THREE.TextureLoader as any).mockImplementation(function () {
      return {
        loadAsync: mockLoadAsync,
      };
    });

    const loader = createTextureLoader();

    await expect(loader({ url: "invalid.jpg" })).rejects.toThrow(
      "Failed to load texture"
    );
  });

  it("should work with custom loader options", async () => {
    const customLoader = {
      loadAsync: vi.fn().mockResolvedValue(mockTexture),
    } as unknown as THREE.TextureLoader;

    const loader = createTextureLoader({ loader: customLoader });
    const testUrl = "custom-texture.png";

    const result = await loader({ url: testUrl });

    expect(customLoader.loadAsync).toHaveBeenCalledWith(testUrl);
    expect(result).toBe(mockTexture);
  });
});

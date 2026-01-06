import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGltfLoader } from "@/core/Assets/loaders/gltfLoader";
import * as THREE from "three";

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");

  class MockMesh {
    material: any;
    isMesh = true;
    name: string;

    constructor(geometry?: any, material?: any) {
      this.material = material || { name: "MockMaterial" };
      this.name = "MockMesh";
    }
  }

  const MockMaterial = vi.fn(function () {
    return {
      name: "MockMaterial",
      dispose: vi.fn(),
    };
  });

  return {
    ...actual,
    Mesh: MockMesh,
    Material: MockMaterial,
  };
});

const loadAsyncMock = vi.fn();
const GLTFLoaderConstructor = vi.fn();

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  class GLTFLoader {
    loadAsync = loadAsyncMock;

    constructor() {
      GLTFLoaderConstructor();
    }
  }
  return { GLTFLoader };
});

describe("gltfLoader", () => {
  let mockGltf: any;
  let mockScene: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    GLTFLoaderConstructor.mockClear();

    // Create mock materials
    const mockMaterial1 = { name: "Material1", dispose: vi.fn() };
    const mockMaterial2 = { name: "Material2", dispose: vi.fn() };
    const mockMaterialArray = [mockMaterial1, mockMaterial2];

    // Create mock mesh with single material using THREE.Mesh constructor
    const mockMeshSingle = new THREE.Mesh();
    (mockMeshSingle as any).material = mockMaterial1;
    mockMeshSingle.name = "MeshWithSingleMaterial";

    // Create mock mesh with array of materials using THREE.Mesh constructor
    const mockMeshArray = new THREE.Mesh();
    (mockMeshArray as any).material = mockMaterialArray;
    mockMeshArray.name = "MeshWithMaterialArray";

    // Create mock non-mesh object
    const mockNonMesh = {
      isMesh: false,
      name: "NotAMesh",
    };

    // Create mock scene with traverse function
    mockScene = {
      name: "TestScene",
      traverse: vi.fn((callback) => {
        // Simulate traversing the scene graph
        callback(mockScene); // Root object
        callback(mockMeshSingle);
        callback(mockMeshArray);
        callback(mockNonMesh);
      }),
    };

    // Create mock GLTF object
    mockGltf = {
      scene: mockScene,
      animations: [
        { name: "Animation1", duration: 1.0 },
        { name: "Animation2", duration: 2.0 },
      ],
    };

    loadAsyncMock.mockResolvedValue(mockGltf);
  });

  describe("createGltfLoader", () => {
    it("should create a GLTF loader function", () => {
      const loader = createGltfLoader();
      expect(typeof loader).toBe("function");
    });

    it("should use default GLTFLoader when no options provided", async () => {
      createGltfLoader();
      expect(GLTFLoaderConstructor).toHaveBeenCalledWith();
    });

    it("should use provided loader when specified in options", async () => {
      const customLoader = {
        loadAsync: vi.fn().mockResolvedValue(mockGltf),
      };

      createGltfLoader({ loader: customLoader as any });

      // GLTFLoader constructor should not be called when custom loader is provided
      expect(GLTFLoaderConstructor).not.toHaveBeenCalled();
    });
  });

  describe("loader functionality", () => {
    it("should load GLTF from URL", async () => {
      const loader = createGltfLoader();
      const testUrl = "test-model.glb";

      const result = await loader({ url: testUrl });

      expect(result.geometry).toBe(mockGltf.scene);
      expect(result.animations).toBe(mockGltf.animations);
    });

    it("should extract single materials from meshes", async () => {
      const loader = createGltfLoader();

      const result = await loader({ url: "test.glb" });

      expect(result.materials).toBeDefined();
      expect(Array.isArray(result.materials)).toBe(true);

      // Should contain materials from both single material mesh and material array mesh
      expect(result.materials).toHaveLength(2); // Duplicates should be removed
      expect(result.materials[0]).toEqual({
        name: "Material1",
        dispose: expect.any(Function),
      });
      expect(result.materials[1]).toEqual({
        name: "Material2",
        dispose: expect.any(Function),
      });
    });

    it("should extract array materials from meshes", async () => {
      // Create a more specific test for array materials
      const arrayMaterial1 = { name: "ArrayMat1" };
      const arrayMaterial2 = { name: "ArrayMat2" };

      const mockMeshWithArrayMaterials = new THREE.Mesh();
      (mockMeshWithArrayMaterials as any).material = [
        arrayMaterial1,
        arrayMaterial2,
      ];

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(mockMeshWithArrayMaterials);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      expect(result.materials).toEqual([arrayMaterial1, arrayMaterial2]);
    });

    it("should ignore non-mesh objects when extracting materials", async () => {
      const nonMeshObject = {
        isMesh: false,
        material: { name: "ShouldBeIgnored" },
      };

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(nonMeshObject);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      expect(result.materials).toEqual([]);
    });

    it("should ignore meshes without materials", async () => {
      const meshWithoutMaterial = new THREE.Mesh();
      (meshWithoutMaterial as any).material = null;

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(meshWithoutMaterial);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      expect(result.materials).toEqual([]);
    });

    it("should remove duplicate materials", async () => {
      const sharedMaterial = { name: "SharedMaterial" };

      const mesh1 = new THREE.Mesh();
      (mesh1 as any).material = sharedMaterial;

      const mesh2 = new THREE.Mesh();
      (mesh2 as any).material = sharedMaterial; // Same material reference

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(mesh1);
          callback(mesh2);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      // Should only contain one instance of the shared material
      expect(result.materials).toHaveLength(1);
      expect(result.materials[0]).toBe(sharedMaterial);
    });

    it("should handle meshes with instanceof THREE.Mesh check", async () => {
      // Test that the loader uses instanceof THREE.Mesh properly
      const realMesh = new THREE.Mesh();
      (realMesh as any).material = { name: "RealMeshMaterial" };

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(realMesh);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      expect(result.materials).toContain(realMesh.material);
    });

    it("should work with custom GLTFLoader instance", async () => {
      const customLoader = {
        loadAsync: vi.fn().mockResolvedValue(mockGltf),
      };

      const loader = createGltfLoader({ loader: customLoader as any });
      const testUrl = "custom-test.glb";

      const result = await loader({ url: testUrl });

      expect(customLoader.loadAsync).toHaveBeenCalledWith(testUrl);
      expect(result.geometry).toBe(mockGltf.scene);
      expect(result.animations).toBe(mockGltf.animations);
    });

    it("should propagate loader errors", async () => {
      const error = new Error("Failed to load GLTF");

      loadAsyncMock.mockRejectedValueOnce(error);

      const loader = createGltfLoader();

      await expect(loader({ url: "invalid.glb" })).rejects.toThrow(
        "Failed to load GLTF"
      );
    });

    it("should return correct LoadedModel structure", async () => {
      const loader = createGltfLoader();

      const result = await loader({ url: "test.glb" });

      // Verify the structure matches LoadedModel interface
      expect(result).toHaveProperty("geometry");
      expect(result).toHaveProperty("animations");
      expect(result).toHaveProperty("materials");

      expect(result.geometry).toBe(mockGltf.scene);
      expect(result.animations).toBe(mockGltf.animations);
      expect(Array.isArray(result.materials)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty scene", async () => {
      const emptyScene = {
        traverse: vi.fn((callback) => {
          callback(emptyScene); // Only root object
        }),
      };

      const emptyGltf = {
        scene: emptyScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(emptyGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "empty.glb" });

      expect(result.materials).toEqual([]);
      expect(result.animations).toEqual([]);
      expect(result.geometry).toBe(emptyScene);
    });

    it("should handle complex nested material arrays", async () => {
      const mat1 = { name: "Mat1" };
      const mat2 = { name: "Mat2" };
      const mat3 = { name: "Mat3" };

      const complexMesh = new THREE.Mesh();
      (complexMesh as any).material = [mat1, [mat2, mat3]]; // Nested array (shouldn't normally happen but test robustness)

      const customScene = {
        traverse: vi.fn((callback) => {
          callback(complexMesh);
        }),
      };

      const customGltf = {
        scene: customScene,
        animations: [],
      };

      loadAsyncMock.mockResolvedValueOnce(customGltf);

      const loader = createGltfLoader();
      const result = await loader({ url: "test.glb" });

      // Should handle the array correctly (nested arrays aren't flattened by the implementation)
      expect(result.materials).toEqual([mat1, [mat2, mat3]]);
    });
  });
});

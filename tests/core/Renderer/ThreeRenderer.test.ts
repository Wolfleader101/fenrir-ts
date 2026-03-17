import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type MockedFunction,
} from "vitest";
import { ThreeRenderer } from "@/core/Renderer/ThreeRenderer";
import { Renderable } from "@/core/Renderer/renderComponents";
import { WorldTransform } from "@/core/ECS/DefaultComponents";
import { NullLogger } from "@/core/NullLogger";
import { EntityList } from "@/core/ECS";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import * as THREE from "three";

// Mock Three.js with proper constructor functions
vi.mock("three", () => {
  const createMockGeometry = () => ({
    dispose: vi.fn(),
  });

  const createMockMaterial = () => ({
    dispose: vi.fn(),
  });

  const createMockMesh = () => ({
    position: { copy: vi.fn() },
    quaternion: { copy: vi.fn() },
    scale: { copy: vi.fn() },
    updateMatrixWorld: vi.fn(),
    geometry: createMockGeometry(),
    material: createMockMaterial(),
    visible: true,
    castShadow: false,
    receiveShadow: false,
    layers: { set: vi.fn() },
  });

  const createMockObject3D = () => ({
    position: { copy: vi.fn() },
    quaternion: { copy: vi.fn() },
    scale: { copy: vi.fn() },
    updateMatrixWorld: vi.fn(),
    visible: true,
    layers: { set: vi.fn() },
    clone: vi.fn(() => createMockObject3D()),
    traverse: vi.fn((callback) => {
      // Call callback with the object itself for testing
      callback(createMockObject3D());
    }),
  });

  const createMockScene = () => ({
    add: vi.fn(),
    remove: vi.fn(),
  });

  const createMockRenderer = () => ({
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  });

  const createMockCamera = () => ({
    position: { set: vi.fn() },
    lookAt: vi.fn(),
    aspect: 1,
    updateProjectionMatrix: vi.fn(),
  });

  const createMockLight = () => ({
    position: { set: vi.fn() },
  });

  const createMockVector3 = () => ({
    copy: vi.fn(),
  });

  const createMockQuaternion = () => ({
    copy: vi.fn(),
  });

  const MockScene = vi.fn(function () {
    return createMockScene();
  });
  const MockWebGLRenderer = vi.fn(function () {
    return createMockRenderer();
  });
  const MockPerspectiveCamera = vi.fn(function () {
    return createMockCamera();
  });
  const MockBoxGeometry = vi.fn(function () {
    return createMockGeometry();
  });
  const MockPlaneGeometry = vi.fn(function () {
    return createMockGeometry();
  });
  const MockSphereGeometry = vi.fn(function () {
    return createMockGeometry();
  });
  const MockMeshStandardMaterial = vi.fn(function () {
    return createMockMaterial();
  });
  const MockMeshLambertMaterial = vi.fn(function () {
    return createMockMaterial();
  });
  const MockMeshBasicMaterial = vi.fn(function () {
    return createMockMaterial();
  });
  const MockMesh = vi.fn(function () {
    return createMockMesh();
  });
  const MockObject3D = vi.fn(function () {
    const obj = createMockObject3D();
    // Make it pass instanceof checks
    Object.setPrototypeOf(obj, MockObject3D.prototype);
    return obj;
  });
  // Set up the prototype chain for instanceof checks
  MockObject3D.prototype = {
    constructor: MockObject3D,
    isObject3D: true,
  };
  const MockHemisphereLight = vi.fn(function () {
    return createMockLight();
  });
  const MockDirectionalLight = vi.fn(function () {
    return createMockLight();
  });
  const MockVector3 = vi.fn(function () {
    return createMockVector3();
  });
  const MockQuaternion = vi.fn(function () {
    return createMockQuaternion();
  });

  // Mock SkinnedMesh for animation detection
  const MockSkinnedMesh = vi.fn(function () {
    return {
      ...createMockMesh(),
      isSkinnedMesh: true,
    };
  });

  // Mock additional THREE.js classes and constants
  const MockColor = vi.fn().mockImplementation((color) => ({
    r: 1,
    g: 1,
    b: 1,
    set: vi.fn(),
    setHex: vi.fn(),
    clone: vi.fn(() => ({ r: 1, g: 1, b: 1 })),
  }));

  const MockMatrix4 = vi.fn().mockImplementation(() => ({
    elements: new Array(16).fill(0),
    makeTranslation: vi.fn(),
    makeRotationFromQuaternion: vi.fn(),
    makeScale: vi.fn(),
    multiply: vi.fn(),
    copy: vi.fn(),
    clone: vi.fn(),
  }));

  return {
    Scene: MockScene,
    WebGLRenderer: MockWebGLRenderer,
    PerspectiveCamera: MockPerspectiveCamera,
    BoxGeometry: MockBoxGeometry,
    PlaneGeometry: MockPlaneGeometry,
    SphereGeometry: MockSphereGeometry,
    MeshStandardMaterial: MockMeshStandardMaterial,
    MeshLambertMaterial: MockMeshLambertMaterial,
    MeshBasicMaterial: MockMeshBasicMaterial,
    Mesh: MockMesh,
    Object3D: MockObject3D,
    SkinnedMesh: MockSkinnedMesh,
    HemisphereLight: MockHemisphereLight,
    DirectionalLight: MockDirectionalLight,
    Vector3: MockVector3,
    Quaternion: MockQuaternion,
    Color: MockColor,
    Matrix4: MockMatrix4,
  };
});

describe("ThreeRenderer", () => {
  let renderer: ThreeRenderer;
  let logger: NullLogger;
  let mockCanvas: HTMLCanvasElement;
  let entities: EntityList;
  let mockAssets: IAssetStore;

  beforeEach(() => {
    logger = new NullLogger();
    mockCanvas = document.createElement("canvas");
    entities = new EntityList();

    // Mock AssetStore
    mockAssets = {
      loadModel: vi.fn(),
      loadTexture: vi.fn(),
      loadTexture2D: vi.fn(),
      getGeometry: vi.fn(),
      getAnimations: vi.fn(),
      getMaterials: vi.fn(),
      getTexture: vi.fn(),
      getTexture2D: vi.fn(),
      get: vi.fn(),
      registerModelLoader: vi.fn(),
      registerTextureLoader: vi.fn(),
      registerTexture2DLoader: vi.fn(),
      getSupportedModelExtensions: vi.fn(),
      getSupportedTextureExtensions: vi.fn(),
      getSupportedTexture2DExtensions: vi.fn(),
      clear: vi.fn(),
    } as IAssetStore;

    // Mock window properties
    Object.defineProperty(window, "innerWidth", {
      value: 1024,
      writable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 768,
      writable: true,
    });
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      writable: true,
    });

    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create renderer with default options", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
      });

      expect(renderer).toBeDefined();
      expect(renderer.scene).toBeDefined();
      expect(renderer.renderer).toBeDefined();
      expect(renderer.camera).toBeDefined();
    });

    it("should create renderer with custom canvas", () => {
      renderer = new ThreeRenderer({
        canvas: mockCanvas,
        logger,
        assets: mockAssets,
      });

      expect(THREE.WebGLRenderer).toHaveBeenCalledWith({
        canvas: mockCanvas,
        antialias: true,
      });
    });

    it("should create renderer with custom dimensions", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
        width: 1920,
        height: 1080,
      });

      expect(renderer.renderer.setSize).toHaveBeenCalledWith(1920, 1080, false);
    });

    it("should create renderer with custom clear color", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
        clearColor: 0x222222,
      });

      expect(renderer.renderer.setClearColor).toHaveBeenCalledWith(0x222222);
    });

    it("should set up default lighting", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
      });

      expect(THREE.HemisphereLight).toHaveBeenCalledWith(
        0xffffff,
        0x444444,
        1.0
      );
      expect(THREE.DirectionalLight).toHaveBeenCalledWith(0xffffff, 1.0);
    });

    it("should set pixel ratio with device ratio limit", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
      });

      expect(renderer.renderer.setPixelRatio).toHaveBeenCalledWith(2); // Math.min(2, 2)
    });

    it("should set default camera position and target", () => {
      renderer = new ThreeRenderer({
        logger,
        assets: mockAssets,
      });

      expect(renderer.camera.position.set).toHaveBeenCalledWith(0, 2, 10);
      expect(renderer.camera.lookAt).toHaveBeenCalledWith(0, 0, 0);
    });
  });

  describe("resize", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should resize renderer and update camera", () => {
      renderer.resize(1600, 900);

      expect(renderer.renderer.setSize).toHaveBeenCalledWith(1600, 900, false);
      expect(renderer.camera.aspect).toBe(1600 / 900);
      expect(renderer.camera.updateProjectionMatrix).toHaveBeenCalled();
    });

    it("should handle different aspect ratios", () => {
      renderer.resize(800, 1200); // Portrait

      expect(renderer.camera.aspect).toBe(800 / 1200);
      expect(renderer.camera.updateProjectionMatrix).toHaveBeenCalled();
    });
  });

  describe("geometry creation", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should create box geometry", async () => {
      const entity = entities.createEntity();
      const renderable = {
        id: 0,
        geometry: {
          kind: "box" as const,
          size: [2, 3, 4] as [number, number, number],
        },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.BoxGeometry).toHaveBeenCalledWith(2, 3, 4);
    });

    it("should create box geometry with default size", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.BoxGeometry).toHaveBeenCalledWith(1, 1, 1);
    });

    it("should create plane geometry", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "plane" as const, size: [5, 6] as [number, number] },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.PlaneGeometry).toHaveBeenCalledWith(5, 6);
    });

    it("should create sphere geometry", async () => {
      const renderable = {
        id: 0,
        geometry: {
          kind: "sphere" as const,
          radius: 2.5,
          widthSeg: 32,
          heightSeg: 16,
        },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.SphereGeometry).toHaveBeenCalledWith(2.5, 32, 16);
    });

    it("should create sphere geometry with defaults", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "sphere" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.SphereGeometry).toHaveBeenCalledWith(0.5, 16, 12);
    });

    it("should load geometry from assets for asset type", async () => {
      const mockObject = new THREE.Object3D();
      vi.spyOn(mockObject, "clone").mockReturnValue(mockObject);
      mockAssets.getGeometry = vi.fn().mockResolvedValue(mockObject);

      const renderable = {
        id: 0,
        geometry: {
          kind: "model" as const,
          key: "mesh/test" as any,
        },
        material: { kind: "none" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(mockAssets.getGeometry).toHaveBeenCalledWith("mesh/test");
    });

    it("should clone Object3D from assets", async () => {
      const mockObject = new THREE.Object3D();
      const cloneSpy = vi
        .spyOn(mockObject, "clone")
        .mockReturnValue(mockObject);
      mockAssets.getGeometry = vi.fn().mockResolvedValue(mockObject);

      const renderable = {
        id: 0,
        geometry: {
          kind: "model" as const,
          key: "model/test" as any,
        },
        material: { kind: "none" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(mockAssets.getGeometry).toHaveBeenCalledWith("model/test");
      expect(cloneSpy).toHaveBeenCalledWith(true);
    });
  });

  describe("material creation", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should create standard material", async () => {
      const entity = entities.createEntity();
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: {
          kind: "standard" as const,
          color: 0xff0000,
          roughness: 0.7,
          metalness: 0.3,
        },
      };

      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith({
        color: 0xff0000,
        roughness: 0.7,
        metalness: 0.3,
      });
    });

    it("should create lambert material", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "lambert" as const, color: 0x00ff00 },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.MeshLambertMaterial).toHaveBeenCalledWith({
        color: 0x00ff00,
      });
    });

    it("should create basic material", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "basic" as const, color: 0x0000ff },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({
        color: 0x0000ff,
      });
    });

    it("should use default colors when not specified", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.8,
      });
    });

    it("should load material from assets for asset type", async () => {
      const mockMaterial = new THREE.MeshStandardMaterial();
      mockAssets.get = vi.fn().mockResolvedValue(mockMaterial);

      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: {
          kind: "asset" as const,
          key: "material/test" as any,
        },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(mockAssets.getTexture).toHaveBeenCalledWith("material/test");
    });

    it("should handle none material type", async () => {
      const mockObject = new THREE.Object3D();
      const cloneSpy = vi
        .spyOn(mockObject, "clone")
        .mockReturnValue(mockObject);
      mockAssets.getGeometry = vi.fn().mockResolvedValue(mockObject);

      const renderable = {
        id: 0,
        geometry: { kind: "model" as const, key: "model/test" as any },
        material: { kind: "none" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      // Should create Object3D without separate material
      expect(mockAssets.getGeometry).toHaveBeenCalledWith("model/test");
      expect(cloneSpy).toHaveBeenCalledWith(true);
    });
  });

  describe("renderable management", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should add renderable to scene", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
      expect(renderer.scene.add).toHaveBeenCalled();
    });

    it("should apply render flags", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
        flags: {
          visible: false,
          castShadow: true,
          receiveShadow: true,
          layer: 2,
        },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
    });

    it("should apply world transform if available", async () => {
      const entity = entities.createEntity();
      entities.set(entity, WorldTransform, {
        position: new THREE.Vector3(1, 2, 3),
        rotation: new THREE.Quaternion(0, 0, 0, 1),
        scale: new THREE.Vector3(2, 2, 2),
      });

      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
    });

    it("should remove renderable from scene", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);
      renderer.removeRenderable(entity, 0);

      expect(renderer.scene.remove).toHaveBeenCalled();
    });

    it("should handle removing non-existent renderable", () => {
      expect(() => renderer.removeRenderable(999, 0)).not.toThrow();
    });

    it("should update existing mesh geometry when upserted", async () => {
      const entity = entities.createEntity();
      const renderableId = 0;

      // First create with box geometry
      const renderable1 = {
        id: renderableId,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable1);

      // Then update with sphere geometry
      const renderable2 = {
        id: renderableId,
        geometry: { kind: "sphere" as const },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable2);

      // Should create both geometries
      expect(THREE.BoxGeometry).toHaveBeenCalledWith(1, 1, 1);
      expect(THREE.SphereGeometry).toHaveBeenCalledWith(0.5, 16, 12);
    });

    it("should update existing mesh material when upserted", async () => {
      const entity = entities.createEntity();
      const renderableId = 0;

      // First create with standard material
      const renderable1 = {
        id: renderableId,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable1);

      // Then update with basic material
      const renderable2 = {
        id: renderableId,
        geometry: { kind: "box" as const },
        material: { kind: "basic" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable2);

      // Should create both materials
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledWith({
        color: 0xffffff,
        metalness: 0,
        roughness: 0.8,
      });
      expect(THREE.MeshBasicMaterial).toHaveBeenCalledWith({
        color: 0xffffff,
      });
    });

    it("should replace mesh with Object3D when geometry type changes", async () => {
      const mockObject = new THREE.Object3D();
      vi.spyOn(mockObject, "clone").mockReturnValue(mockObject);
      mockAssets.getGeometry = vi.fn().mockResolvedValue(mockObject);

      const entity = entities.createEntity();
      const renderableId = 0;

      // First create with procedural geometry (creates Mesh)
      const renderable1 = {
        id: renderableId,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable1);

      // Then update with asset geometry (creates Object3D)
      const renderable2 = {
        id: renderableId,
        geometry: {
          kind: "model" as const,
          key: "model/test" as any,
        },
        material: { kind: "none" as const },
      };

      await renderer.upsertRenderable(entities, entity, renderable2);

      // Should remove old object and create new one
      expect(renderer.scene.remove).toHaveBeenCalled();

      // Check that scene.add was called for both the initial renderable and the replacement
      // Note: The constructor also adds lights to the scene (HemisphereLight + DirectionalLight)
      // So we expect: 2 lights + 1 initial mesh + 1 replacement object = 4 calls
      expect(renderer.scene.add).toHaveBeenCalledTimes(4);
    });

    it("should throw error when material is required but missing", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: undefined as any,
      };

      const entity = entities.createEntity();
      await expect(
        renderer.upsertRenderable(entities, entity, renderable)
      ).rejects.toThrow("Cannot read properties of undefined");
    });
  });

  describe("transform synchronization", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should sync transforms for entities with WorldTransform and Renderable", async () => {
      const entity = entities.createEntity();

      entities.set(entity, WorldTransform, {
        position: new THREE.Vector3(5, 10, 15),
        rotation: new THREE.Quaternion(0, 0, 0, 1),
        scale: new THREE.Vector3(1.5, 1.5, 1.5),
      });

      entities.set(entity, Renderable, {
        id: 0,
        geometry: { kind: "box" },
        material: { kind: "standard" },
      });

      // First upsert to create the mesh
      await renderer.upsertRenderable(
        entities,
        entity,
        entities.get(entity, Renderable)
      );

      // Then sync transforms
      renderer.syncTransforms(entities);

      // The mock mesh should have transform methods called
      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
    });

    it("should handle entities without renderables gracefully", () => {
      const entity = entities.createEntity();
      entities.set(entity, WorldTransform, {
        position: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(0, 0, 0, 1),
        scale: new THREE.Vector3(1, 1, 1),
      });

      expect(() => renderer.syncTransforms(entities)).not.toThrow();
    });

    it("should skip entities without world transform", async () => {
      const entity = entities.createEntity();
      entities.set(entity, Renderable, {
        id: 0,
        geometry: { kind: "box" },
        material: { kind: "standard" },
      });

      await renderer.upsertRenderable(
        entities,
        entity,
        entities.get(entity, Renderable)
      );

      expect(() => renderer.syncTransforms(entities)).not.toThrow();
    });
  });

  describe("rendering", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should render the scene", () => {
      renderer.render();

      expect(renderer.renderer.render).toHaveBeenCalledWith(
        renderer.scene,
        renderer.camera
      );
    });
  });

  describe("caching", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should cache geometries with same description", async () => {
      const renderable1 = {
        id: 0,
        geometry: {
          kind: "box" as const,
          size: [2, 2, 2] as [number, number, number],
        },
        material: { kind: "standard" as const },
      };

      const renderable2 = {
        id: 1,
        geometry: {
          kind: "box" as const,
          size: [2, 2, 2] as [number, number, number],
        },
        material: { kind: "standard" as const },
      };

      const entity1 = entities.createEntity();
      const entity2 = entities.createEntity();
      await renderer.upsertRenderable(entities, entity1, renderable1);
      await renderer.upsertRenderable(entities, entity2, renderable2);

      // Should only create geometry once due to caching
      expect(THREE.BoxGeometry).toHaveBeenCalledTimes(1);
    });

    it("should cache materials with same description", async () => {
      const renderable1 = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const, color: 0xff0000 },
      };

      const renderable2 = {
        id: 1,
        geometry: { kind: "sphere" as const },
        material: { kind: "standard" as const, color: 0xff0000 },
      };

      const entity1 = entities.createEntity();
      const entity2 = entities.createEntity();
      await renderer.upsertRenderable(entities, entity1, renderable1);
      await renderer.upsertRenderable(entities, entity2, renderable2);

      // Should only create material once due to caching
      expect(THREE.MeshStandardMaterial).toHaveBeenCalledTimes(1);
    });

    it("should create different geometries for different descriptions", async () => {
      const renderable1 = {
        id: 0,
        geometry: {
          kind: "box" as const,
          size: [1, 1, 1] as [number, number, number],
        },
        material: { kind: "standard" as const },
      };

      const renderable2 = {
        id: 1,
        geometry: {
          kind: "box" as const,
          size: [2, 2, 2] as [number, number, number],
        },
        material: { kind: "standard" as const },
      };

      const entity1 = entities.createEntity();
      const entity2 = entities.createEntity();
      await renderer.upsertRenderable(entities, entity1, renderable1);
      await renderer.upsertRenderable(entities, entity2, renderable2);

      // Should create two different geometries
      expect(THREE.BoxGeometry).toHaveBeenCalledTimes(2);
    });
  });

  describe("disposal", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should dispose of renderer and caches", async () => {
      // Create some renderables first
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      renderer.dispose();

      expect(renderer.scene.remove).toHaveBeenCalled();
      expect(renderer.renderer.dispose).toHaveBeenCalled();
    });

    it("should clear all objects from scene on disposal", async () => {
      const renderable1 = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const renderable2 = {
        id: 1,
        geometry: { kind: "sphere" as const },
        material: { kind: "basic" as const },
      };

      const entity1 = entities.createEntity();
      const entity2 = entities.createEntity();
      await renderer.upsertRenderable(entities, entity1, renderable1);
      await renderer.upsertRenderable(entities, entity2, renderable2);

      renderer.dispose();

      // Should remove all objects from scene
      expect(renderer.scene.remove).toHaveBeenCalledTimes(2);
    });
  });

  describe("flag application", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should apply default flags when none provided", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
      // Default flags: visible=true, castShadow=false, receiveShadow=false, layer=0
    });

    it("should apply custom flags", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
        flags: {
          visible: false,
          castShadow: true,
          receiveShadow: true,
          layer: 5,
        },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
      // Custom flags should be applied to the mesh
    });

    it("should apply partial flags with defaults", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "standard" as const },
        flags: {
          visible: false,
          // castShadow, receiveShadow, layer should use defaults
        },
      };

      const entity = entities.createEntity();
      await renderer.upsertRenderable(entities, entity, renderable);

      expect(THREE.Mesh).toHaveBeenCalledWith(
        expect.objectContaining({ dispose: expect.any(Function) }),
        expect.objectContaining({ dispose: expect.any(Function) })
      );
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      renderer = new ThreeRenderer({ logger, assets: mockAssets });
    });

    it("should throw error for unknown geometry kind", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "unknown" as any },
        material: { kind: "standard" as const },
      };

      const entity = entities.createEntity();
      await expect(
        renderer.upsertRenderable(entities, entity, renderable)
      ).rejects.toThrow("Unknown geometry kind:");
    });

    it("should throw error for unknown material kind", async () => {
      const renderable = {
        id: 0,
        geometry: { kind: "box" as const },
        material: { kind: "unknown" as any },
      };

      const entity = entities.createEntity();
      await expect(
        renderer.upsertRenderable(entities, entity, renderable)
      ).rejects.toThrow("Unknown material kind:");
    });
  });
});

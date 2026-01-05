import { describe, it, expect } from "vitest";
import {
  Renderable,
  Camera,
  type GeometryDesc,
  type MaterialDesc,
  type RenderFlags,
} from "@/core/Renderer/renderComponents";
import { assetKey } from "@/core/Assets/AssetStore";

describe("Render Components", () => {
  describe("assetKey", () => {
    it("should create asset key from string", () => {
      const key = assetKey("test-asset");
      expect(key).toBe("test-asset");
      expect(typeof key).toBe("string");
    });

    it("should work with different asset keys", () => {
      const key1 = assetKey("geometry/box");
      const key2 = assetKey("material/metal");

      expect(key1).toBe("geometry/box");
      expect(key2).toBe("material/metal");
      expect(key1).not.toBe(key2);
    });
  });

  describe("Renderable component", () => {
    it("should be defined as component", () => {
      expect(Renderable).toBeDefined();
      expect(typeof Renderable).toBe("symbol");
    });

    it("should work with basic geometry and material", () => {
      // Use the actual type structure from the component definition
      type RenderableType = {
        id: number;
        geometry: GeometryDesc;
        material: MaterialDesc;
        flags?: RenderFlags;
        batchKey?: string;
      };

      const renderable: RenderableType = {
        id: 0,
        geometry: { kind: "box", size: [2, 2, 2] },
        material: { kind: "standard", color: 0xff0000 },
      };

      expect(renderable.id).toBe(0);
      expect(renderable.geometry.kind).toBe("box");
      expect(renderable.material.kind).toBe("standard");
    });

    it("should support different geometry types", () => {
      const boxGeometry = {
        kind: "box" as const,
        size: [1, 2, 3] as [number, number, number],
      };
      const planeGeometry = {
        kind: "plane" as const,
        size: [5, 10] as [number, number],
      };
      const sphereGeometry = {
        kind: "sphere" as const,
        radius: 2.5,
        widthSeg: 32,
        heightSeg: 16,
      };
      const assetGeometry = {
        kind: "model" as const,
        key: assetKey("mesh/character"),
      };

      expect(boxGeometry.kind).toBe("box");
      expect(boxGeometry.size).toEqual([1, 2, 3]);

      expect(planeGeometry.kind).toBe("plane");
      expect(planeGeometry.size).toEqual([5, 10]);

      expect(sphereGeometry.kind).toBe("sphere");
      expect(sphereGeometry.radius).toBe(2.5);
      expect(sphereGeometry.widthSeg).toBe(32);
      expect(sphereGeometry.heightSeg).toBe(16);

      expect(assetGeometry.kind).toBe("model");
      expect(assetGeometry.key).toBe("mesh/character");
    });

    it("should support different material types", () => {
      const standardMaterial = {
        kind: "standard" as const,
        color: 0xff0000,
        roughness: 0.8,
        metalness: 0.2,
      };
      const lambertMaterial = { kind: "lambert" as const, color: 0x00ff00 };
      const basicMaterial = { kind: "basic" as const, color: 0x0000ff };
      const assetMaterial = {
        kind: "asset" as const,
        key: assetKey("material/metal"),
      };

      expect(standardMaterial.kind).toBe("standard");
      expect(standardMaterial.color).toBe(0xff0000);
      expect(standardMaterial.roughness).toBe(0.8);
      expect(standardMaterial.metalness).toBe(0.2);

      expect(lambertMaterial.kind).toBe("lambert");
      expect(lambertMaterial.color).toBe(0x00ff00);

      expect(basicMaterial.kind).toBe("basic");
      expect(basicMaterial.color).toBe(0x0000ff);

      expect(assetMaterial.kind).toBe("asset");
      expect(assetMaterial.key).toBe("material/metal");
    });

    it("should support render flags", () => {
      type RenderableType = {
        id: number;
        geometry: GeometryDesc;
        material: MaterialDesc;
        flags?: RenderFlags;
        batchKey?: string;
      };

      const renderable: RenderableType = {
        id: 1,
        geometry: { kind: "sphere" },
        material: { kind: "standard" },
        flags: {
          visible: true,
          castShadow: true,
          receiveShadow: false,
          layer: 2,
        },
      };

      expect(renderable.flags?.visible).toBe(true);
      expect(renderable.flags?.castShadow).toBe(true);
      expect(renderable.flags?.receiveShadow).toBe(false);
      expect(renderable.flags?.layer).toBe(2);
    });

    it("should support optional batch key", () => {
      type RenderableType = {
        id: number;
        geometry: GeometryDesc;
        material: MaterialDesc;
        flags?: RenderFlags;
        batchKey?: string;
      };

      const renderable: RenderableType = {
        id: 2,
        geometry: { kind: "box" },
        material: { kind: "basic" },
        batchKey: "trees",
      };

      expect(renderable.batchKey).toBe("trees");
    });

    it("should work with minimal configuration", () => {
      type RenderableType = {
        id: number;
        geometry: GeometryDesc;
        material: MaterialDesc;
        flags?: RenderFlags;
        batchKey?: string;
      };

      const minimalRenderable: RenderableType = {
        id: 0,
        geometry: { kind: "box" },
        material: { kind: "standard" },
      };

      expect(minimalRenderable.id).toBe(0);
      expect(minimalRenderable.geometry.kind).toBe("box");
      expect(minimalRenderable.material.kind).toBe("standard");
      expect(minimalRenderable.flags).toBeUndefined();
      expect(minimalRenderable.batchKey).toBeUndefined();
    });
  });

  describe("Camera component", () => {
    it("should be defined as component", () => {
      expect(Camera).toBeDefined();
      expect(typeof Camera).toBe("symbol");
    });

    it("should work with camera configuration", () => {
      type CameraType = {
        fov: number;
        near: number;
        far: number;
        active?: boolean;
      };

      const camera: CameraType = {
        fov: 60,
        near: 0.1,
        far: 1000,
        active: true,
      };

      expect(camera.fov).toBe(60);
      expect(camera.near).toBe(0.1);
      expect(camera.far).toBe(1000);
      expect(camera.active).toBe(true);
    });

    it("should work with minimal camera configuration", () => {
      type CameraType = {
        fov: number;
        near: number;
        far: number;
        active?: boolean;
      };

      const camera: CameraType = {
        fov: 75,
        near: 0.01,
        far: 2000,
      };

      expect(camera.fov).toBe(75);
      expect(camera.near).toBe(0.01);
      expect(camera.far).toBe(2000);
      expect(camera.active).toBeUndefined();
    });

    it("should support different camera settings", () => {
      type CameraType = {
        fov: number;
        near: number;
        far: number;
        active?: boolean;
      };

      const wideAngleCamera: CameraType = {
        fov: 90,
        near: 0.1,
        far: 500,
        active: true,
      };

      const telephotoCamera: CameraType = {
        fov: 35,
        near: 1,
        far: 5000,
        active: false,
      };

      expect(wideAngleCamera.fov).toBe(90);
      expect(wideAngleCamera.active).toBe(true);

      expect(telephotoCamera.fov).toBe(35);
      expect(telephotoCamera.active).toBe(false);
    });
  });

  describe("type safety", () => {
    it("should enforce geometry type constraints", () => {
      // These should compile without errors
      const boxGeom: GeometryDesc = { kind: "box" };
      const planeGeom: GeometryDesc = { kind: "plane", size: [2, 3] };
      const sphereGeom: GeometryDesc = { kind: "sphere", radius: 1 };

      expect(boxGeom.kind).toBe("box");
      expect(planeGeom.kind).toBe("plane");
      expect(sphereGeom.kind).toBe("sphere");
    });

    it("should enforce material type constraints", () => {
      // These should compile without errors
      const standardMat: MaterialDesc = { kind: "standard" };
      const lambertMat: MaterialDesc = { kind: "lambert", color: 0xffffff };
      const basicMat: MaterialDesc = { kind: "basic", color: 0x000000 };

      expect(standardMat.kind).toBe("standard");
      expect(lambertMat.kind).toBe("lambert");
      expect(basicMat.kind).toBe("basic");
    });

    it("should work with complex renderable configurations", () => {
      type RenderableType = {
        id: number;
        geometry: GeometryDesc;
        material: MaterialDesc;
        flags?: RenderFlags;
        batchKey?: string;
      };

      const complexRenderable: RenderableType = {
        id: 42,
        geometry: {
          kind: "sphere",
          radius: 1.5,
          widthSeg: 32,
          heightSeg: 16,
        },
        material: {
          kind: "standard",
          color: 0x4a90e2,
          roughness: 0.3,
          metalness: 0.7,
        },
        flags: {
          visible: true,
          castShadow: true,
          receiveShadow: true,
          layer: 1,
        },
        batchKey: "metallic-spheres",
      };

      expect(complexRenderable.id).toBe(42);
      expect(complexRenderable.geometry.kind).toBe("sphere");
      expect(complexRenderable.material.kind).toBe("standard");
      expect(complexRenderable.flags?.castShadow).toBe(true);
      expect(complexRenderable.batchKey).toBe("metallic-spheres");
    });
  });
});

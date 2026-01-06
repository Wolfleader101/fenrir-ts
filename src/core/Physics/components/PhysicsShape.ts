import { Vector3 } from "three";
import { defineComponent } from "../../ECS/Component";

/**
 * Supported physics shape types
 */
export const ShapeType = {
  Box: "box",
  Sphere: "sphere",
  Capsule: "capsule",
  Cylinder: "cylinder",
  ConvexHull: "convexHull",
  Compound: "compound",
  Mesh: "mesh",
  HeightField: "heightField",
} as const;

export type ShapeType = (typeof ShapeType)[keyof typeof ShapeType];

/**
 * Box shape parameters
 */
export type BoxShapeParams = {
  readonly halfExtents: Vector3; // Half-extents in each dimension
};

/**
 * Sphere shape parameters
 */
export type SphereShapeParams = {
  readonly radius: number;
};

/**
 * Capsule shape parameters
 */
export type CapsuleShapeParams = {
  readonly halfHeight: number; // Half height of cylindrical section
  readonly radius: number; // Radius of caps and cylinder
};

/**
 * Cylinder shape parameters
 */
export type CylinderShapeParams = {
  readonly halfHeight: number; // Half height of cylinder
  readonly radius: number; // Radius of cylinder
};

/**
 * Convex hull shape parameters
 */
export type ConvexHullShapeParams = {
  readonly points: readonly Vector3[]; // Vertices that define the hull
  readonly maxConvexRadius?: number; // Maximum convex radius for rounding
};

/**
 * Compound shape parameters
 */
export type CompoundShapeParams = {
  readonly subShapes: readonly {
    readonly shape: PhysicsShape;
    readonly position: Vector3;
    readonly rotation: { x: number; y: number; z: number; w: number };
  }[];
};

/**
 * Mesh shape parameters (for static complex geometry)
 */
export type MeshShapeParams = {
  readonly vertices: readonly number[]; // Vertex positions (flat array)
  readonly indices: readonly number[]; // Triangle indices
};

/**
 * Height field shape parameters (for terrain)
 */
export type HeightFieldShapeParams = {
  readonly heights: readonly number[]; // Height values
  readonly sampleCount: number; // Number of samples per dimension
  readonly scale: Vector3; // Scale in each dimension
  readonly offset?: number; // Height offset
};

/**
 * Union of all shape parameter types
 */
export type ShapeParams =
  | BoxShapeParams
  | SphereShapeParams
  | CapsuleShapeParams
  | CylinderShapeParams
  | ConvexHullShapeParams
  | CompoundShapeParams
  | MeshShapeParams
  | HeightFieldShapeParams;

/**
 * Physics shape component that defines collision geometry
 */
export type PhysicsShape = {
  readonly shapeType: ShapeType; // Type of shape
  readonly parameters: ShapeParams; // Shape-specific parameters
  readonly convexRadius?: number; // Shape rounding radius
  readonly centerOfMass?: Vector3; // Local center of mass offset
  readonly userData?: unknown; // Custom user data
};

export const PhysicsShape = defineComponent<PhysicsShape>("PhysicsShape");

/**
 * Helper functions to create specific shape types
 */
export const ShapeBuilder = {
  box: (halfExtents: Vector3, convexRadius?: number): PhysicsShape => ({
    shapeType: ShapeType.Box,
    parameters: { halfExtents: halfExtents.clone() },
    convexRadius,
  }),

  sphere: (radius: number): PhysicsShape => ({
    shapeType: ShapeType.Sphere,
    parameters: { radius },
  }),

  capsule: (
    halfHeight: number,
    radius: number,
    convexRadius?: number
  ): PhysicsShape => ({
    shapeType: ShapeType.Capsule,
    parameters: { halfHeight, radius },
    convexRadius,
  }),

  cylinder: (
    halfHeight: number,
    radius: number,
    convexRadius?: number
  ): PhysicsShape => ({
    shapeType: ShapeType.Cylinder,
    parameters: { halfHeight, radius },
    convexRadius,
  }),

  convexHull: (points: Vector3[], maxConvexRadius?: number): PhysicsShape => ({
    shapeType: ShapeType.ConvexHull,
    parameters: {
      points: points.map((p) => p.clone()),
      maxConvexRadius,
    },
  }),

  mesh: (vertices: number[], indices: number[]): PhysicsShape => ({
    shapeType: ShapeType.Mesh,
    parameters: { vertices: [...vertices], indices: [...indices] },
  }),

  heightField: (
    heights: number[],
    sampleCount: number,
    scale: Vector3,
    offset?: number
  ): PhysicsShape => ({
    shapeType: ShapeType.HeightField,
    parameters: {
      heights: [...heights],
      sampleCount,
      scale: scale.clone(),
      offset,
    },
  }),
} as const;

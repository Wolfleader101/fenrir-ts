import type { Vector3, Quaternion } from "three";
import initJolt from "jolt-physics/wasm-compat";
import type Jolt from "jolt-physics/wasm-compat";

/**
 * Runtime module type (what you get back from `await initJolt()`).
 * Keep this if you pass the loaded module around.
 */
export type JoltModule = Awaited<ReturnType<typeof initJolt>>;

// Type aliases for commonly used Jolt types
export type JoltVec3 = Jolt.Vec3;
export type JoltRVec3 = Jolt.RVec3;
export type JoltQuat = Jolt.Quat;

export type JoltBody = Jolt.Body;
export type JoltBodyID = Jolt.BodyID;
export type JoltBodyInterface = Jolt.BodyInterface;
export type JoltPhysicsSystem = Jolt.PhysicsSystem;
export type JoltBodyCreationSettings = Jolt.BodyCreationSettings;

export type JoltShape = Jolt.Shape;
export type JoltBoxShape = Jolt.BoxShape;
export type JoltSphereShape = Jolt.SphereShape;
export type JoltCapsuleShape = Jolt.CapsuleShape;
export type JoltCylinderShape = Jolt.CylinderShape;

export type JoltInterface = Jolt.JoltInterface;
export type JoltSettings = Jolt.JoltSettings;

export type JoltEMotionType = Jolt.EMotionType;
export type JoltEActivation = Jolt.EActivation;

export type JoltRMat44 = Jolt.RMat44;

/**
 * Color class used by debug renderer
 */
export interface JoltColor {
  mU32: number;
}

/**
 * Extended types for debug renderer (only available in debug builds)
 * These properties are not in the standard Jolt type definitions
 */
export interface JoltDebugModule extends JoltModule {
  readonly DebugRendererJS: new () => JoltDebugRendererJS;
  readonly DebugRendererVertexTraits: {
    prototype: {
      mPositionOffset: number;
      mNormalOffset: number;
      mUVOffset: number;
      mSize: number;
    };
  };
  readonly DebugRendererTriangleTraits: {
    prototype: {
      mVOffset: number;
      mSize: number;
    };
  };
  readonly EDrawMode_Wireframe: number;
  readonly ECullMode_Off: number;
  readonly ECullMode_CullBackFace: number;
  readonly ECullMode_CullFrontFace: number;
  readonly Color: { new (): JoltColor };
  readonly HEAPF32: Float32Array;
  readonly HEAPU32: Uint32Array;
}

export interface JoltDebugRendererJS {
  Initialize(): void;
  DrawBodies(physicsSystem: JoltPhysicsSystem, drawSettings: unknown): void;
  DrawConstraints(physicsSystem: JoltPhysicsSystem): void;
  DrawConstraintLimits(physicsSystem: JoltPhysicsSystem): void;
  DrawLine: (inFrom: number, inTo: number, inColor: number) => void;
  DrawTriangle: (
    inV1: number,
    inV2: number,
    inV3: number,
    inColor: number,
    inCastShadow: number
  ) => void;
  DrawText3D: (
    inPosition: number,
    inStringPtr: number,
    inStringLen: number,
    inColor: number,
    inHeight: number
  ) => void;
  DrawGeometryWithID: (
    inModelMatrix: number,
    inWorldSpaceBounds: number,
    inLODScaleSq: number,
    inModelColor: number,
    inGeometryID: number,
    inCullMode: number,
    inCastShadow: number,
    inDrawMode: number
  ) => void;
  CreateTriangleBatchID: (
    inTriangles: number,
    inTriangleCount: number
  ) => number;
  CreateTriangleBatchIDWithIndex: (
    inVertices: number,
    inVertexCount: number,
    inIndices: number,
    inIndexCount: number
  ) => number;
}

/**
 * Type guard to check if Jolt module has debug renderer
 */
export function isDebugJolt(jolt: JoltModule): jolt is JoltDebugModule {
  return "DebugRendererJS" in jolt;
}

/**
 * Wrapper utilities for converting between Three.js and Jolt types
 *
 */
export class JoltUtils {
  static vec3ToJolt(jolt: JoltModule, vec: Vector3): JoltVec3 {
    return new jolt.Vec3(vec.x, vec.y, vec.z);
  }

  static vec3ToJoltR(jolt: JoltModule, vec: Vector3): JoltRVec3 {
    return new jolt.RVec3(vec.x, vec.y, vec.z);
  }

  static quatToJolt(jolt: JoltModule, quat: Quaternion): JoltQuat {
    return new jolt.Quat(quat.x, quat.y, quat.z, quat.w);
  }

  static joltVec3ToThree(joltVec: JoltVec3, out: Vector3): Vector3 {
    return out.set(joltVec.GetX(), joltVec.GetY(), joltVec.GetZ());
  }

  static joltRVec3ToThree(joltVec: JoltRVec3, out: Vector3): Vector3 {
    return out.set(joltVec.GetX(), joltVec.GetY(), joltVec.GetZ());
  }

  static joltQuatToThree(joltQuat: JoltQuat, out: Quaternion): Quaternion {
    return out.set(
      joltQuat.GetX(),
      joltQuat.GetY(),
      joltQuat.GetZ(),
      joltQuat.GetW()
    );
  }
}

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

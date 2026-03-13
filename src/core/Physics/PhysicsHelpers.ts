import type { Vector3 } from "three";
import type { PhysicsBody } from "./components/PhysicsBody";
import {
  JoltUtils,
  type JoltModule,
  type JoltBodyInterface,
} from "./utils/JoltWrapper";

/**
 * Physics helper class for manipulating physics bodies
 *
 * This class is instantiated by PhysicsSystem and provided via SystemCtx
 */
export class PhysicsHelpers {
  private readonly jolt: JoltModule;
  private readonly bodyInterface: JoltBodyInterface;

  constructor(jolt: JoltModule, bodyInterface: JoltBodyInterface) {
    this.jolt = jolt;
    this.bodyInterface = bodyInterface;
  }

  /**
   * Apply an impulse to a physics body (instantaneous velocity change)
   * Automatically wakes up sleeping bodies
   */
  applyImpulse(physicsBody: PhysicsBody, impulse: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping (required for impulses to work)
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltImpulse = JoltUtils.vec3ToJolt(this.jolt, impulse);
    physicsBody.joltBody.AddImpulse(joltImpulse);
    this.jolt.destroy(joltImpulse);
  }

  /**
   * Add force to a physics body (continuous acceleration)
   * Automatically wakes up sleeping bodies
   */
  addForce(physicsBody: PhysicsBody, force: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltForce = JoltUtils.vec3ToJolt(this.jolt, force);
    physicsBody.joltBody.AddForce(joltForce);
    this.jolt.destroy(joltForce);
  }

  /**
   * Add torque to a physics body (rotational force)
   * Automatically wakes up sleeping bodies
   */
  addTorque(physicsBody: PhysicsBody, torque: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltTorque = JoltUtils.vec3ToJolt(this.jolt, torque);
    physicsBody.joltBody.AddTorque(joltTorque);
    this.jolt.destroy(joltTorque);
  }

  /**
   * Apply an angular impulse to a physics body
   * Automatically wakes up sleeping bodies
   */
  applyAngularImpulse(physicsBody: PhysicsBody, impulse: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltImpulse = JoltUtils.vec3ToJolt(this.jolt, impulse);
    physicsBody.joltBody.AddAngularImpulse(joltImpulse);
    this.jolt.destroy(joltImpulse);
  }

  /**
   * Get the current linear velocity of a physics body
   */
  getVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3 {
    if (!physicsBody.joltBody) {
      return out.set(0, 0, 0);
    }

    const joltVel = physicsBody.joltBody.GetLinearVelocity();
    return JoltUtils.joltVec3ToThree(joltVel, out);
  }

  /**
   * Set the linear velocity of a physics body
   * Automatically wakes up sleeping bodies
   */
  setVelocity(physicsBody: PhysicsBody, velocity: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltVel = JoltUtils.vec3ToJolt(this.jolt, velocity);
    physicsBody.joltBody.SetLinearVelocity(joltVel);
    this.jolt.destroy(joltVel);
  }

  /**
   * Get the current angular velocity of a physics body
   */
  getAngularVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3 {
    if (!physicsBody.joltBody) {
      return out.set(0, 0, 0);
    }

    const joltVel = physicsBody.joltBody.GetAngularVelocity();
    return JoltUtils.joltVec3ToThree(joltVel, out);
  }

  /**
   * Set the angular velocity of a physics body
   * Automatically wakes up sleeping bodies
   */
  setAngularVelocity(physicsBody: PhysicsBody, velocity: Vector3): void {
    if (!physicsBody.joltBody || !physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }

    // Wake up the body if it's sleeping
    this.bodyInterface.ActivateBody(physicsBody.bodyId);

    const joltVel = JoltUtils.vec3ToJolt(this.jolt, velocity);
    physicsBody.joltBody.SetAngularVelocity(joltVel);
    this.jolt.destroy(joltVel);
  }

  /**
   * Check if the physics body is active (not sleeping)
   */
  isActive(physicsBody: PhysicsBody): boolean {
    if (!physicsBody.joltBody) {
      return false;
    }
    return physicsBody.joltBody.IsActive();
  }

  /**
   * Activate (wake up) a physics body
   * Useful to force a body awake before applying physics operations
   */
  activate(physicsBody: PhysicsBody): void {
    if (!physicsBody.bodyId) {
      console.warn("Physics body not initialized");
      return;
    }
    this.bodyInterface.ActivateBody(physicsBody.bodyId);
  }

  /**
   * Get the mass of a physics body
   */
  getMass(physicsBody: PhysicsBody): number {
    if (!physicsBody.joltBody) {
      return 0;
    }
    const motionProperties = physicsBody.joltBody.GetMotionProperties();
    return 1.0 / motionProperties.GetInverseMass();
  }

  /**
   * Set friction for a physics body
   */
  setFriction(physicsBody: PhysicsBody, friction: number): void {
    if (!physicsBody.joltBody) {
      console.warn("Physics body not initialized");
      return;
    }
    physicsBody.joltBody.SetFriction(friction);
  }

  /**
   * Set restitution (bounciness) for a physics body
   */
  setRestitution(physicsBody: PhysicsBody, restitution: number): void {
    if (!physicsBody.joltBody) {
      console.warn("Physics body not initialized");
      return;
    }
    physicsBody.joltBody.SetRestitution(restitution);
  }
}

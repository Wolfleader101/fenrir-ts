import { Vector3 } from "three";
import { defineComponent } from "../../ECS/Component";

/**
 * Physics forces component for accumulating forces and impulses to apply to bodies
 */
export type PhysicsForces = {
  force: Vector3; // Accumulated force (N)
  torque: Vector3; // Accumulated torque (N⋅m)
  impulse: Vector3; // Impulse to apply (N⋅s)
  angularImpulse: Vector3; // Angular impulse to apply (N⋅m⋅s)
};

export const PhysicsForces = defineComponent<PhysicsForces>("PhysicsForces");

/**
 * Helper function to create a physics forces component
 */
export function createPhysicsForces(): PhysicsForces {
  return {
    force: new Vector3(),
    torque: new Vector3(),
    impulse: new Vector3(),
    angularImpulse: new Vector3(),
  };
}

/**
 * Add a force to be applied at the center of mass
 */
export function addForce(forces: PhysicsForces, force: Vector3): void {
  forces.force.add(force);
}

/**
 * Add a force at a specific world position (creates torque if not at COM)
 */
export function addForceAtPosition(
  forces: PhysicsForces,
  force: Vector3,
  position: Vector3,
  centerOfMass: Vector3
): void {
  forces.force.add(force);

  // Calculate torque: r × F
  const r = position.clone().sub(centerOfMass);
  const torque = r.cross(force);
  forces.torque.add(torque);
}

/**
 * Add torque directly
 */
export function addTorque(forces: PhysicsForces, torque: Vector3): void {
  forces.torque.add(torque);
}

/**
 * Add an impulse to be applied at the center of mass
 */
export function addImpulse(forces: PhysicsForces, impulse: Vector3): void {
  forces.impulse.add(impulse);
}

/**
 * Add an impulse at a specific world position
 */
export function addImpulseAtPosition(
  forces: PhysicsForces,
  impulse: Vector3,
  position: Vector3,
  centerOfMass: Vector3
): void {
  forces.impulse.add(impulse);

  // Calculate angular impulse: r × J
  const r = position.clone().sub(centerOfMass);
  const angularImpulse = r.cross(impulse);
  forces.angularImpulse.add(angularImpulse);
}

/**
 * Add angular impulse directly
 */
export function addAngularImpulse(
  forces: PhysicsForces,
  angularImpulse: Vector3
): void {
  forces.angularImpulse.add(angularImpulse);
}

/**
 * Clear all accumulated forces and impulses (typically called after physics step)
 */
export function clearForces(forces: PhysicsForces): void {
  forces.force.set(0, 0, 0);
  forces.torque.set(0, 0, 0);
  forces.impulse.set(0, 0, 0);
  forces.angularImpulse.set(0, 0, 0);
}

/**
 * Check if there are any forces or impulses to apply
 */
export function hasForces(forces: PhysicsForces): boolean {
  return (
    forces.force.lengthSq() > 0 ||
    forces.torque.lengthSq() > 0 ||
    forces.impulse.lengthSq() > 0 ||
    forces.angularImpulse.lengthSq() > 0
  );
}

/**
 * Common force generators for convenience
 */
export const ForceGenerators = {
  /**
   * Generate gravity force for a given mass
   */
  gravity: (mass: number, gravity = new Vector3(0, -9.81, 0)): Vector3 => {
    return gravity.clone().multiplyScalar(mass);
  },

  /**
   * Generate drag force based on velocity and drag coefficient
   */
  drag: (velocity: Vector3, dragCoefficient: number): Vector3 => {
    const speed = velocity.length();
    if (speed === 0) return new Vector3();

    const dragMagnitude = dragCoefficient * speed * speed;
    return velocity.clone().normalize().multiplyScalar(-dragMagnitude);
  },

  /**
   * Generate spring force towards a target position
   */
  spring: (
    currentPosition: Vector3,
    targetPosition: Vector3,
    springConstant: number,
    restLength = 0
  ): Vector3 => {
    const displacement = targetPosition.clone().sub(currentPosition);
    const distance = displacement.length();

    if (distance === 0) return new Vector3();

    const force = (distance - restLength) * springConstant;
    return displacement.normalize().multiplyScalar(force);
  },

  /**
   * Generate damping force opposing velocity
   */
  damping: (velocity: Vector3, dampingConstant: number): Vector3 => {
    return velocity.clone().multiplyScalar(-dampingConstant);
  },
} as const;

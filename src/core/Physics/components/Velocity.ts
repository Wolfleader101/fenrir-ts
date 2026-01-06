import { Vector3 } from "three";
import { defineComponent } from "../../ECS/Component";

/**
 * Velocity component for kinematic control and physics queries
 */
export type Velocity = {
  linear: Vector3; // Linear velocity (m/s)
  angular: Vector3; // Angular velocity (rad/s)
};

export const Velocity = defineComponent<Velocity>("Velocity");

/**
 * Helper function to create a velocity component
 */
export function createVelocity(linear?: Vector3, angular?: Vector3): Velocity {
  return {
    linear: linear?.clone() ?? new Vector3(),
    angular: angular?.clone() ?? new Vector3(),
  };
}

/**
 * Helper function to set linear velocity
 */
export function setLinearVelocity(velocity: Velocity, linear: Vector3): void {
  velocity.linear.copy(linear);
}

/**
 * Helper function to set angular velocity
 */
export function setAngularVelocity(velocity: Velocity, angular: Vector3): void {
  velocity.angular.copy(angular);
}

/**
 * Helper function to add to linear velocity
 */
export function addLinearVelocity(velocity: Velocity, delta: Vector3): void {
  velocity.linear.add(delta);
}

/**
 * Helper function to add to angular velocity
 */
export function addAngularVelocity(velocity: Velocity, delta: Vector3): void {
  velocity.angular.add(delta);
}

/**
 * Helper function to get speed (magnitude of linear velocity)
 */
export function getSpeed(velocity: Velocity): number {
  return velocity.linear.length();
}

/**
 * Helper function to get angular speed (magnitude of angular velocity)
 */
export function getAngularSpeed(velocity: Velocity): number {
  return velocity.angular.length();
}

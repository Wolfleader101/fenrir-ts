import { defineComponent } from "../../ECS/Component";

/**
 * Motion types for physics bodies
 */
export const MotionType = {
  Static: 0, // Immovable object (infinite mass)
  Kinematic: 1, // Movable by animation/code (infinite mass)
  Dynamic: 2, // Fully simulated rigid body (finite mass)
} as const;

export type MotionType = (typeof MotionType)[keyof typeof MotionType];

/**
 * Synchronization strategies between physics and transform components
 */
export const SyncMode = {
  None: 0, // No synchronization
  PhysicsToTransform: 1, // Physics drives Transform (for dynamic bodies)
  TransformToPhysics: 2, // Transform drives physics (for kinematic bodies)
  Bidirectional: 3, // Two-way sync (special cases)
} as const;

export type SyncMode = (typeof SyncMode)[keyof typeof SyncMode];

/**
 * Core physics body component that stores Jolt body reference and metadata
 */
export type PhysicsBody = {
  readonly bodyId?: number; // Jolt BodyID reference (set by physics system)
  readonly motionType: MotionType; // Body motion type
  readonly layer: number; // Collision layer
  readonly syncMode: SyncMode; // Transform synchronization strategy
  readonly mass?: number; // Body mass (for dynamic bodies)
  readonly gravityFactor?: number; // Gravity multiplier (1.0 = normal)
  readonly allowSleeping?: boolean; // Can body go to sleep for optimization
  readonly isSensor?: boolean; // Is this a trigger/sensor body
};

export const PhysicsBody = defineComponent<PhysicsBody>("PhysicsBody");

/**
 * Helper function to create a physics body configuration
 */
export function createPhysicsBody(config: {
  bodyId?: number;
  motionType: MotionType;
  layer?: number;
  syncMode?: SyncMode;
  mass?: number;
  gravityFactor?: number;
  allowSleeping?: boolean;
  isSensor?: boolean;
}): PhysicsBody {
  const syncMode =
    config.syncMode ??
    (config.motionType === MotionType.Dynamic
      ? SyncMode.PhysicsToTransform
      : config.motionType === MotionType.Kinematic
      ? SyncMode.TransformToPhysics
      : SyncMode.None);

  return {
    bodyId: config.bodyId,
    motionType: config.motionType,
    layer: config.layer ?? 0,
    syncMode,
    mass: config.mass,
    gravityFactor: config.gravityFactor ?? 1.0,
    allowSleeping: config.allowSleeping ?? true,
    isSensor: config.isSensor ?? false,
  };
}

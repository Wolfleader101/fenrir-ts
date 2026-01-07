import { defineComponent } from "../../ECS/Component";
import type { CollisionLayer, CollisionMask } from "../utils/CollisionLayers";
import { CommonLayers, CollisionMasks } from "../utils/CollisionLayers";

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
  readonly collisionLayer: CollisionLayer; // Which collision layer this body is on (32-bit)
  readonly collisionMask: CollisionMask; // Which layers this body can collide with (32-bit mask)
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
  collisionLayer?: CollisionLayer;
  collisionMask?: CollisionMask;
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

  // Default collision layer based on motion type
  const defaultLayer =
    config.motionType === MotionType.Static
      ? CommonLayers.STATIC
      : config.motionType === MotionType.Dynamic
      ? CommonLayers.DYNAMIC
      : CommonLayers.KINEMATIC;

  // Default collision mask based on motion type
  const defaultMask =
    config.motionType === MotionType.Static
      ? CollisionMasks.static()
      : config.motionType === MotionType.Dynamic
      ? CollisionMasks.dynamic()
      : CollisionMasks.dynamic(); // Kinematic uses same as dynamic for now

  return {
    bodyId: config.bodyId,
    motionType: config.motionType,
    collisionLayer: config.collisionLayer ?? defaultLayer,
    collisionMask: config.collisionMask ?? defaultMask,
    syncMode,
    mass: config.mass,
    gravityFactor: config.gravityFactor ?? 1.0,
    allowSleeping: config.allowSleeping ?? true,
    isSensor: config.isSensor ?? false,
  };
}

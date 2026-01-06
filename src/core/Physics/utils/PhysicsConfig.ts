import { Vector3 } from "three";
import type { LayerManager } from "./LayerManager";
import { defaultLayerManager } from "./LayerManager";

/**
 * Physics world configuration
 */
export interface PhysicsConfig {
  /**
   * Maximum number of physics bodies that can exist simultaneously
   */
  readonly maxBodies: number;

  /**
   * Maximum number of body pairs that can be in contact
   */
  readonly maxBodyPairs: number;

  /**
   * Maximum number of contact constraints
   */
  readonly maxContactConstraints: number;

  /**
   * World gravity vector
   */
  readonly gravity: Vector3;

  /**
   * Layer manager for collision detection
   */
  readonly layerManager: LayerManager;

  /**
   * Number of collision steps per physics update
   */
  readonly collisionSteps: number;

  /**
   * Physics simulation timestep (in seconds)
   */
  readonly timeStep: number;

  /**
   * Enable/disable sleeping for performance optimization
   */
  readonly enableSleeping: boolean;

  /**
   * Warm start solver (improves stability)
   */
  readonly warmStart: boolean;

  /**
   * Enable continuous collision detection
   */
  readonly enableCCD: boolean;

  /**
   * Debug physics simulation (enables extra validation)
   */
  readonly debugMode: boolean;
}

/**
 * Default physics configuration
 */
export const DefaultPhysicsConfig: PhysicsConfig = {
  maxBodies: 10240,
  maxBodyPairs: 65536,
  maxContactConstraints: 65536,
  gravity: new Vector3(0, -9.81, 0),
  layerManager: defaultLayerManager,
  collisionSteps: 1,
  timeStep: 1.0 / 60.0,
  enableSleeping: true,
  warmStart: true,
  enableCCD: false,
  debugMode: false,
};

/**
 * Helper function to create a physics configuration with overrides
 */
export function createPhysicsConfig(
  overrides: Partial<PhysicsConfig> = {}
): PhysicsConfig {
  return {
    ...DefaultPhysicsConfig,
    ...overrides,
    // Clone objects that might be modified
    gravity: overrides.gravity?.clone() ?? DefaultPhysicsConfig.gravity.clone(),
    layerManager:
      overrides.layerManager ?? DefaultPhysicsConfig.layerManager.clone(),
  };
}

/**
 * Predefined physics configurations for common scenarios
 */
export const PhysicsPresets = {
  /**
   * Default configuration - balanced performance and quality
   */
  default: (): PhysicsConfig => createPhysicsConfig(),

  /**
   * High performance configuration - fewer bodies, reduced quality
   */
  performance: (): PhysicsConfig =>
    createPhysicsConfig({
      maxBodies: 2048,
      maxBodyPairs: 8192,
      maxContactConstraints: 2048,
      collisionSteps: 1,
      enableCCD: false,
    }),

  /**
   * High quality configuration - more stable simulation
   */
  quality: (): PhysicsConfig =>
    createPhysicsConfig({
      maxBodies: 20480,
      maxBodyPairs: 131072,
      maxContactConstraints: 20480,
      collisionSteps: 2,
      enableCCD: true,
    }),

  /**
   * Mobile/low-end device configuration
   */
  mobile: (): PhysicsConfig =>
    createPhysicsConfig({
      maxBodies: 512,
      maxBodyPairs: 2048,
      maxContactConstraints: 512,
      collisionSteps: 1,
      enableSleeping: true,
      enableCCD: false,
    }),

  /**
   * Zero gravity space simulation
   */
  space: (): PhysicsConfig =>
    createPhysicsConfig({
      gravity: new Vector3(0, 0, 0),
      enableSleeping: false, // Objects don't settle in zero gravity
    }),

  /**
   * Low gravity (moon-like) simulation
   */
  lowGravity: (): PhysicsConfig =>
    createPhysicsConfig({
      gravity: new Vector3(0, -1.62, 0), // Moon gravity
    }),

  /**
   * High gravity simulation
   */
  highGravity: (): PhysicsConfig =>
    createPhysicsConfig({
      gravity: new Vector3(0, -19.62, 0), // 2x Earth gravity
    }),

  /**
   * 2D physics simulation (no Z-axis movement)
   */
  twoDimensional: (): PhysicsConfig =>
    createPhysicsConfig({
      // Note: 2D constraints would need to be implemented in the physics system
      enableCCD: false,
    }),
} as const;

/**
 * Validate physics configuration
 */
export function validatePhysicsConfig(config: PhysicsConfig): string[] {
  const errors: string[] = [];

  if (config.maxBodies <= 0) {
    errors.push("maxBodies must be greater than 0");
  }

  if (config.maxBodyPairs <= 0) {
    errors.push("maxBodyPairs must be greater than 0");
  }

  if (config.maxContactConstraints <= 0) {
    errors.push("maxContactConstraints must be greater than 0");
  }

  if (config.collisionSteps <= 0) {
    errors.push("collisionSteps must be greater than 0");
  }

  if (config.timeStep <= 0 || config.timeStep > 1.0) {
    errors.push("timeStep must be between 0 and 1.0");
  }

  if (config.maxBodyPairs < config.maxBodies) {
    errors.push("maxBodyPairs should be at least equal to maxBodies");
  }

  if (config.maxContactConstraints < config.maxBodyPairs) {
    errors.push(
      "maxContactConstraints should be at least equal to maxBodyPairs"
    );
  }

  return errors;
}

/**
 * Get recommended configuration based on target performance
 */
export function getRecommendedConfig(
  targetFps: number,
  maxBodies: number
): PhysicsConfig {
  if (targetFps >= 60 && maxBodies <= 1000) {
    return PhysicsPresets.default();
  } else if (targetFps >= 30 && maxBodies <= 2000) {
    return PhysicsPresets.performance();
  } else if (targetFps >= 60 && maxBodies > 2000) {
    return PhysicsPresets.quality();
  } else {
    return PhysicsPresets.mobile();
  }
}

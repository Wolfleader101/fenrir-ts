import { defineComponent } from "../../ECS/Component";

/**
 * Material combine modes for how two materials interact
 */
export const CombineMode = {
  Average: 0, // (a + b) / 2
  Min: 1, // min(a, b)
  Multiply: 2, // a * b
  Max: 3, // max(a, b)
} as const;

export type CombineMode = (typeof CombineMode)[keyof typeof CombineMode];

/**
 * Physics material component that defines surface properties
 */
export type PhysicsMaterial = {
  readonly restitution: number; // Bounciness [0-1]
  readonly friction: number; // Surface friction [0+]
  readonly density: number; // Material density for mass calculation
  readonly restitutionCombineMode?: CombineMode; // How restitution combines with other materials
  readonly frictionCombineMode?: CombineMode; // How friction combines with other materials
  readonly linearDamping?: number; // Linear velocity damping [0-1]
  readonly angularDamping?: number; // Angular velocity damping [0-1]
  readonly userData?: unknown; // Custom user data
};

export const PhysicsMaterial =
  defineComponent<PhysicsMaterial>("PhysicsMaterial");

/**
 * Helper function to create a physics material with sensible defaults
 */
export function createPhysicsMaterial(config: {
  restitution?: number;
  friction?: number;
  density?: number;
  restitutionCombineMode?: CombineMode;
  frictionCombineMode?: CombineMode;
  linearDamping?: number;
  angularDamping?: number;
  userData?: unknown;
}): PhysicsMaterial {
  return {
    restitution: config.restitution ?? 0.5,
    friction: config.friction ?? 0.7,
    density: config.density ?? 1000.0, // kg/m³ (water density)
    restitutionCombineMode:
      config.restitutionCombineMode ?? CombineMode.Average,
    frictionCombineMode: config.frictionCombineMode ?? CombineMode.Multiply,
    linearDamping: config.linearDamping ?? 0.05,
    angularDamping: config.angularDamping ?? 0.05,
    userData: config.userData,
  };
}

/**
 * Predefined common materials for convenience
 */
export const CommonMaterials = {
  /**
   * Default material with balanced properties
   */
  default: (): PhysicsMaterial => createPhysicsMaterial({}),

  /**
   * Bouncy ball material
   */
  rubber: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.9,
      friction: 0.8,
      density: 1200, // kg/m³
    }),

  /**
   * Metal material - heavy, low bounce, medium friction
   */
  metal: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.2,
      friction: 0.6,
      density: 7800, // kg/m³ (steel)
    }),

  /**
   * Wood material - medium properties
   */
  wood: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.4,
      friction: 0.7,
      density: 600, // kg/m³
    }),

  /**
   * Ice material - slippery, medium bounce
   */
  ice: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.3,
      friction: 0.1,
      density: 917, // kg/m³
    }),

  /**
   * Stone/concrete material - heavy, no bounce, high friction
   */
  stone: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.1,
      friction: 0.9,
      density: 2400, // kg/m³ (concrete)
    }),

  /**
   * Foam material - light, high bounce, high friction
   */
  foam: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.8,
      friction: 1.2,
      density: 100, // kg/m³
    }),

  /**
   * Glass material - medium-heavy, low bounce, medium friction
   */
  glass: (): PhysicsMaterial =>
    createPhysicsMaterial({
      restitution: 0.2,
      friction: 0.5,
      density: 2500, // kg/m³
    }),
} as const;

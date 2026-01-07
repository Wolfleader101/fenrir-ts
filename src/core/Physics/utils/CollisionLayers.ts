/**
 * 32-bit collision layer system similar to Godot
 * Each layer is represented as a single bit (1, 2, 4, 8, etc.)
 * Collision masks are bitwise combinations of layers
 */

export type CollisionLayer = number; // Single bit (1 << 0, 1 << 1, etc.)
export type CollisionMask = number; // Bitwise combination of layers

/**
 * Default layer definitions (users can define their own)
 */
export const DefaultLayers = {
  LAYER_1: 1 << 0, // Bit 0 (value: 1)
  LAYER_2: 1 << 1, // Bit 1 (value: 2)
  LAYER_3: 1 << 2, // Bit 2 (value: 4)
  LAYER_4: 1 << 3, // Bit 3 (value: 8)
  LAYER_5: 1 << 4, // Bit 4 (value: 16)
  LAYER_6: 1 << 5, // Bit 5 (value: 32)
  LAYER_7: 1 << 6, // Bit 6 (value: 64)
  LAYER_8: 1 << 7, // Bit 7 (value: 128)
  // ... up to 32 layers (1 << 31)
} as const;

/**
 * Commonly used layer presets for convenience
 */
export const CommonLayers = {
  STATIC: 1 << 0, // Static world geometry
  DYNAMIC: 1 << 1, // Dynamic physics objects
  KINEMATIC: 1 << 2, // Moving platforms, elevators
  CHARACTER: 1 << 3, // Player/NPC controllers
  TRIGGER: 1 << 4, // Sensors, pickups, damage zones
  PROJECTILE: 1 << 5, // Bullets, rockets
  DEBRIS: 1 << 6, // Small objects, particles
  VEHICLE: 1 << 7, // Cars, ships
} as const;

/**
 * Layer naming system for user customization
 */
export class PhysicsLayerManager {
  private static layerNames: string[] = Array(32)
    .fill(null)
    .map((_, i) => `Layer ${i + 1}`);
  private static layerDescriptions: string[] = Array(32).fill("");

  /**
   * Set a custom name for a layer
   */
  static setLayerName(layerIndex: number, name: string): void {
    if (layerIndex >= 0 && layerIndex < 32) {
      this.layerNames[layerIndex] = name;
    }
  }

  /**
   * Set a description for a layer
   */
  static setLayerDescription(layerIndex: number, description: string): void {
    if (layerIndex >= 0 && layerIndex < 32) {
      this.layerDescriptions[layerIndex] = description;
    }
  }

  /**
   * Get the name of a layer by index
   */
  static getLayerName(layerIndex: number): string {
    return this.layerNames[layerIndex] ?? `Layer ${layerIndex + 1}`;
  }

  /**
   * Get the description of a layer by index
   */
  static getLayerDescription(layerIndex: number): string {
    return this.layerDescriptions[layerIndex] ?? "";
  }

  /**
   * Get all configured layers
   */
  static getAllLayers(): Array<{
    index: number;
    name: string;
    description: string;
    bit: number;
  }> {
    return this.layerNames.map((name, index) => ({
      index,
      name,
      description: this.layerDescriptions[index] ?? "",
      bit: 1 << index,
    }));
  }

  /**
   * Get layer index from layer bit value
   */
  static getLayerIndex(layer: CollisionLayer): number {
    return Math.log2(layer);
  }

  /**
   * Setup common layer names for convenience
   */
  static setupCommonLayers(): void {
    this.setLayerName(0, "Static");
    this.setLayerName(1, "Dynamic");
    this.setLayerName(2, "Kinematic");
    this.setLayerName(3, "Character");
    this.setLayerName(4, "Trigger");
    this.setLayerName(5, "Projectile");
    this.setLayerName(6, "Debris");
    this.setLayerName(7, "Vehicle");

    this.setLayerDescription(0, "Static world geometry (walls, floors)");
    this.setLayerDescription(1, "Dynamic physics objects");
    this.setLayerDescription(2, "Moving platforms and elevators");
    this.setLayerDescription(3, "Player and NPC controllers");
    this.setLayerDescription(4, "Sensors, pickups, trigger zones");
    this.setLayerDescription(5, "Bullets, projectiles, fast objects");
    this.setLayerDescription(6, "Small debris and particle effects");
    this.setLayerDescription(7, "Vehicles, large moving objects");
  }
}

/**
 * Bitwise collision utilities for fast layer operations
 */
export class CollisionUtils {
  /**
   * Check if a layer is present in a collision mask
   */
  static hasLayer(mask: CollisionMask, layer: CollisionLayer): boolean {
    return (mask & layer) !== 0;
  }

  /**
   * Add a layer to a collision mask
   */
  static addLayer(mask: CollisionMask, layer: CollisionLayer): CollisionMask {
    return mask | layer;
  }

  /**
   * Remove a layer from a collision mask
   */
  static removeLayer(
    mask: CollisionMask,
    layer: CollisionLayer
  ): CollisionMask {
    return mask & ~layer;
  }

  /**
   * Check if two objects can collide based on layer and mask
   */
  static canCollide(
    layer1: CollisionLayer,
    mask1: CollisionMask,
    layer2: CollisionLayer,
    mask2: CollisionMask
  ): boolean {
    return (layer1 & mask2) !== 0 || (layer2 & mask1) !== 0;
  }

  /**
   * Create a collision mask from multiple layers
   */
  static createMask(...layers: CollisionLayer[]): CollisionMask {
    return layers.reduce((mask, layer) => mask | layer, 0);
  }

  /**
   * Get all layers present in a collision mask
   */
  static getLayersFromMask(mask: CollisionMask): CollisionLayer[] {
    const layers: CollisionLayer[] = [];
    for (let i = 0; i < 32; i++) {
      const layer = 1 << i;
      if (this.hasLayer(mask, layer)) {
        layers.push(layer);
      }
    }
    return layers;
  }

  /**
   * Convert a collision mask to human-readable layer names
   */
  static maskToNames(mask: CollisionMask): string[] {
    return this.getLayersFromMask(mask).map((layer) => {
      const index = PhysicsLayerManager.getLayerIndex(layer);
      return PhysicsLayerManager.getLayerName(index);
    });
  }

  /**
   * Create a collision mask that collides with all layers
   */
  static allLayersMask(): CollisionMask {
    return 0xffffffff; // All 32 bits set
  }

  /**
   * Create an empty collision mask (collides with nothing)
   */
  static emptyMask(): CollisionMask {
    return 0;
  }
}

/**
 * Helper to create common collision mask combinations
 */
export const CollisionMasks = {
  /**
   * Static objects: collide with dynamic, kinematic, character, projectile, vehicle
   */
  static: (): CollisionMask =>
    CollisionUtils.createMask(
      CommonLayers.DYNAMIC,
      CommonLayers.KINEMATIC,
      CommonLayers.CHARACTER,
      CommonLayers.PROJECTILE,
      CommonLayers.VEHICLE
    ),

  /**
   * Dynamic objects: collide with everything except triggers and debris
   */
  dynamic: (): CollisionMask =>
    CollisionUtils.createMask(
      CommonLayers.STATIC,
      CommonLayers.DYNAMIC,
      CommonLayers.KINEMATIC,
      CommonLayers.CHARACTER,
      CommonLayers.PROJECTILE,
      CommonLayers.VEHICLE
    ),

  /**
   * Character controllers: collide with static, kinematic, triggers, vehicles
   */
  character: (): CollisionMask =>
    CollisionUtils.createMask(
      CommonLayers.STATIC,
      CommonLayers.KINEMATIC,
      CommonLayers.TRIGGER,
      CommonLayers.VEHICLE
    ),

  /**
   * Triggers: collide with character, dynamic, projectile
   */
  trigger: (): CollisionMask =>
    CollisionUtils.createMask(
      CommonLayers.CHARACTER,
      CommonLayers.DYNAMIC,
      CommonLayers.PROJECTILE
    ),

  /**
   * Projectiles: collide with static, dynamic, character
   */
  projectile: (): CollisionMask =>
    CollisionUtils.createMask(
      CommonLayers.STATIC,
      CommonLayers.DYNAMIC,
      CommonLayers.CHARACTER
    ),

  /**
   * Collide with all layers
   */
  all: (): CollisionMask => CollisionUtils.allLayersMask(),

  /**
   * Collide with nothing (sensor objects)
   */
  none: (): CollisionMask => CollisionUtils.emptyMask(),
} as const;

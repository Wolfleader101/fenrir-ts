/**
 * Physics layer configuration for collision detection
 */

/**
 * Default collision layers
 */
export const CollisionLayers = {
  STATIC: 0, // Static geometry (walls, floors, etc.)
  DYNAMIC: 1, // Dynamic objects (physics bodies)
  KINEMATIC: 2, // Kinematic objects (moving platforms)
  TRIGGER: 3, // Trigger/sensor volumes
  CHARACTER: 4, // Character controllers
  PROJECTILE: 5, // Fast-moving projectiles
  DEBRIS: 6, // Small debris objects
  VEHICLE: 7, // Vehicles
} as const;

export type CollisionLayer =
  (typeof CollisionLayers)[keyof typeof CollisionLayers];

/**
 * Broad phase layers for optimization
 */
export const BroadPhaseLayers = {
  STATIC: 0, // Non-moving objects
  MOVING: 1, // Moving objects
  SENSORS: 2, // Sensor/trigger objects
} as const;

export type BroadPhaseLayer =
  (typeof BroadPhaseLayers)[keyof typeof BroadPhaseLayers];

/**
 * Layer mapping configuration
 */
export interface LayerMapping {
  readonly objectLayer: CollisionLayer;
  readonly broadPhaseLayer: BroadPhaseLayer;
  readonly canCollideWith: readonly CollisionLayer[];
}

/**
 * Default layer configuration
 */
export const DefaultLayerMappings: readonly LayerMapping[] = [
  // Static objects
  {
    objectLayer: CollisionLayers.STATIC,
    broadPhaseLayer: BroadPhaseLayers.STATIC,
    canCollideWith: [
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.CHARACTER,
      CollisionLayers.PROJECTILE,
      CollisionLayers.DEBRIS,
      CollisionLayers.VEHICLE,
    ],
  },

  // Dynamic objects
  {
    objectLayer: CollisionLayers.DYNAMIC,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.CHARACTER,
      CollisionLayers.PROJECTILE,
      CollisionLayers.DEBRIS,
      CollisionLayers.VEHICLE,
    ],
  },

  // Kinematic objects
  {
    objectLayer: CollisionLayers.KINEMATIC,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.CHARACTER,
      CollisionLayers.PROJECTILE,
      CollisionLayers.DEBRIS,
      CollisionLayers.VEHICLE,
    ],
  },

  // Trigger/sensor volumes
  {
    objectLayer: CollisionLayers.TRIGGER,
    broadPhaseLayer: BroadPhaseLayers.SENSORS,
    canCollideWith: [
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.CHARACTER,
      CollisionLayers.PROJECTILE,
      CollisionLayers.VEHICLE,
    ],
  },

  // Character controllers
  {
    objectLayer: CollisionLayers.CHARACTER,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.TRIGGER,
      CollisionLayers.VEHICLE,
    ],
  },

  // Projectiles
  {
    objectLayer: CollisionLayers.PROJECTILE,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.TRIGGER,
      CollisionLayers.CHARACTER,
      CollisionLayers.VEHICLE,
    ],
  },

  // Debris
  {
    objectLayer: CollisionLayers.DEBRIS,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
    ],
  },

  // Vehicles
  {
    objectLayer: CollisionLayers.VEHICLE,
    broadPhaseLayer: BroadPhaseLayers.MOVING,
    canCollideWith: [
      CollisionLayers.STATIC,
      CollisionLayers.DYNAMIC,
      CollisionLayers.KINEMATIC,
      CollisionLayers.TRIGGER,
      CollisionLayers.CHARACTER,
      CollisionLayers.PROJECTILE,
    ],
  },
] as const;

/**
 * Layer manager for setting up Jolt physics collision layers
 */
export class LayerManager {
  private readonly mappings: Map<CollisionLayer, LayerMapping>;

  constructor(mappings: readonly LayerMapping[] = DefaultLayerMappings) {
    this.mappings = new Map();
    for (const mapping of mappings) {
      this.mappings.set(mapping.objectLayer, mapping);
    }
  }

  /**
   * Get the broad phase layer for an object layer
   */
  getBroadPhaseLayer(objectLayer: CollisionLayer): BroadPhaseLayer {
    const mapping = this.mappings.get(objectLayer);
    if (!mapping) {
      throw new Error(`No mapping found for object layer ${objectLayer}`);
    }
    return mapping.broadPhaseLayer;
  }

  /**
   * Check if two object layers can collide
   */
  canLayersCollide(layer1: CollisionLayer, layer2: CollisionLayer): boolean {
    const mapping1 = this.mappings.get(layer1);
    const mapping2 = this.mappings.get(layer2);

    if (!mapping1 || !mapping2) {
      return false;
    }

    return (
      mapping1.canCollideWith.includes(layer2) ||
      mapping2.canCollideWith.includes(layer1)
    );
  }

  /**
   * Get all object layers
   */
  getObjectLayers(): CollisionLayer[] {
    return Array.from(this.mappings.keys());
  }

  /**
   * Get all broad phase layers
   */
  getBroadPhaseLayers(): BroadPhaseLayer[] {
    return Object.values(BroadPhaseLayers);
  }

  /**
   * Get the number of object layers
   */
  getNumObjectLayers(): number {
    return this.mappings.size;
  }

  /**
   * Get the number of broad phase layers
   */
  getNumBroadPhaseLayers(): number {
    return Object.keys(BroadPhaseLayers).length;
  }

  /**
   * Add or update a layer mapping
   */
  setLayerMapping(mapping: LayerMapping): void {
    this.mappings.set(mapping.objectLayer, mapping);
  }

  /**
   * Remove a layer mapping
   */
  removeLayer(objectLayer: CollisionLayer): boolean {
    return this.mappings.delete(objectLayer);
  }

  /**
   * Get collision matrix as a 2D array for debugging
   */
  getCollisionMatrix(): boolean[][] {
    const layers = this.getObjectLayers().sort((a, b) => a - b);
    const matrix: boolean[][] = [];

    for (let i = 0; i < layers.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < layers.length; j++) {
        const layer1 = layers[i];
        const layer2 = layers[j];
        if (layer1 !== undefined && layer2 !== undefined) {
          matrix[i]![j] = this.canLayersCollide(layer1, layer2);
        } else {
          matrix[i]![j] = false;
        }
      }
    }

    return matrix;
  }

  /**
   * Create a copy of this layer manager
   */
  clone(): LayerManager {
    return new LayerManager(Array.from(this.mappings.values()));
  }
}

/**
 * Default layer manager instance
 */
export const defaultLayerManager = new LayerManager();

/**
 * Helper function to get a layer name for debugging
 */
export function getLayerName(layer: CollisionLayer): string {
  for (const [name, value] of Object.entries(CollisionLayers)) {
    if (value === layer) {
      return name;
    }
  }
  return `Layer_${layer}`;
}

/**
 * Helper function to get a broad phase layer name for debugging
 */
export function getBroadPhaseLayerName(layer: BroadPhaseLayer): string {
  for (const [name, value] of Object.entries(BroadPhaseLayers)) {
    if (value === layer) {
      return name;
    }
  }
  return `BroadPhase_${layer}`;
}

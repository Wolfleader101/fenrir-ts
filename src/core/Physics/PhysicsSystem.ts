import { Vector3, Quaternion } from "three";
import initJolt from "jolt-physics/wasm-compat";
import type { SyncSystemFn, AsyncSystemFn, SystemCtx } from "../SystemCtx";
import type { Entity } from "../ECS";
import { PhysicsBody, MotionType } from "./components/PhysicsBody";
import { PhysicsShape, ShapeType } from "./components/PhysicsShape";
import { PhysicsMaterial } from "./components/PhysicsMaterial";
import { Transform } from "../ECS/DefaultComponents";
import {
  JoltUtils,
  type JoltModule,
  type JoltBody,
  type JoltVec3,
  type JoltRVec3,
  type JoltQuat,
  type JoltBodyInterface,
  type JoltPhysicsSystem,
  type JoltInterface,
  type JoltSettings,
  type JoltShape,
} from "./utils/JoltWrapper";
import {
  type CollisionLayer,
  type CollisionMask,
} from "./utils/CollisionLayers";

/**
 * Simplified PhysicsWorld interface for the new system
 */
export interface SimplePhysicsWorld {
  readonly jolt: JoltModule;
  readonly joltInterface: JoltInterface;
  readonly physicsSystem: JoltPhysicsSystem;
  readonly bodyInterface: JoltBodyInterface;
  readonly config: { gravity: Vector3 };
  readonly utils: {
    vec3ToJolt: (jolt: JoltModule, vec: Vector3) => JoltVec3;
    vec3ToJoltR: (jolt: JoltModule, vec: Vector3) => JoltRVec3;
    quatToJolt: (jolt: JoltModule, quat: Quaternion) => JoltQuat;
    joltVec3ToThree: (joltVec: JoltVec3, out: Vector3) => Vector3;
    joltRVec3ToThree: (joltVec: JoltRVec3, out: Vector3) => Vector3;
    joltQuatToThree: (joltQuat: JoltQuat, out: Quaternion) => Quaternion;
  };
  readonly isInitialized: boolean;
}

// Maximum number of collision layers (32-bit system)
const MAX_COLLISION_LAYERS = 32;

/**
 * Physics object tracking (like demo's dynamicObjects array)
 */
interface PhysicsObject {
  readonly entity: Entity;
  readonly body: JoltBody;
  readonly collisionLayer: CollisionLayer;
  readonly collisionMask: CollisionMask;
}

/**
 * Private PhysicsSystem class that encapsulates all physics state and logic
 * Following the class + factory pattern for better encapsulation and maintainability
 */
class PhysicsSystem {
  private jolt: JoltModule | null = null;
  private physicsSystem: JoltPhysicsSystem | null = null;
  private bodyInterface: JoltBodyInterface | null = null;
  private joltInterface: JoltInterface | null = null;
  private physicsObjects: PhysicsObject[] = [];

  /**
   * Get Jolt object layer from collision layer bit
   */
  private getJoltLayerFromCollisionLayer(
    collisionLayer: CollisionLayer
  ): number {
    // Convert collision layer bit to layer index (0-31)
    const layerIndex = Math.log2(collisionLayer);
    if (layerIndex < 0 || layerIndex >= 32 || !Number.isInteger(layerIndex)) {
      throw new Error(
        `Invalid collision layer: ${collisionLayer}. Must be a power of 2 (1, 2, 4, 8, etc.)`
      );
    }
    return layerIndex;
  }

  /**
   * Setup collision filtering based on Jolt docs example but with 32 layers
   */
  private setupCollisionFiltering(settings: JoltSettings): void {
    if (!this.jolt) throw new Error("Jolt not initialized");

    // Create object layer pair filter for all 32 layers
    const objectFilter = new this.jolt.ObjectLayerPairFilterTable(
      MAX_COLLISION_LAYERS
    );

    // Enable all combinations by default - we'll filter using collision masks at the body level
    // This is simpler than trying to pre-calculate all possible layer combinations
    for (let i = 0; i < MAX_COLLISION_LAYERS; i++) {
      for (let j = 0; j < MAX_COLLISION_LAYERS; j++) {
        objectFilter.EnableCollision(i, j);
      }
    }

    // Create broadphase layers - group collision layers for performance
    // Static (layer 0) vs Moving (layers 1-31) is the most important distinction
    const BP_LAYER_STATIC = new this.jolt.BroadPhaseLayer(0);
    const BP_LAYER_MOVING = new this.jolt.BroadPhaseLayer(1);
    const NUM_BROAD_PHASE_LAYERS = 2;

    const bpInterface = new this.jolt.BroadPhaseLayerInterfaceTable(
      MAX_COLLISION_LAYERS,
      NUM_BROAD_PHASE_LAYERS
    );

    // Map collision layers to broadphase layers
    // Layer 0 (static) -> static broadphase, others -> moving broadphase
    for (let i = 0; i < MAX_COLLISION_LAYERS; i++) {
      const bpLayer = i === 0 ? BP_LAYER_STATIC : BP_LAYER_MOVING;
      bpInterface.MapObjectToBroadPhaseLayer(i, bpLayer);
    }

    settings.mObjectLayerPairFilter = objectFilter;
    settings.mBroadPhaseLayerInterface = bpInterface;
    settings.mObjectVsBroadPhaseLayerFilter =
      new this.jolt.ObjectVsBroadPhaseLayerFilterTable(
        settings.mBroadPhaseLayerInterface,
        NUM_BROAD_PHASE_LAYERS,
        settings.mObjectLayerPairFilter,
        MAX_COLLISION_LAYERS
      );
  }

  /**
   * Create physics body from components (simplified version of demo's createBox/createSphere)
   */
  private createPhysicsBody(
    entity: Entity,
    physicsBody: PhysicsBody,
    physicsShape: PhysicsShape,
    physicsMaterial: PhysicsMaterial | undefined,
    transform: Transform,
    ctx: SystemCtx
  ): JoltBody | null {
    if (!this.jolt || !this.bodyInterface) {
      ctx.logger.error("Physics not initialized");
      return null;
    }

    try {
      // Create shape based on component
      let shape: JoltShape | null = null;

      switch (physicsShape.shapeType) {
        case ShapeType.Box: {
          const params = physicsShape.parameters as { halfExtents: Vector3 };
          const halfExtents = JoltUtils.vec3ToJolt(
            this.jolt,
            params.halfExtents
          );
          shape = new this.jolt.BoxShape(halfExtents, 0.05);
          this.jolt.destroy(halfExtents);
          break;
        }
        case ShapeType.Sphere: {
          const params = physicsShape.parameters as { radius: number };
          shape = new this.jolt.SphereShape(params.radius);
          break;
        }
        default:
          ctx.logger.warn(`Unsupported shape type: ${physicsShape.shapeType}`);
          return null;
      }

      if (!shape) return null;

      // Create body settings
      const position = JoltUtils.vec3ToJoltR(this.jolt, transform.position);
      const rotation = JoltUtils.quatToJolt(this.jolt, transform.rotation);

      // Determine motion type
      let motionType: number;
      switch (physicsBody.motionType) {
        case MotionType.Static:
          motionType = this.jolt.EMotionType_Static;
          break;
        case MotionType.Dynamic:
          motionType = this.jolt.EMotionType_Dynamic;
          break;
        case MotionType.Kinematic:
          motionType = this.jolt.EMotionType_Kinematic;
          break;
        default:
          motionType = this.jolt.EMotionType_Dynamic;
      }

      // Get Jolt layer from collision layer
      const joltLayer = this.getJoltLayerFromCollisionLayer(
        physicsBody.collisionLayer
      );

      const creationSettings = new this.jolt.BodyCreationSettings(
        shape,
        position,
        rotation,
        motionType,
        joltLayer
      );

      // Apply physics material properties if available
      if (physicsMaterial) {
        creationSettings.mRestitution = physicsMaterial.restitution;
        creationSettings.mFriction = physicsMaterial.friction;

        // Apply damping if specified
        if (physicsMaterial.linearDamping !== undefined) {
          creationSettings.mLinearDamping = physicsMaterial.linearDamping;
        }
        if (physicsMaterial.angularDamping !== undefined) {
          creationSettings.mAngularDamping = physicsMaterial.angularDamping;
        }

        // Apply gravity factor if specified in physics body
        if (physicsBody.gravityFactor !== undefined) {
          creationSettings.mGravityFactor = physicsBody.gravityFactor;
        }
      }

      const body = this.bodyInterface.CreateBody(creationSettings);

      // Cleanup temporary objects
      this.jolt.destroy(creationSettings);
      this.jolt.destroy(position);
      this.jolt.destroy(rotation);

      if (!body) {
        ctx.logger.error(
          `Failed to create physics body for entity ${ctx.entities.idOf(
            entity
          )}`
        );
        return null;
      }

      // Add to physics world (like demo's addToScene)
      this.bodyInterface.AddBody(body.GetID(), this.jolt.EActivation_Activate);

      ctx.logger.debug(
        `Created physics body for entity ${ctx.entities.idOf(entity)}`
      );
      return body;
    } catch (error) {
      ctx.logger.error(
        `Error creating physics body for entity ${ctx.entities.idOf(entity)}`,
        { error }
      );
      return null;
    }
  }

  /**
   * Initialize physics (like demo's initPhysics)
   */
  async initialize(ctx: SystemCtx): Promise<void> {
    try {
      ctx.logger.info("Initializing Jolt Physics...");

      // Initialize Jolt
      this.jolt = await initJolt();
      ctx.logger.info("JoltPhysics.js loaded successfully");

      const settings = new this.jolt.JoltSettings();
      settings.mMaxWorkerThreads = 3; // Limit worker threads like the demo
      this.setupCollisionFiltering(settings);

      this.joltInterface = new this.jolt.JoltInterface(settings);
      this.jolt.destroy(settings);

      this.physicsSystem = this.joltInterface.GetPhysicsSystem();
      this.bodyInterface = this.physicsSystem.GetBodyInterface();

      // Store in context for other systems (simplified PhysicsWorld interface)
      const simplePhysicsWorld: SimplePhysicsWorld = {
        jolt: this.jolt,
        joltInterface: this.joltInterface,
        physicsSystem: this.physicsSystem,
        bodyInterface: this.bodyInterface,
        config: { gravity: new Vector3(0, -9.81, 0) },
        utils: {
          vec3ToJolt: JoltUtils.vec3ToJolt,
          vec3ToJoltR: JoltUtils.vec3ToJoltR,
          quatToJolt: JoltUtils.quatToJolt,
          joltVec3ToThree: JoltUtils.joltVec3ToThree,
          joltRVec3ToThree: JoltUtils.joltRVec3ToThree,
          joltQuatToThree: JoltUtils.joltQuatToThree,
        },
        isInitialized: true,
      };

      ctx.logger.info("Physics system initialized successfully");
    } catch (error) {
      ctx.logger.error("Failed to initialize physics", { error });
      throw error;
    }
  }

  /**
   * Main simulation step
   */
  simulate(ctx: SystemCtx): void {
    if (
      !this.jolt ||
      !this.physicsSystem ||
      !this.bodyInterface ||
      !this.joltInterface
    ) {
      return; // Skip if not initialized
    }

    try {
      // Create new physics bodies for entities that need them
      ctx.entities.each(
        [PhysicsBody, PhysicsShape, Transform] as const,
        (entity, physicsBody, physicsShape, transform) => {
          // Skip if we already have a physics object for this entity
          if (this.physicsObjects.some((obj) => obj.entity === entity)) {
            return;
          }

          // Get optional physics material
          const physicsMaterial = ctx.entities.get(entity, PhysicsMaterial);

          const body = this.createPhysicsBody(
            entity,
            physicsBody,
            physicsShape,
            physicsMaterial,
            transform,
            ctx
          );
          if (body) {
            this.physicsObjects.push({
              entity,
              body,
              collisionLayer: physicsBody.collisionLayer,
              collisionMask: physicsBody.collisionMask,
            });

            // Immediately sync the initial position to prevent flickering at origin
            if (physicsBody.motionType === MotionType.Dynamic) {
              const position = body.GetPosition();
              const rotation = body.GetRotation();
              JoltUtils.joltRVec3ToThree(position, transform.position);
              JoltUtils.joltQuatToThree(rotation, transform.rotation);
            }
          }
        }
      );

      // Fixed timestep physics simulation using Time class accumulator
      while (ctx.time.accumulator >= ctx.time.tickRate) {
        this.joltInterface.Step(ctx.time.tickRate, 1);
        ctx.time.accumulator -= ctx.time.tickRate;
      }

      // Update transform components from physics (like demo's transform update loop)
      for (let i = this.physicsObjects.length - 1; i >= 0; i--) {
        const physicsObj = this.physicsObjects[i]!;
        const { entity, body } = physicsObj;

        // Check if entity still exists
        if (!ctx.entities.has(entity, Transform)) {
          // Remove from physics world and clean up
          this.bodyInterface.RemoveBody(body.GetID());
          this.bodyInterface.DestroyBody(body.GetID());
          this.physicsObjects.splice(i, 1);
          continue;
        }

        // Update transform from physics body (for dynamic bodies)
        const physicsBodyComp = ctx.entities.get(entity, PhysicsBody);
        if (physicsBodyComp?.motionType === MotionType.Dynamic) {
          const transform = ctx.entities.get(entity, Transform);
          if (transform) {
            const position = body.GetPosition();
            const rotation = body.GetRotation();

            // Update transform component (convert Jolt types to Three.js)
            JoltUtils.joltRVec3ToThree(position, transform.position);
            JoltUtils.joltQuatToThree(rotation, transform.rotation);
          }
        }
      }
    } catch (error) {
      ctx.logger.error("Error in physics simulation", { error });
    }
  }

  /**
   * Cleanup (like demo cleanup)
   */
  async cleanup(ctx: SystemCtx): Promise<void> {
    if (!this.bodyInterface || !this.jolt) return;

    try {
      // Clean up all physics objects
      for (const physicsObj of this.physicsObjects) {
        this.bodyInterface.RemoveBody(physicsObj.body.GetID());
        this.bodyInterface.DestroyBody(physicsObj.body.GetID());
      }
      this.physicsObjects.length = 0;

      // Clean up Jolt interface
      if (this.joltInterface) {
        this.jolt.destroy(this.joltInterface);
      }

      // Reset state
      this.jolt = null;
      this.physicsSystem = null;
      this.bodyInterface = null;
      this.joltInterface = null;

      ctx.logger.info("Physics system cleaned up");
    } catch (error) {
      ctx.logger.error("Error cleaning up physics", { error });
    }
  }
}

/**
 * Factory function that creates a physics system using the class + factory pattern
 * Provides clean system interface while encapsulating complex state in a private class
 */
export function createPhysicsSystem() {
  const physicsSystem = new PhysicsSystem();

  const init: AsyncSystemFn = (ctx) => physicsSystem.initialize(ctx);
  const tick: SyncSystemFn = (ctx) => physicsSystem.simulate(ctx);
  const exit: AsyncSystemFn = (ctx) => physicsSystem.cleanup(ctx);

  return {
    init,
    tick,
    exit,
  } as const;
}

/**
 * Helper functions for creating physics objects using the new collision layer system
 */
export const PhysicsHelpers = {
  /**
   * Create a static box (like demo's createFloor)
   */
  createFloor: (size = 50) => ({
    motionType: MotionType.Static,
    // Static objects use the static collision layer by default
  }),

  /**
   * Create a dynamic box (like demo's createBox)
   */
  createDynamicBox: (mass = 1.0) => ({
    motionType: MotionType.Dynamic,
    mass,
    // Dynamic objects use the dynamic collision layer by default
  }),

  /**
   * Create a dynamic sphere (like demo's createSphere)
   */
  createDynamicSphere: (mass = 1.0) => ({
    motionType: MotionType.Dynamic,
    mass,
    // Dynamic objects use the dynamic collision layer by default
  }),
} as const;

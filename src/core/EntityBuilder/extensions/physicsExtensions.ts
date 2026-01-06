import { Vector3 } from "three";
import { EntityBuilder } from "../EntityBuilder";
import {
  PhysicsBody,
  PhysicsShape,
  PhysicsMaterial,
  MotionType,
  SyncMode,
  ShapeBuilder,
  CommonMaterials,
} from "../../Physics";
import { createPhysicsBody } from "../../Physics/components/PhysicsBody";

declare module "../EntityBuilder" {
  interface EntityBuilder {
    /**
     * Adds a physics body with the specified motion type
     */
    physicsBody(config: {
      motionType: MotionType;
      layer?: number;
      syncMode?: SyncMode;
      mass?: number;
      gravityFactor?: number;
      allowSleeping?: boolean;
      isSensor?: boolean;
    }): EntityBuilder;

    /**
     * Adds a box physics shape
     */
    physicsBox(halfExtents: Vector3, convexRadius?: number): EntityBuilder;

    /**
     * Adds a sphere physics shape
     */
    physicsSphere(radius: number): EntityBuilder;

    /**
     * Adds a capsule physics shape
     */
    physicsCapsule(halfHeight: number, radius: number): EntityBuilder;

    /**
     * Adds a cylinder physics shape
     */
    physicsCylinder(
      halfHeight: number,
      radius: number,
      convexRadius?: number
    ): EntityBuilder;

    /**
     * Adds a physics material
     */
    physicsMaterial(preset?: keyof typeof CommonMaterials): EntityBuilder;

    /**
     * Creates a dynamic physics body with box shape (common pattern)
     */
    dynamicBox(halfExtents: Vector3, mass?: number): EntityBuilder;

    /**
     * Creates a dynamic physics body with sphere shape (common pattern)
     */
    dynamicSphere(radius: number, mass?: number): EntityBuilder;

    /**
     * Creates a static physics body with box shape (common pattern)
     */
    staticBox(halfExtents: Vector3): EntityBuilder;

    /**
     * Creates a static physics body with sphere shape (common pattern)
     */
    staticSphere(radius: number): EntityBuilder;

    /**
     * Creates a kinematic physics body with box shape (common pattern)
     */
    kinematicBox(halfExtents: Vector3): EntityBuilder;
  }
}

EntityBuilder.prototype.physicsBody = function (config) {
  // Determine default sync mode based on motion type
  const defaultSyncMode =
    config.motionType === MotionType.Dynamic
      ? SyncMode.PhysicsToTransform
      : config.motionType === MotionType.Kinematic
      ? SyncMode.TransformToPhysics
      : SyncMode.None; // Static bodies don't need sync

  return this.with(
    PhysicsBody,
    createPhysicsBody({
      bodyId: 0, // Will be set by PhysicsBodySystem
      motionType: config.motionType,
      layer: config.layer ?? 0,
      syncMode: config.syncMode ?? defaultSyncMode,
      mass: config.mass,
      gravityFactor: config.gravityFactor,
      allowSleeping: config.allowSleeping,
      isSensor: config.isSensor,
    })
  );
};

EntityBuilder.prototype.physicsBox = function (halfExtents, convexRadius) {
  return this.with(PhysicsShape, ShapeBuilder.box(halfExtents, convexRadius));
};

EntityBuilder.prototype.physicsSphere = function (radius) {
  return this.with(PhysicsShape, ShapeBuilder.sphere(radius));
};

EntityBuilder.prototype.physicsCapsule = function (halfHeight, radius) {
  return this.with(PhysicsShape, ShapeBuilder.capsule(halfHeight, radius));
};

EntityBuilder.prototype.physicsCylinder = function (
  halfHeight,
  radius,
  convexRadius
) {
  return this.with(
    PhysicsShape,
    ShapeBuilder.cylinder(halfHeight, radius, convexRadius)
  );
};

EntityBuilder.prototype.physicsMaterial = function (preset = "default") {
  return this.with(PhysicsMaterial, CommonMaterials[preset]());
};

// Convenience methods for common patterns
EntityBuilder.prototype.dynamicBox = function (halfExtents, mass) {
  return this.physicsBody({ motionType: MotionType.Dynamic, mass })
    .physicsBox(halfExtents)
    .physicsMaterial("default");
};

EntityBuilder.prototype.dynamicSphere = function (radius, mass) {
  return this.physicsBody({ motionType: MotionType.Dynamic, mass })
    .physicsSphere(radius)
    .physicsMaterial("rubber");
};

EntityBuilder.prototype.staticBox = function (halfExtents) {
  return this.physicsBody({ motionType: MotionType.Static })
    .physicsBox(halfExtents)
    .physicsMaterial("stone");
};

EntityBuilder.prototype.staticSphere = function (radius) {
  return this.physicsBody({ motionType: MotionType.Static })
    .physicsSphere(radius)
    .physicsMaterial("stone");
};

EntityBuilder.prototype.kinematicBox = function (halfExtents) {
  return this.physicsBody({ motionType: MotionType.Kinematic })
    .physicsBox(halfExtents)
    .physicsMaterial("default");
};

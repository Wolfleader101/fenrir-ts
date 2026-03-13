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
  CollisionUtils,
} from "../../Physics";
import type { CollisionLayer, CollisionMask } from "../../Physics";
import { createPhysicsBody } from "../../Physics/components/PhysicsBody";

declare module "../EntityBuilder" {
  interface EntityBuilder {
    /**
     * Adds a physics body with the specified motion type and collision layers
     */
    physicsBody(config: {
      motionType: MotionType;
      collisionLayer?: CollisionLayer;
      collisionMask?: CollisionMask;
      syncMode?: SyncMode;
      mass?: number;
      gravityFactor?: number;
      allowSleeping?: boolean;
      isSensor?: boolean;
    }): EntityBuilder;

    /**
     * Set collision layer for physics body (Godot-style)
     */
    collisionLayer(layer: CollisionLayer): EntityBuilder;

    /**
     * Set collision mask for physics body (Godot-style)
     */
    collisionMask(mask: CollisionMask): EntityBuilder;

    /**
     * Set which layers this body can collide with (convenience method)
     */
    collidesWith(...layers: CollisionLayer[]): EntityBuilder;

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
      convexRadius?: number,
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
      // bodyId and joltBody will be set by PhysicsSystem
      motionType: config.motionType,
      collisionLayer: config.collisionLayer,
      collisionMask: config.collisionMask,
      syncMode: config.syncMode ?? defaultSyncMode,
      mass: config.mass,
      gravityFactor: config.gravityFactor,
      allowSleeping: config.allowSleeping,
      isSensor: config.isSensor,
    }),
  );
};

EntityBuilder.prototype.collisionLayer = function (layer) {
  return this.modify(PhysicsBody, (body) => {
    if (!body) {
      throw new Error(
        "PhysicsBody component must be added before setting collision layer",
      );
    }
    return {
      ...body,
      collisionLayer: layer,
    };
  });
};

EntityBuilder.prototype.collisionMask = function (mask) {
  return this.modify(PhysicsBody, (body) => {
    if (!body) {
      throw new Error(
        "PhysicsBody component must be added before setting collision mask",
      );
    }
    return {
      ...body,
      collisionMask: mask,
    };
  });
};

EntityBuilder.prototype.collidesWith = function (...layers) {
  const mask = CollisionUtils.createMask(...layers);
  return this.collisionMask(mask);
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
  convexRadius,
) {
  return this.with(
    PhysicsShape,
    ShapeBuilder.cylinder(halfHeight, radius, convexRadius),
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

// Export empty object to make this a module with exports
export {};

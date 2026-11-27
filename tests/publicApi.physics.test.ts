import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Vector3 } from "three";

// The physics entry needs jolt-physics and three. These throw if it reaches another peer.
vi.mock("pixi.js", () => {
  throw new Error("fenrir-ts/physics imported pixi.js");
});

/** `fenrir-ts` plus `fenrir-ts/physics`, imported the way a game with physics does. */
let core: typeof import("@/index");
let physics: typeof import("@/physics");

beforeAll(async () => {
  core = await import("@/index");
  physics = await import("@/physics");
});

describe("fenrir-ts/physics public API", () => {
  it("exports the physics system, components and helpers", () => {
    expect(physics.createPhysicsSystem).toBeTypeOf("function");
    expect(physics.PhysicsHelpers).toBeTypeOf("function");
    expect(physics.PhysicsBody).toBeTypeOf("symbol");
    expect(physics.PhysicsShape).toBeTypeOf("symbol");
    expect(physics.PhysicsMaterial).toBeTypeOf("symbol");
  });

  it("names the physics systems fenrir.physics.<stage>", () => {
    const system = physics.createPhysicsSystem();
    expect([system.init.name, system.tick.name, system.exit.name]).toEqual(["fenrir.physics.init", "fenrir.physics.tick", "fenrir.physics.exit"]);
  });

  it("adds no methods to EntityBuilder", () => {
    const prototype = core.EntityBuilder.prototype as unknown as Record<string, unknown>;
    for (const method of ["physicsBody", "collisionLayer", "collisionMask", "collidesWith", "physicsBox", "physicsSphere", "physicsCapsule",
      "physicsCylinder", "physicsMaterial", "dynamicBox", "dynamicSphere", "staticBox", "staticSphere", "kinematicBox"]) {
      expect(prototype[method]).toBeUndefined();
    }
  });

  it("builds a physics entity with the builder's with", () => {
    const { EntityBuilder, EntityList } = core;
    const { CollisionUtils, CommonLayers, CommonMaterials, MotionType, PhysicsBody, PhysicsMaterial, PhysicsShape, ShapeBuilder, ShapeType, createPhysicsBody } = physics;
    const entities = new EntityList();
    const entity = EntityBuilder.create()
      .with(PhysicsBody, createPhysicsBody({
        motionType: MotionType.Kinematic,
        collisionLayer: CommonLayers.CHARACTER,
        collisionMask: CollisionUtils.createMask(CommonLayers.STATIC, CommonLayers.TRIGGER),
      }))
      .with(PhysicsShape, ShapeBuilder.capsule(1, 0.5))
      .with(PhysicsMaterial, CommonMaterials.ice())
      .spawn(entities);

    expect(entities.get(entity, PhysicsBody)).toMatchObject({
      motionType: MotionType.Kinematic,
      collisionLayer: CommonLayers.CHARACTER,
      collisionMask: CollisionUtils.createMask(CommonLayers.STATIC, CommonLayers.TRIGGER),
      syncMode: physics.SyncMode.TransformToPhysics,
    });
    expect(entities.get(entity, PhysicsShape).shapeType).toBe(ShapeType.Capsule);
    expect(entities.get(entity, PhysicsMaterial)).toEqual(CommonMaterials.ice());
  });

  it("adds a body, shape and material with each preset", () => {
    const { EntityBuilder, EntityList } = core;
    const { CommonMaterials, MotionType, PhysicsBody, PhysicsMaterial, PhysicsShape, ShapeType } = physics;
    const entities = new EntityList();
    const half = new Vector3(1, 2, 3);
    const cases = [
      [physics.dynamicBox(EntityBuilder.create(), half, 2), MotionType.Dynamic, ShapeType.Box, CommonMaterials.default(), 2],
      [physics.dynamicSphere(EntityBuilder.create(), 0.5, 3), MotionType.Dynamic, ShapeType.Sphere, CommonMaterials.rubber(), 3],
      [physics.staticBox(EntityBuilder.create(), half), MotionType.Static, ShapeType.Box, CommonMaterials.stone(), undefined],
      [physics.staticSphere(EntityBuilder.create(), 0.5), MotionType.Static, ShapeType.Sphere, CommonMaterials.stone(), undefined],
      [physics.kinematicBox(EntityBuilder.create(), half), MotionType.Kinematic, ShapeType.Box, CommonMaterials.default(), undefined],
    ] as const;

    for (const [builder, motionType, shapeType, material, mass] of cases) {
      expect(builder).toBeInstanceOf(EntityBuilder);
      const entity = builder.spawn(entities);
      expect(entities.get(entity, PhysicsBody)).toMatchObject({ motionType, mass });
      expect(entities.get(entity, PhysicsShape).shapeType).toBe(shapeType);
      expect(entities.get(entity, PhysicsMaterial)).toEqual(material);
    }
  });

  it("keeps a material added after a preset", () => {
    const { EntityBuilder, EntityList } = core;
    const { CommonMaterials, PhysicsMaterial } = physics;
    const entities = new EntityList();
    const entity = physics.dynamicSphere(EntityBuilder.create(), 0.5).with(PhysicsMaterial, CommonMaterials.metal()).spawn(entities);
    expect(entities.get(entity, PhysicsMaterial)).toEqual(CommonMaterials.metal());
  });

  it("adds physics to the system context type", () => {
    expectTypeOf<import("@/index").SystemCtx["physics"]>().toEqualTypeOf<
      import("@/physics").PhysicsHelpers | undefined
    >();
  });

  it("makes default transforms out of Three objects, which the physics system writes into", () => {
    const { EntityList, Transform } = core;
    const entities = new EntityList();
    expect(entities.get(entities.createEntity(), Transform).position).toBeInstanceOf(Vector3);
  });
});

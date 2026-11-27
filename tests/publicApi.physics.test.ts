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

  it("adds the physics entity builder methods", () => {
    const { EntityBuilder, EntityList } = core;
    const entities = new EntityList();
    const entity = EntityBuilder.create().dynamicBox(new Vector3(1, 1, 1)).spawn(entities);

    expect(entities.get(entity, physics.PhysicsBody).motionType).toBe(physics.MotionType.Dynamic);
    expect(entities.has(entity, physics.PhysicsShape)).toBe(true);
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

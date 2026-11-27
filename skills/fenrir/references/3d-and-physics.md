# 3D and physics (frozen)

These entry points are kept working and tested but get no new features: `fenrir-ts/3d` (Three.js), and `fenrir-ts/physics` (Jolt). Their peers are optional, so a game lists them itself: `npm install three` for `/3d` (and `@types/three` for TypeScript), `npm install three jolt-physics` for `/physics`. Without its peer, importing the entry fails, naming the package. New games should use the 2D path in [SKILL.md](../SKILL.md). Signatures are in [api/3d.md](../api/3d.md) and [api/physics.md](../api/physics.md).

## Basic example (3D)

The 3D renderer is frozen and has no plugin, so a 3D game still builds an `Engine` itself. `bootstrapEngine` from `fenrir-ts/3d` registers input, the Three.js renderer, camera and skybox systems in one call. Importing `fenrir-ts/3d` also adds the skybox members to `Scene`: `skybox`, `setSkybox`, `removeSkybox` and `hasSkybox`. Core's `Scene` does not have them, so a 2D bundle carries none.

```ts
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "fenrir-ts";
import { bootstrapEngine } from "fenrir-ts/3d";
import { createPhysicsSystem } from "fenrir-ts/physics";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) {
  throw new Error("Canvas element not found");
}

const logger = new ConsoleLogger();
const engine = new Engine({
  scheduler: new Scheduler(),
  sceneManager: new SceneManager(logger),
  events: new EventBus(),
  logger,
});

// Physics is optional; leave out `physics` and the fenrir-ts/physics import if you do not need it.
const { assets } = bootstrapEngine(engine, logger, { canvas, physics: createPhysicsSystem() });
await assets.loadModel("ship", "/models/ship.glb");

engine.addSystems(Schedule.Update, [yourGameSystem]);
await engine.run();
```

## Physics entities

`fenrir-ts/physics` adds no methods to `EntityBuilder`. A body needs three components, added with the builder's `with`: a `PhysicsBody` (`createPhysicsBody` picks the sync mode, collision layer and mask from the motion type unless given), a `PhysicsShape` from `ShapeBuilder` and, optionally, a `PhysicsMaterial` from `CommonMaterials`. The physics system creates the Jolt body for every entity with a `Transform`, a `PhysicsBody` and a `PhysicsShape`.

The presets `dynamicBox`, `dynamicSphere`, `staticBox`, `staticSphere` and `kinematicBox` add all three to the builder they are given and return it. A `with` after a preset replaces what it added.

```ts
import { EntityBuilder, type SystemCtx } from "fenrir-ts";
import { Vector3 } from "three";
import {
  CollisionUtils,
  CommonLayers,
  CommonMaterials,
  MotionType,
  PhysicsBody,
  PhysicsMaterial,
  PhysicsShape,
  ShapeBuilder,
  createPhysicsBody,
  dynamicSphere,
  staticBox,
} from "fenrir-ts/physics";

export function spawnLevel({ entities }: SystemCtx): void {
  staticBox(EntityBuilder.create().transform(new Vector3(0, -1, 0)), new Vector3(20, 1, 20)).spawn(entities);

  dynamicSphere(EntityBuilder.create().transform(new Vector3(0, 5, 0)), 0.5, 1)
    .with(PhysicsMaterial, CommonMaterials.metal())
    .spawn(entities);

  EntityBuilder.create()
    .transform(new Vector3(2, 8, 0))
    .with(PhysicsBody, createPhysicsBody({
      motionType: MotionType.Dynamic,
      mass: 2,
      collisionLayer: CommonLayers.CHARACTER,
      collisionMask: CollisionUtils.createMask(CommonLayers.STATIC, CommonLayers.DYNAMIC),
    }))
    .with(PhysicsShape, ShapeBuilder.capsule(0.5, 0.3))
    .with(PhysicsMaterial, CommonMaterials.wood())
    .spawn(entities);
}
```

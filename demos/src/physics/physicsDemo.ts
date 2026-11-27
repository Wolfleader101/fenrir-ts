import { Vector3 } from "three";
import type { AsyncSystemFn, SyncSystemFn } from "fenrir-ts";
import { EntityBuilder } from "fenrir-ts";
import { PhysicsBody, createPhysicsBody, MotionType, PhysicsShape, ShapeBuilder, PhysicsMaterial, CommonMaterials, dynamicBox, dynamicSphere, staticBox } from "fenrir-ts/physics";
import { SkyboxUtils } from "fenrir-ts/3d";
import type { IAssetStore } from "fenrir-ts";

/**
 * Creates a physics demo scene with falling objects and a static ground
 *
 * Features demonstrated:
 * - Dynamic physics bodies (boxes and spheres)
 * - Static physics ground
 * - Different material types (rubber, metal, wood)
 * - Physics simulation and transform synchronization
 */
export function createPhysicsDemo(assetStore?: IAssetStore) {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎯 Setting up physics demo scene");

    // Set up skybox if asset store is provided
    if (assetStore) {
      try {
        await SkyboxUtils.setupCubemapSkybox(ctx.scene, assetStore, { basePath: "/textures/skybox" });
        ctx.logger.info("✅ Skybox configured for physics demo");
      } catch (error) {
        ctx.logger.warn("Failed to setup skybox for physics demo", { error });
      }
    }

    // Create static ground plane (large box)
    const ground = staticBox(EntityBuilder.create(), new Vector3(20, 1, 20)) // Large flat box as ground
      .name("Ground")
      .transform(new Vector3(0, -5, 0)) // Position ground below origin
      .renderBox([40, 2, 40], {
        material: {
          kind: "standard",
          color: 0x404040,
          roughness: 0.8,
          metalness: 0.1,
        },
        flags: { castShadow: false, receiveShadow: true },
      });

    // Create dynamic falling objects with different materials
    const fallingObjects = [
      // Bouncy rubber balls
      dynamicSphere(EntityBuilder.create(), 0.5, 1.0) // radius, mass
        .name("Bouncy Ball 1")
        .transform(new Vector3(-3, 10, 0))
        .renderSphere(0.5, 32, 16, {
          material: {
            kind: "standard",
            color: 0xff6b6b,
            roughness: 0.6,
            metalness: 0.0,
          },
        }),

      dynamicSphere(EntityBuilder.create(), 0.7, 1.5)
        .name("Bouncy Ball 2")
        .transform(new Vector3(-1, 12, 0))
        .renderSphere(0.7, 32, 16, {
          material: {
            kind: "standard",
            color: 0x4ecdc4,
            roughness: 0.6,
            metalness: 0.0,
          },
        }),

      // Metal boxes (heavier)
      EntityBuilder.create()
        .name("Metal Box 1")
        .transform(new Vector3(1, 8, 0))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 5.0 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.5, 0.5, 0.5)))
        .with(PhysicsMaterial, CommonMaterials.metal())
        .renderBox([1.0, 1.0, 1.0], {
          material: {
            kind: "standard",
            color: 0xc0c0c0,
            roughness: 0.2,
            metalness: 0.8,
          },
        }),

      EntityBuilder.create()
        .name("Metal Box 2")
        .transform(new Vector3(3, 11, 0))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 3.0 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.4, 0.8, 0.4)))
        .with(PhysicsMaterial, CommonMaterials.metal())
        .renderBox([0.8, 1.6, 0.8], {
          material: {
            kind: "standard",
            color: 0x909090,
            roughness: 0.3,
            metalness: 0.7,
          },
        }),

      // Wood boxes (medium weight)
      EntityBuilder.create()
        .name("Wood Box 1")
        .transform(new Vector3(-2, 14, 1))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 2.0 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.6, 0.3, 0.6)))
        .with(PhysicsMaterial, CommonMaterials.wood())
        .renderBox([1.2, 0.6, 1.2], {
          material: {
            kind: "standard",
            color: 0x8b4513,
            roughness: 0.8,
            metalness: 0.1,
          },
        }),

      EntityBuilder.create()
        .name("Wood Box 2")
        .transform(new Vector3(0, 16, -1))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 2.5 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.4, 0.6, 0.4)))
        .with(PhysicsMaterial, CommonMaterials.wood())
        .renderBox([0.8, 1.2, 0.8], {
          material: {
            kind: "standard",
            color: 0xd2b48c,
            roughness: 0.9,
            metalness: 0.0,
          },
        }),

      // Glass objects (fragile-looking, though we don't have breakage yet)
      EntityBuilder.create()
        .name("Glass Sphere")
        .transform(new Vector3(2, 13, 1))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 1.2 }))
        .with(PhysicsShape, ShapeBuilder.sphere(0.4))
        .with(PhysicsMaterial, CommonMaterials.glass())
        .renderSphere(0.4, 32, 16, {
          material: {
            kind: "standard",
            color: 0x87ceeb,
            roughness: 0.1,
            metalness: 0.1,
          },
        }),

      // Foam objects (light and bouncy)
      EntityBuilder.create()
        .name("Foam Block")
        .transform(new Vector3(-1, 15, -1))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 0.3 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.8, 0.2, 0.8)))
        .with(PhysicsMaterial, CommonMaterials.foam())
        .renderBox([1.6, 0.4, 1.6], {
          material: {
            kind: "standard",
            color: 0xffeb3b,
            roughness: 0.9,
            metalness: 0.0,
          },
        }),

      // Mixed shapes and sizes
      EntityBuilder.create()
        .name("Large Metal Sphere")
        .transform(new Vector3(4, 18, 0))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 8.0 }))
        .with(PhysicsShape, ShapeBuilder.sphere(0.8))
        .with(PhysicsMaterial, CommonMaterials.metal())
        .renderSphere(0.8, 32, 16, {
          material: {
            kind: "standard",
            color: 0x607d8b,
            roughness: 0.2,
            metalness: 0.9,
          },
        }),

      EntityBuilder.create()
        .name("Small Wood Block")
        .transform(new Vector3(-4, 9, 0))
        .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 1.0 }))
        .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.2, 0.2, 0.2)))
        .with(PhysicsMaterial, CommonMaterials.wood())
        .renderBox([0.4, 0.4, 0.4], {
          material: {
            kind: "standard",
            color: 0xa0522d,
            roughness: 0.8,
            metalness: 0.0,
          },
        }),
    ];

    // Create some stacked objects to demonstrate collision
    const stackedObjects = [
      // Bottom level
      staticBox(EntityBuilder.create(), new Vector3(1, 0.5, 1))
        .name("Stack Base 1")
        .transform(new Vector3(8, -3.5, 0))
        .renderBox([2, 1, 2], {
          material: {
            kind: "standard",
            color: 0x795548,
            roughness: 0.7,
            metalness: 0.2,
          },
          flags: { castShadow: false, receiveShadow: true },
        }),

      staticBox(EntityBuilder.create(), new Vector3(1, 0.5, 1))
        .name("Stack Base 2")
        .transform(new Vector3(8, -3.5, 2))
        .renderBox([2, 1, 2], {
          material: {
            kind: "standard",
            color: 0x795548,
            roughness: 0.7,
            metalness: 0.2,
          },
          flags: { castShadow: false, receiveShadow: true },
        }),

      // Middle level - dynamic objects
      dynamicBox(EntityBuilder.create(), new Vector3(0.8, 0.4, 0.8), 2.0)
        .name("Stack Middle 1")
        .transform(new Vector3(8, -2, 0))
        .renderBox([1.6, 0.8, 1.6], {
          material: {
            kind: "standard",
            color: 0x9c27b0,
            roughness: 0.5,
            metalness: 0.3,
          },
        }),

      dynamicBox(EntityBuilder.create(), new Vector3(0.8, 0.4, 0.8), 2.0)
        .name("Stack Middle 2")
        .transform(new Vector3(8, -2, 2))
        .renderBox([1.6, 0.8, 1.6], {
          material: {
            kind: "standard",
            color: 0x673ab7,
            roughness: 0.5,
            metalness: 0.3,
          },
        }),

      // Top level
      dynamicSphere(EntityBuilder.create(), 0.6, 1.5)
        .name("Stack Top")
        .transform(new Vector3(8, -0.5, 1))
        .renderSphere(0.6, 32, 16, {
          material: {
            kind: "standard",
            color: 0xe91e63,
            roughness: 0.4,
            metalness: 0.2,
          },
        }),
    ];

    // Spawn all entities
    ground.spawn(entities);

    for (const obj of fallingObjects) {
      obj.spawn(entities);
    }

    for (const obj of stackedObjects) {
      obj.spawn(entities);
    }

    // Add some random scattered objects that spawn over time
    let spawnTimer = 0;
    let spawnCount = 0;
    const maxSpawns = 15;

    // Create a timed spawner system (inline)
    const spawnerSystem: SyncSystemFn = (ctx) => {
      spawnTimer += ctx.time.delta;

      // Spawn a new object every 2 seconds
      if (spawnTimer > 2.0 && spawnCount < maxSpawns) {
        spawnTimer = 0;
        spawnCount++;

        // Random position above the scene
        const x = (Math.random() - 0.5) * 15; // -7.5 to 7.5
        const z = (Math.random() - 0.5) * 15;
        const y = 20 + Math.random() * 5; // High up

        // Random object type
        const objectType = Math.floor(Math.random() * 4);
        let newObject: EntityBuilder;

        switch (objectType) {
          case 0: {
            const radius = 0.3 + Math.random() * 0.4;
            const randomColor = Math.floor(Math.random() * 0xffffff);
            newObject = dynamicSphere(EntityBuilder.create(), radius, 0.5 + Math.random() * 2)
              .name(`Random Sphere ${spawnCount}`)
              .transform(new Vector3(x, y, z))
              .renderSphere(radius, 32, 16, {
                material: {
                  kind: "standard",
                  color: randomColor,
                  roughness: 0.4 + Math.random() * 0.4,
                  metalness: Math.random() * 0.3,
                },
              });
            break;
          }
          case 1: {
            const size = new Vector3(
              0.2 + Math.random() * 0.4,
              0.2 + Math.random() * 0.4,
              0.2 + Math.random() * 0.4
            );
            const randomColor = Math.floor(Math.random() * 0xffffff);
            newObject = dynamicBox(EntityBuilder.create(), size, 0.5 + Math.random() * 2)
              .name(`Random Box ${spawnCount}`)
              .transform(new Vector3(x, y, z))
              .renderBox([size.x * 2, size.y * 2, size.z * 2], {
                material: {
                  kind: "standard",
                  color: randomColor,
                  roughness: 0.3 + Math.random() * 0.5,
                  metalness: Math.random() * 0.4,
                },
              });
            break;
          }
          case 2: {
            const radius = 0.3 + Math.random() * 0.3;
            newObject = EntityBuilder.create()
              .name(`Random Metal ${spawnCount}`)
              .transform(new Vector3(x, y, z))
              .with(PhysicsBody, createPhysicsBody({
                motionType: MotionType.Dynamic,
                mass: 2 + Math.random() * 4,
              }))
              .with(PhysicsShape, ShapeBuilder.sphere(radius))
              .with(PhysicsMaterial, CommonMaterials.metal())
              .renderSphere(radius, 32, 16, {
                material: {
                  kind: "standard",
                  color: 0x708090 + Math.floor(Math.random() * 0x202020),
                  roughness: 0.1 + Math.random() * 0.2,
                  metalness: 0.7 + Math.random() * 0.3,
                },
              });
            break;
          }
          default: {
            newObject = EntityBuilder.create()
              .name(`Random Rubber ${spawnCount}`)
              .transform(new Vector3(x, y, z))
              .with(PhysicsBody, createPhysicsBody({
                motionType: MotionType.Dynamic,
                mass: 0.5 + Math.random(),
              }))
              .with(PhysicsShape, ShapeBuilder.box(new Vector3(0.3, 0.3, 0.3)))
              .with(PhysicsMaterial, CommonMaterials.rubber())
              .renderBox([0.6, 0.6, 0.6], {
                material: {
                  kind: "standard",
                  color: 0xff0000 + Math.floor(Math.random() * 0x00ffff),
                  roughness: 0.6 + Math.random() * 0.3,
                  metalness: 0.0,
                },
              });
            break;
          }
        }

        newObject.spawn(entities);
        ctx.logger.debug(`Spawned random object ${spawnCount}/${maxSpawns}`);
      }
    };

    // Store the spawner system in the scene context for cleanup
    (ctx.scene as any).physicsSpawner = spawnerSystem;

    ctx.logger.info(
      `✅ Physics demo scene created with ${
        fallingObjects.length + stackedObjects.length + 1
      } initial objects`
    );
  };

  const update: SyncSystemFn = (ctx) => {
    // Run the spawner system if it exists
    const spawner = (ctx.scene as any).physicsSpawner;
    if (spawner) {
      spawner(ctx);
    }
  };

  return { init, update };
}

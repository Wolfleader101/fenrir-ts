import { Vector3 } from "three";
import type { AsyncSystemFn, SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import { SkyboxUtils } from "@/core/Skybox";

/**
 * Stacking Blocks Demo
 *
 * Demonstrates:
 * - Building stable structures with physics
 * - Different shapes (boxes, cylinders via spheres)
 * - Interactive spawning
 * - Material variety
 */
export function createStackingBlocksDemo(assetStore?: IAssetStore) {
  let spawnTimer = 0;

  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🧱 Setting up stacking blocks demo");

    // Set up skybox
    if (assetStore) {
      try {
        await SkyboxUtils.setupDefaultSkybox(ctx.scene, assetStore);
      } catch (error) {
        ctx.logger.warn("Failed to setup skybox", { error });
      }
    }

    // Ground
    EntityBuilder.create()
      .name("Ground")
      .transform(new Vector3(0, -5, 0))
      .staticBox(new Vector3(20, 1, 20))
      .renderBox([40, 2, 40], {
        material: {
          kind: "standard",
          color: 0x34495e,
          roughness: 0.9,
          metalness: 0.1,
        },
        flags: { castShadow: false, receiveShadow: true },
      })
      .spawn(entities);

    // Build a pyramid of boxes
    const buildPyramid = (centerX: number, centerZ: number) => {
      const layers = 5;
      const boxSize = 0.8;

      for (let layer = 0; layer < layers; layer++) {
        const y = -3.5 + layer * boxSize;
        const width = layers - layer;

        for (let i = 0; i < width; i++) {
          const x = centerX + (i - width / 2 + 0.5) * boxSize;

          EntityBuilder.create()
            .name(`Pyramid Block L${layer}-${i}`)
            .transform(new Vector3(x, y, centerZ))
            .dynamicBox(new Vector3(boxSize / 2, boxSize / 2, boxSize / 2), 2.0)
            .physicsMaterial("wood")
            .renderBox([boxSize, boxSize, boxSize], {
              material: {
                kind: "standard",
                color: 0x8b4513 + layer * 0x101010,
                roughness: 0.8,
                metalness: 0.1,
              },
            })
            .spawn(entities);
        }
      }
    };

    // Create main pyramid
    buildPyramid(0, 0);

    // Create some towers
    const buildTower = (
      x: number,
      z: number,
      height: number,
      color: number
    ) => {
      for (let i = 0; i < height; i++) {
        EntityBuilder.create()
          .name(`Tower Block ${i}`)
          .transform(new Vector3(x, -3.5 + i * 1.2, z))
          .dynamicBox(new Vector3(0.4, 0.5, 0.4), 1.5)
          .physicsMaterial("wood")
          .renderBox([0.8, 1.0, 0.8], {
            material: {
              kind: "standard",
              color: color,
              roughness: 0.7,
              metalness: 0.2,
            },
          })
          .spawn(entities);
      }
    };

    buildTower(-6, 0, 6, 0xe74c3c);
    buildTower(6, 0, 6, 0x3498db);
    buildTower(0, -6, 5, 0x2ecc71);
    buildTower(0, 6, 5, 0xf39c12);

    // Add some wrecking balls
    EntityBuilder.create()
      .name("Wrecking Ball 1")
      .transform(new Vector3(-8, 5, 0))
      .dynamicSphere(0.6, 5.0)
      .physicsMaterial("metal")
      .renderSphere(0.6, 32, 16, {
        material: {
          kind: "standard",
          color: 0x95a5a6,
          roughness: 0.3,
          metalness: 0.8,
        },
      })
      .spawn(entities);

    EntityBuilder.create()
      .name("Wrecking Ball 2")
      .transform(new Vector3(8, 5, 0))
      .dynamicSphere(0.6, 5.0)
      .physicsMaterial("metal")
      .renderSphere(0.6, 32, 16, {
        material: {
          kind: "standard",
          color: 0x7f8c8d,
          roughness: 0.3,
          metalness: 0.8,
        },
      })
      .spawn(entities);

    ctx.logger.info("✅ Stacking blocks demo created");
  };

  const update: SyncSystemFn = (ctx) => {
    spawnTimer += ctx.time.deltaTime;

    // Occasionally spawn a random block from above
    if (spawnTimer > 3.0) {
      spawnTimer = 0;

      const x = (Math.random() - 0.5) * 12;
      const z = (Math.random() - 0.5) * 12;
      const randomColor = Math.floor(Math.random() * 0xffffff);

      EntityBuilder.create()
        .name("Random Block")
        .transform(new Vector3(x, 10, z))
        .dynamicBox(new Vector3(0.3, 0.3, 0.3), 1.0)
        .physicsMaterial("wood")
        .renderBox([0.6, 0.6, 0.6], {
          material: {
            kind: "standard",
            color: randomColor,
            roughness: 0.7,
            metalness: 0.2,
          },
        })
        .spawn(ctx.entities);
    }
  };

  return { init, update };
}

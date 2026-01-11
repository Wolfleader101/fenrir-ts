import { Vector3 } from "three";
import type { AsyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import { SkyboxUtils } from "@/core/Skybox";

/**
 * Bouncing Ball Demo
 *
 * A simple demo showing:
 * - Basic physics with dynamic spheres
 * - Static ground plane
 * - Colorful bouncing balls
 * - Material properties (rubber for bounce)
 */
export function createBouncingBallDemo(assetStore?: IAssetStore) {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎾 Setting up bouncing ball demo");

    // Set up skybox
    if (assetStore) {
      try {
        await SkyboxUtils.setupDefaultSkybox(ctx.scene, assetStore);
      } catch (error) {
        ctx.logger.warn("Failed to setup skybox", { error });
      }
    }

    // Create ground
    EntityBuilder.create()
      .name("Ground")
      .transform(new Vector3(0, -2, 0))
      .staticBox(new Vector3(15, 0.5, 15))
      .renderBox([30, 1, 30], {
        material: {
          kind: "standard",
          color: 0x2c3e50,
          roughness: 0.8,
          metalness: 0.2,
        },
        flags: { castShadow: false, receiveShadow: true },
      })
      .spawn(entities);

    // Create bouncing balls in a grid
    const colors = [
      0xff6b6b, // red
      0x4ecdc4, // cyan
      0x45b7d1, // blue
      0xf9ca24, // yellow
      0x6c5ce7, // purple
      0xe17055, // orange
      0x00b894, // green
      0xfd79a8, // pink
    ];

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 3;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 5 + i * 1.5;

      EntityBuilder.create()
        .name(`Ball ${i + 1}`)
        .transform(new Vector3(x, y, z))
        .dynamicSphere(0.5, 1.0)
        .physicsMaterial("rubber")
        .renderSphere(0.5, 32, 16, {
          material: {
            kind: "standard",
            color: colors[i],
            roughness: 0.6,
            metalness: 0.1,
          },
        })
        .spawn(entities);
    }

    // Add a few larger balls
    EntityBuilder.create()
      .name("Big Ball 1")
      .transform(new Vector3(0, 15, 0))
      .dynamicSphere(1.0, 3.0)
      .physicsMaterial("rubber")
      .renderSphere(1.0, 32, 16, {
        material: {
          kind: "standard",
          color: 0x3498db,
          roughness: 0.5,
          metalness: 0.2,
        },
      })
      .spawn(entities);

    EntityBuilder.create()
      .name("Big Ball 2")
      .transform(new Vector3(2, 18, 2))
      .dynamicSphere(0.8, 2.0)
      .physicsMaterial("rubber")
      .renderSphere(0.8, 32, 16, {
        material: {
          kind: "standard",
          color: 0xe74c3c,
          roughness: 0.5,
          metalness: 0.2,
        },
      })
      .spawn(entities);

    ctx.logger.info("✅ Bouncing ball demo created");
  };

  return { init };
}

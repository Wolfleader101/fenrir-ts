import { Vector3 } from "three";
import type { AsyncSystemFn, SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import { SkyboxUtils } from "@/core/Skybox";
import { PhysicsBody } from "@/core/Physics";
import { InputEvent } from "@/core/InputSystem/InputEvents";

/**
 * Bouncing Ball Demo
 *
 * A simple demo showing:
 * - Basic physics with dynamic spheres
 * - Static ground plane
 * - Colorful bouncing balls
 * - Material properties (rubber for bounce)
 * - Physics impulses (press SPACE to push balls up)
 */
export function createBouncingBallDemo(assetStore: IAssetStore) {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎾 Setting up bouncing ball demo");

    await SkyboxUtils.setupDefaultSkybox(ctx.scene, assetStore);

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
    ctx.logger.info("⌨️  Press E to apply upward impulse to all balls");
  };

  /**
   * System that applies impulses to balls when E is pressed
   * This tests the PhysicsHelpers functionality using engine events
   */
  const update: SyncSystemFn = (ctx) => {
    // Check if physics helpers are available
    if (!ctx.physics) {
      ctx.logger.warn("⚠️ Physics helpers not available on ctx");
      return;
    }

    // Read keyboard events from the event bus
    const keyDownEvents = ctx.events.read(InputEvent.KeyDown);

    for (const event of keyDownEvents) {
      ctx.logger.info(
        `🔵 KeyDown event: ${event.code}, repeat: ${event.repeat}`,
      );

      // Check if E was pressed (and not a repeat)
      if (event.code === "KeyE" && !event.repeat) {
        ctx.logger.info("🚀 E pressed - applying impulse to all balls!");

        // Apply upward impulse to all physics bodies
        let ballCount = 0;
        ctx.entities.each([PhysicsBody], (entity, physicsBody) => {
          ballCount++;

          const entityId = ctx.entities.idOf(entity);
          ctx.logger.info(
            `  🎾 Entity ${entityId}, hasJoltBody: ${!!physicsBody.joltBody}`,
          );

          // Apply upward impulse (impulse = mass × velocity change)
          // For 1-3kg balls, an impulse of 20-50 gives nice visible jump
          const impulse = new Vector3(0, 30, 0);
          ctx.physics!.applyImpulse(physicsBody, impulse);
        });

        ctx.logger.info(`✅ Applied impulse to ${ballCount} balls`);
      }
    }
  };

  return { init, update };
}

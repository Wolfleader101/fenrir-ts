import type { AsyncSystemFn, SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { Vector3, Quaternion } from "three";
import { Transform, Name } from "@/core/ECS/DefaultComponents";
import { Renderable2D } from "@/core/Renderer2D";
import { defineComponent } from "@/core/ECS/Component";
import type { InputState } from "@/core/InputSystem/InputState";

/**
 * Simple 2D Platformer Demo
 *
 * Demonstrates:
 * - Player movement with keyboard controls
 * - Jumping mechanics with gravity
 * - Platform collision detection
 * - Simple 2D physics simulation
 */

// Component for platformer physics
export type PlatformerPhysicsData = {
  velocity: { x: number; y: number };
  grounded: boolean;
};
export const PlatformerPhysics =
  defineComponent<PlatformerPhysicsData>("PlatformerPhysics");

// Component for platform collision
export type PlatformData = {
  readonly width: number;
  readonly height: number;
};
export const Platform = defineComponent<PlatformData>("Platform");

// Player control component
export type PlayerControllerData = {
  readonly moveSpeed: number;
  readonly jumpForce: number;
};
export const PlayerController =
  defineComponent<PlayerControllerData>("PlayerController");

const GRAVITY = 980; // pixels per second squared
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

export function createPlatformerDemo(inputState: InputState) {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎮 Setting up platformer demo");

    // Create background
    EntityBuilder.create()
      .name("Background")
      .with(Transform, {
        position: new Vector3(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        graphics: {
          kind: "graphics",
          shape: "rect",
          fillColor: 0x87ceeb, // Sky blue
          data: {
            x: -CANVAS_WIDTH / 2,
            y: -CANVAS_HEIGHT / 2,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          },
        },
        flags: { zIndex: 0 },
      })
      .spawn(entities);

    // Create title
    EntityBuilder.create()
      .name("Title")
      .with(Transform, {
        position: new Vector3(CANVAS_WIDTH / 2, 30, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        text: {
          kind: "text",
          content: "2D Platformer Demo",
          style: {
            fontFamily: "Arial",
            fontSize: 32,
            fill: 0x333333,
            align: "center",
          },
        },
        flags: { zIndex: 100 },
      })
      .spawn(entities);

    // Create controls text
    EntityBuilder.create()
      .name("Controls")
      .with(Transform, {
        position: new Vector3(20, 70, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        text: {
          kind: "text",
          content: "Controls: ← → to move, SPACE to jump",
          style: {
            fontFamily: "Arial",
            fontSize: 18,
            fill: 0x333333,
          },
        },
        flags: { zIndex: 100 },
      })
      .spawn(entities);

    // Create player
    const playerX = 100;
    const playerY = 400;
    const playerSize = 40;

    EntityBuilder.create()
      .name("Player")
      .with(Transform, {
        position: new Vector3(playerX, playerY, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        graphics: {
          kind: "graphics",
          shape: "rect",
          fillColor: 0xff4444, // Red player
          strokeColor: 0x000000,
          strokeWidth: 2,
          data: {
            x: -playerSize / 2,
            y: -playerSize / 2,
            width: playerSize,
            height: playerSize,
          },
        },
        flags: { zIndex: 10 },
      })
      .with(PlayerController, { moveSpeed: 300, jumpForce: 500 })
      .with(PlatformerPhysics, { velocity: { x: 0, y: 0 }, grounded: false })
      .spawn(entities);

    // Create platforms
    const platformData = [
      // Ground platform
      { x: 400, y: 550, width: 800, height: 100, color: 0x2ecc71 },
      // Floating platforms
      { x: 200, y: 450, width: 150, height: 20, color: 0x3498db },
      { x: 450, y: 380, width: 150, height: 20, color: 0x3498db },
      { x: 650, y: 320, width: 150, height: 20, color: 0x3498db },
      { x: 400, y: 250, width: 180, height: 20, color: 0x3498db },
      { x: 150, y: 200, width: 120, height: 20, color: 0x3498db },
    ];

    platformData.forEach((p, i) => {
      EntityBuilder.create()
        .name(`Platform ${i}`)
        .with(Transform, {
          position: new Vector3(p.x, p.y, 0),
          rotation: new Quaternion(),
          scale: new Vector3(1, 1, 1),
        })
        .with(Renderable2D, {
          id: 0,
          graphics: {
            kind: "graphics",
            shape: "rect",
            fillColor: p.color,
            strokeColor: 0x27ae60,
            strokeWidth: 2,
            data: {
              x: -p.width / 2,
              y: -p.height / 2,
              width: p.width,
              height: p.height,
            },
          },
          flags: { zIndex: 5 },
        })
        .with(Platform, { width: p.width, height: p.height })
        .spawn(entities);
    });

    ctx.logger.info("✅ Platformer demo created");
  };

  const update: SyncSystemFn = (ctx) => {
    const dt = ctx.time.delta;
    const entities = ctx.entities;

    // Player physics and input
    const playerQuery = [
      Transform,
      PlayerController,
      PlatformerPhysics,
    ] as const;
    entities.each(playerQuery, (e, transform, controller, physics) => {
      const vel = physics.velocity;

      // Apply gravity
      vel.y += GRAVITY * dt;

      // Input handling
      let moveX = 0;
      if (inputState.isDown("ArrowLeft") || inputState.isDown("KeyA")) {
        moveX = -1;
      }
      if (inputState.isDown("ArrowRight") || inputState.isDown("KeyD")) {
        moveX = 1;
      }

      vel.x = moveX * controller.moveSpeed;

      // Jump
      if (
        (inputState.isDown("Space") ||
          inputState.isDown("ArrowUp") ||
          inputState.isDown("KeyW")) &&
        physics.grounded
      ) {
        vel.y = -controller.jumpForce;
        physics.grounded = false;
      }

      // Update position
      transform.position.x += vel.x * dt;
      transform.position.y += vel.y * dt;

      // Check platform collisions
      const playerSize = 40;
      const playerLeft = transform.position.x - playerSize / 2;
      const playerRight = transform.position.x + playerSize / 2;
      const playerTop = transform.position.y - playerSize / 2;
      const playerBottom = transform.position.y + playerSize / 2;

      let wasGrounded = false;

      const platformQuery = [Transform, Platform] as const;
      entities.each(platformQuery, (platformE, platformTransform, platform) => {
        const platLeft = platformTransform.position.x - platform.width / 2;
        const platRight = platformTransform.position.x + platform.width / 2;
        const platTop = platformTransform.position.y - platform.height / 2;
        const platBottom = platformTransform.position.y + platform.height / 2;

        // Check horizontal overlap
        if (playerRight > platLeft && playerLeft < platRight) {
          // Landing on top
          if (
            vel.y > 0 &&
            playerBottom > platTop &&
            playerBottom < platBottom
          ) {
            transform.position.y = platTop - playerSize / 2;
            vel.y = 0;
            physics.grounded = true;
            wasGrounded = true;
          }
          // Hitting from below
          else if (vel.y < 0 && playerTop < platBottom && playerTop > platTop) {
            transform.position.y = platBottom + playerSize / 2;
            vel.y = 0;
          }
        }

        // Check vertical overlap for side collisions
        if (playerBottom > platTop && playerTop < platBottom) {
          // Hit from left
          if (vel.x > 0 && playerRight > platLeft && playerLeft < platLeft) {
            transform.position.x = platLeft - playerSize / 2;
            vel.x = 0;
          }
          // Hit from right
          else if (
            vel.x < 0 &&
            playerLeft < platRight &&
            playerRight > platRight
          ) {
            transform.position.x = platRight + playerSize / 2;
            vel.x = 0;
          }
        }
      });

      if (!wasGrounded && vel.y > 0) {
        physics.grounded = false;
      }

      // Keep player in bounds
      const halfSize = playerSize / 2;
      if (transform.position.x < halfSize) {
        transform.position.x = halfSize;
        vel.x = 0;
      }
      if (transform.position.x > CANVAS_WIDTH - halfSize) {
        transform.position.x = CANVAS_WIDTH - halfSize;
        vel.x = 0;
      }
    });
  };

  return { init, update };
}

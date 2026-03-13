import type { AsyncSystemFn, SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { Vector3, Quaternion } from "three";
import { Transform } from "@/core/ECS/DefaultComponents";
import { Renderable2D } from "@/core/Renderer2D";
import {
  PhysicsBody,
  createPhysicsBody,
  MotionType,
  SyncMode,
} from "@/core/Physics/components/PhysicsBody";
import {
  PhysicsShape,
  ShapeType,
} from "@/core/Physics/components/PhysicsShape";
import {
  PhysicsMaterial,
  createPhysicsMaterial,
} from "@/core/Physics/components/PhysicsMaterial";
import { defineComponent } from "@/core/ECS/Component";
import type { InputState } from "@/core/InputSystem/InputState";

/**
 * 2D Platformer Demo with Physics Engine
 *
 * Demonstrates:
 * - 2D rendering with PixiJS
 * - Jolt Physics integration for realistic physics
 * - Player movement using physics forces
 * - Platform collision via physics engine
 * - Jump mechanics with physics impulses
 */

// Player controller component
export type PlayerControllerData = {
  readonly moveForce: number;
  readonly jumpForce: number;
  readonly maxSpeed: number;
  canJump: boolean;
};
export const PlayerController =
  defineComponent<PlayerControllerData>("PlayerController");

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 0.4; // 40px at 100px:1m scale

export function createPlatformerPhysicsDemo(inputState: InputState) {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎮 Setting up physics-based platformer demo");

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
          content: "Physics-Based Platformer",
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
          content: "Controls: ← → to move, SPACE to jump (Jolt Physics)",
          style: {
            fontFamily: "Arial",
            fontSize: 16,
            fill: 0x333333,
          },
        },
        flags: { zIndex: 100 },
      })
      .spawn(entities);

    // Create player with physics
    // Using pixel coordinates directly for both physics and rendering
    const PLAYER_SIZE_PX = 40; // Player size in pixels
    const playerX = 100; // Starting X position in pixels
    const playerY = 400; // Starting Y position in pixels

    EntityBuilder.create()
      .name("Player")
      .with(Transform, {
        position: new Vector3(playerX, playerY, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(
        PhysicsBody,
        createPhysicsBody({
          motionType: MotionType.Dynamic,
          mass: 1.0,
          gravityFactor: -100.0, // Scaled up for pixel coordinates (negative = down in 2D canvas)
          collisionLayer: 2, // Player layer
          collisionMask: 1 | 2, // Collides with static (1) and other dynamic (2)
          syncMode: SyncMode.PhysicsToTransform, // Physics system updates Transform
          lockRotation: [true, true, true], // Lock all rotation axes for 2D platformer
        }),
      )
      .with(PhysicsShape, {
        shapeType: ShapeType.Box,
        parameters: {
          halfExtents: new Vector3(
            PLAYER_SIZE_PX / 2,
            PLAYER_SIZE_PX / 2,
            PLAYER_SIZE_PX / 2,
          ),
        },
      })
      .with(
        PhysicsMaterial,
        createPhysicsMaterial({
          friction: 0.5,
          restitution: 0.0, // No bounce for player
          linearDamping: 2.0, // Air resistance
          angularDamping: 5.0, // Prevent spinning
        }),
      )
      .with(PlayerController, {
        moveForce: 500.0, // Scaled up for pixel coordinates
        jumpForce: 600.0, // Scaled up for pixel coordinates
        maxSpeed: 300.0, // Scaled up for pixel coordinates
        canJump: false,
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
            x: -PLAYER_SIZE_PX / 2,
            y: -PLAYER_SIZE_PX / 2,
            width: PLAYER_SIZE_PX,
            height: PLAYER_SIZE_PX,
          },
        },
        flags: { zIndex: 10 },
      })
      .spawn(entities);

    // Create platforms with physics (static bodies)
    // All coordinates in pixels
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
        .with(
          PhysicsBody,
          createPhysicsBody({
            motionType: MotionType.Static,
            collisionLayer: 1, // Static layer
            collisionMask: 2, // Collides with dynamic (player)
          }),
        )
        .with(PhysicsShape, {
          shapeType: ShapeType.Box,
          parameters: {
            halfExtents: new Vector3(p.width / 2, p.height / 2, 50),
          },
        })
        .with(
          PhysicsMaterial,
          createPhysicsMaterial({
            friction: 0.8,
            restitution: 0.0,
          }),
        )
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
        .spawn(entities);
    });

    ctx.logger.info("✅ Physics platformer demo created");
  };

  const update: SyncSystemFn = (ctx) => {
    if (!ctx.physics) {
      return; // Physics not initialized yet
    }

    // Player physics-based movement
    const playerQuery = [Transform, PlayerController, PhysicsBody] as const;
    ctx.entities.each(playerQuery, (e, transform, controller, physicsBody) => {
      if (!physicsBody.joltBody) return;

      // Get current velocity
      const body = physicsBody.joltBody;
      const velocity = body.GetLinearVelocity();
      const vx = velocity.GetX();
      const vy = velocity.GetY();

      // Check if grounded (simple approximation: low vertical velocity)
      const isGrounded = Math.abs(vy) < 0.5;
      controller.canJump = isGrounded;

      // Horizontal movement with force
      let moveDir = 0;
      if (inputState.isDown("ArrowLeft") || inputState.isDown("KeyA")) {
        moveDir = -1;
      }
      if (inputState.isDown("ArrowRight") || inputState.isDown("KeyD")) {
        moveDir = 1;
      }

      // Apply horizontal force (allows for acceleration/deceleration)
      if (moveDir !== 0) {
        const force = new Vector3(moveDir * controller.moveForce, 0, 0);
        ctx.physics!.addForce(physicsBody, force);

        // Limit max horizontal speed
        if (Math.abs(vx) > controller.maxSpeed) {
          const newVx = Math.sign(vx) * controller.maxSpeed;
          ctx.physics!.setVelocity(physicsBody, new Vector3(newVx, vy, 0));
        }
      }

      // Jump with impulse
      if (
        (inputState.wasPressed("Space") ||
          inputState.wasPressed("ArrowUp") ||
          inputState.wasPressed("KeyW")) &&
        controller.canJump
      ) {
        const jumpImpulse = new Vector3(0, -controller.jumpForce, 0);
        ctx.physics!.applyImpulse(physicsBody, jumpImpulse);
        controller.canJump = false;
        ctx.logger.debug("Player jumped!");
      }
    });
  };

  return { init, update };
}

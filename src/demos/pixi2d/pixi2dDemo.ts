import type { AsyncSystemFn, SyncSystemFn } from "@/core/SystemCtx";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";
import { Vector3, Quaternion } from "three";
import { Transform, Name } from "@/core/ECS/DefaultComponents";
import { Renderable2D } from "@/core/Renderer2D";

/**
 * Simple 2D Demo with PixiJS
 *
 * Demonstrates:
 * - 2D rendering with PixiJS
 * - Graphics shapes (circles, rects)
 * - Text rendering
 * - Sprite-like entities
 * - Simple rotation animation
 */
export function create2DDemo() {
  const init: AsyncSystemFn = async (ctx) => {
    const entities = ctx.scene.entityList;

    ctx.logger.info("🎨 Setting up 2D demo");

    // Create a colorful background rect
    EntityBuilder.create()
      .name("Background")
      .with(Transform, {
        position: new Vector3(400, 300, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        graphics: {
          kind: "graphics",
          shape: "rect",
          fillColor: 0x1a1a2e,
          data: { x: -400, y: -300, width: 800, height: 600 },
        },
        flags: { zIndex: 0 },
      })
      .spawn(entities);

    // Create title text
    EntityBuilder.create()
      .name("Title")
      .with(Transform, {
        position: new Vector3(400, 50, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        text: {
          kind: "text",
          content: "Fenrir-TS + PixiJS Demo",
          style: {
            fontFamily: "Arial",
            fontSize: 48,
            fill: 0xffffff,
            align: "center",
          },
        },
        flags: { zIndex: 100 },
      })
      .spawn(entities);

    // Create subtitle
    EntityBuilder.create()
      .name("Subtitle")
      .with(Transform, {
        position: new Vector3(400, 100, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        text: {
          kind: "text",
          content: "2D Game Engine with ECS Architecture",
          style: {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xaaaaaa,
            align: "center",
          },
        },
        flags: { zIndex: 100 },
      })
      .spawn(entities);

    // Create rotating circles
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
      const radius = 150;
      const x = 400 + Math.cos(angle) * radius;
      const y = 350 + Math.sin(angle) * radius;

      EntityBuilder.create()
        .name(`Circle ${i + 1}`)
        .with(Transform, {
          position: new Vector3(x, y, 0),
          rotation: new Quaternion(),
          scale: new Vector3(1, 1, 1),
        })
        .with(Renderable2D, {
          id: 0,
          graphics: {
            kind: "graphics",
            shape: "circle",
            fillColor: colors[i],
            strokeColor: 0xffffff,
            strokeWidth: 3,
            data: { x: 0, y: 0, radius: 30 },
          },
          flags: { zIndex: 10 },
        })
        .spawn(entities);
    }

    // Create center square
    EntityBuilder.create()
      .name("Center Square")
      .with(Transform, {
        position: new Vector3(400, 350, 0),
        rotation: new Quaternion(),
        scale: new Vector3(1, 1, 1),
      })
      .with(Renderable2D, {
        id: 0,
        graphics: {
          kind: "graphics",
          shape: "rect",
          fillColor: 0x2ecc71,
          strokeColor: 0xffffff,
          strokeWidth: 4,
          data: { x: -40, y: -40, width: 80, height: 80 },
        },
        flags: { zIndex: 20 },
      })
      .spawn(entities);

    // Create info boxes
    const infoItems = [
      "✨ 2D Rendering with PixiJS",
      "🎮 ECS Architecture",
      "🔄 Transform Components",
      "🎨 Graphics & Text",
    ];

    infoItems.forEach((text, i) => {
      EntityBuilder.create()
        .name(`Info ${i}`)
        .with(Transform, {
          position: new Vector3(50, 200 + i * 40, 0),
          rotation: new Quaternion(),
          scale: new Vector3(1, 1, 1),
        })
        .with(Renderable2D, {
          id: 0,
          text: {
            kind: "text",
            content: text,
            style: {
              fontFamily: "Arial",
              fontSize: 20,
              fill: 0xecf0f1,
            },
          },
          flags: { zIndex: 50 },
        })
        .spawn(entities);
    });

    ctx.logger.info("✅ 2D demo created");
  };

  // Simple rotation animation for circles
  const update: SyncSystemFn = (ctx) => {
    const time = ctx.time.elapsed;
    const Q = [Transform, Renderable2D, Name] as const;

    ctx.entities.each(Q, (e, transform, renderable, nameComp) => {
      // Rotate circles
      if (nameComp.name.startsWith("Circle")) {
        const parts = nameComp.name.split(" ");
        if (parts[1]) {
          const index = parseInt(parts[1], 10) - 1;
          const baseAngle = (index / 8) * Math.PI * 2;
          const orbitAngle = baseAngle + time * 0.5;
          const radius = 150;

          transform.position.x = 400 + Math.cos(orbitAngle) * radius;
          transform.position.y = 350 + Math.sin(orbitAngle) * radius;

          // Individual rotation
          const rotAngle = time * 2;
          transform.rotation.setFromAxisAngle(new Vector3(0, 0, 1), rotAngle);
        }
      }

      // Wobble the center square
      if (nameComp.name === "Center Square") {
        const wobble = Math.sin(time * 3) * 0.2;
        transform.rotation.setFromAxisAngle(new Vector3(0, 0, 1), wobble);

        const pulse = 1 + Math.sin(time * 2) * 0.1;
        transform.scale.set(pulse, pulse, 1);
      }
    });
  };

  return { init, update };
}

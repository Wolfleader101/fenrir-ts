// TestSceneInit.ts

import { Transform } from "../core/ECS/DefaultComponents";
import { Renderable } from "../core/Renderer/renderComponents";
import type { SystemFn } from "../core/SystemCtx";
import { Vector3, Quaternion } from "three";
import { Spin } from "./spin";

export const testSceneInit: SystemFn = (ctx) => {
  const entities = ctx.scene.entityList;

  const cube = entities.createEntity();

  const child = entities.createEntity();

  entities.addChild(cube, child);

  // Transform (local)
  entities.set(cube, Transform, {
    position: new Vector3(0, 0, 0),
    rotation: new Quaternion(),
    scale: new Vector3(1, 1, 1),
  });

  entities.set(child, Transform, {
    position: new Vector3(0, -2, 1),
    rotation: new Quaternion(),
    scale: new Vector3(1, 1, 1),
  });

  // Renderable
  entities.set(cube, Renderable, {
    id: 0,
    geometry: { kind: "box", size: [1, 1, 1] },
    material: {
      kind: "standard",
      color: 0x44aa88,
      roughness: 0.5,
      metalness: 0.1,
    },
    flags: { castShadow: true, receiveShadow: true },
  });

  entities.set(child, Renderable, {
    id: 1,
    geometry: { kind: "box", size: [1, 1, 1] },
    material: {
      kind: "standard",
      color: 0xaa44a8,
      roughness: 0.5,
      metalness: 0.1,
    },
    flags: { castShadow: true, receiveShadow: true },
  });

  // Spin
  entities.add(cube, Spin, {
    speed: 1.5, // rad/sec
  });

  // entities.add(child, Spin, {
  //   speed: -3.0, // rad/sec
  // });
};

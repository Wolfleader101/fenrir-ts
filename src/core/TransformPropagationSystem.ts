// TransformPropagationSystem.ts
import {
  Relationship,
  Transform,
  WorldTransform,
} from "./ECS/DefaultComponents";
import type { SystemFn } from "./SystemCtx";
import { Vector3, Quaternion } from "three";

const TMP_POS = new Vector3();
const TMP_SCALED = new Vector3();
const TMP_ROT = new Quaternion();

function ensureWorld(ctx: any, e: number) {
  if (!ctx.entities.has(e, WorldTransform)) {
    ctx.entities.set(e, WorldTransform, {
      position: new Vector3(),
      rotation: new Quaternion(),
      scale: new Vector3(1, 1, 1),
    });
  }
}

function composeWorld(
  parentW: { position: Vector3; rotation: Quaternion; scale: Vector3 },
  local: { position: Vector3; rotation: Quaternion; scale: Vector3 },
  out: { position: Vector3; rotation: Quaternion; scale: Vector3 }
) {
  // rotation
  out.rotation.copy(parentW.rotation).multiply(local.rotation);

  // scale (component-wise)
  out.scale.copy(parentW.scale).multiply(local.scale);

  // position: parentPos + parentRot * (localPos * parentScale)
  TMP_SCALED.copy(local.position).multiply(parentW.scale);
  TMP_POS.copy(TMP_SCALED).applyQuaternion(parentW.rotation);
  out.position.copy(parentW.position).add(TMP_POS);
}

export function createTransformPropagationSystem() {
  // Reuse a stack to avoid recursion allocations
  const stack: number[] = [];

  const preUpdate: SystemFn = (ctx) => {
    // 1) Find roots: entities with Transform + Relationship where parent is null or dead
    // If you guarantee Relationship always exists, you can simplify further.
    const ROOT_QUERY = [Transform, Relationship] as const;

    ctx.entities.each(ROOT_QUERY, (e, local, rel) => {
      const parent = rel.parent;
      if (ctx.entities.isAlive(parent)) return; // not a root

      ensureWorld(ctx, e);

      // root world = local
      const w = ctx.entities.get(e, WorldTransform);
      w.position.copy(local.position);
      w.rotation.copy(local.rotation);
      w.scale.copy(local.scale);

      // DFS over children
      stack.length = 0;
      stack.push(e);

      while (stack.length > 0) {
        const parentE = stack.pop()!;
        const parentW = ctx.entities.get(parentE, WorldTransform);

        ctx.entities.forEachChild(parentE, (child) => {
          // Only propagate if child has Transform
          if (!ctx.entities.has(child, Transform)) return;

          ensureWorld(ctx, child);

          const childLocal = ctx.entities.get(child, Transform);
          const childW = ctx.entities.get(child, WorldTransform);

          composeWorld(parentW, childLocal, childW);

          // continue traversal
          stack.push(child);
        });
      }
    });

    // 2) Optional: handle entities with Transform but no Relationship component
    // If you always add Relationship by default, you can remove this block.
    const LONE_QUERY = [Transform] as const;
    ctx.entities.each(LONE_QUERY, (e, local) => {
      if (ctx.entities.has(e, Relationship)) return;
      ensureWorld(ctx, e);
      const w = ctx.entities.get(e, WorldTransform);
      w.position.copy(local.position);
      w.rotation.copy(local.rotation);
      w.scale.copy(local.scale);
    });
  };

  return { preUpdate } as const;
}

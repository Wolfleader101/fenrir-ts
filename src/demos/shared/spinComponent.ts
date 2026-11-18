// Spin.ts
import { Quaternion, Vector3 } from "three";
import { defineComponent } from "@/index";
import { Transform } from "@/3d";
import type { SyncSystemFn } from "@/index";

export type Spin = {
  speed: number; // radians per second
};

export const Spin = defineComponent<Spin>("Spin");

const QUERY = [Transform, Spin] as const;

const AXIS_Y = new Vector3(0, 1, 0);
const DELTA = new Quaternion();

export const spinSystemUpdate: SyncSystemFn = (ctx) => {
  const dt = ctx.time.deltaTime;

  ctx.entities.each(QUERY, (_e, transform, spin) => {
    DELTA.setFromAxisAngle(AXIS_Y, spin.speed * dt);
    transform.rotation.multiply(DELTA);
  });
};

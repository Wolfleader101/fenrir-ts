import type { Time } from "./Time";

// TODO fix later
type Scene = {};
type EventBus = {};

export type SystemCtx = {
  time: Time;
  scene: Scene;
  events: EventBus;
  stop(): void;
};

export type SystemFn = (ctx: SystemCtx) => void;

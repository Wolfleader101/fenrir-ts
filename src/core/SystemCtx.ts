import type { EventBus } from "./EventBus";
import type { Time } from "./Time";

// TODO fix later
type Scene = {};

export type SystemCtx = {
  time: Time;
  scene: Scene;
  events: EventBus;
  stop(): void;
};

export type SystemFn = (ctx: SystemCtx) => void;

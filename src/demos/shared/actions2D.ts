import { defineAction } from "@/index";

/** Platformer controls, shared by the two platformer demos. */
export const MoveLeft = defineAction("demo.platformer.moveLeft", ["ArrowLeft", "KeyA"]);
export const MoveRight = defineAction("demo.platformer.moveRight", ["ArrowRight", "KeyD"]);
export const Jump = defineAction("demo.platformer.jump", ["Space", "ArrowUp", "KeyW", "pointer.primary"]);

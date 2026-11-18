import "@/style.css";
import { ConsoleLogger, Schedule } from "@/index";
import { createDemoGame2D } from "../shared/setup2D.ts";
import { createPhysicsSystem } from "@/physics";
import { createPlatformerPhysicsDemo } from "./platformerPhysicsDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("platformer-physics.html");
initDemoInfo("2D Platformer (Physics Engine)", [
  "WASD or Arrow keys to move",
  "SPACE to jump",
  "Powered by Jolt Physics Engine",
  "Realistic physics simulation",
  "Platform collision detection",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with the pixi2d plugin, plus DOM input and input state
const { game, input } = await createDemoGame2D(canvas, { logger, physics: createPhysicsSystem() });

const demo = createPlatformerPhysicsDemo(input.state);

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.platformerPhysics.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.platformerPhysics.update" });

await game.run();

logger.info("🎮 Physics-Based Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
logger.info("⚡ Powered by Jolt Physics Engine");

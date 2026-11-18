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
  "SPACE, W, up or a tap to jump",
  "Click the game first: keys go to the focused canvas",
  "Powered by Jolt Physics Engine",
  "Realistic physics simulation",
  "Platform collision detection",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with the pixi2d plugin. Input comes with createGame; click the canvas to give it the keys.
const { game } = await createDemoGame2D(canvas, { logger, physics: createPhysicsSystem() });

const demo = createPlatformerPhysicsDemo();

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.platformerPhysics.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.platformerPhysics.update" });

await game.run();

logger.info("🎮 Physics-Based Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
logger.info("⚡ Powered by Jolt Physics Engine");

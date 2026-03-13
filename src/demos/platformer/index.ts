import "@/style.css";
import "@/core/builderExtensions.ts";

import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { createPlatformerDemo } from "./platformerDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("platformer.html");
initDemoInfo("2D Platformer", [
  "WASD or Arrow keys to move",
  "SPACE to jump",
  "Collect coins and reach the goal",
  "Simple 2D physics with gravity",
  "Platform collision detection",
]);

const logger = new ConsoleLogger();
const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Bootstrap core engine systems with 2D renderer
const { assets, systems } = bootstrapEngine(engine, logger, {
  canvas,
  enable2D: true, // Enable PixiJS 2D renderer
  enablePhysics: false,
  enableAnimations: false,
  enableStats: true,
});

// Create platformer demo with input state
const demo = createPlatformerDemo(systems.input.state);

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎮 Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");

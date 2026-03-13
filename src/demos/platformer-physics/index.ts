import "@/style.css";
import "@/core/builderExtensions.ts";

import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
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

// Bootstrap core engine systems with 2D renderer AND physics
const { assets, systems } = bootstrapEngine(engine, logger, {
  canvas,
  enable2D: true, // Enable PixiJS 2D renderer
  enablePhysics: true, // Enable Jolt Physics
  enableAnimations: false,
  enableStats: true,
});

// Create platformer demo with physics and input state
const demo = createPlatformerPhysicsDemo(systems.input.state);

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎮 Physics-Based Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
logger.info("⚡ Powered by Jolt Physics Engine");

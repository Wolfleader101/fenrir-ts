import "@/style.css";
import "@/core/builderExtensions.ts";

import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { create2DDemo } from "./pixi2dDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("pixi2d.html");
initDemoInfo("2D Demo (PixiJS)", [
  "2D rendering with PixiJS",
  "Graphics shapes (circles, rects)",
  "Text rendering",
  "Transform animations",
  "ECS architecture",
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
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  enable2D: true, // Enable PixiJS 2D renderer
  enablePhysics: false,
  enableAnimations: false,
  enableStats: true,
});

const demo = create2DDemo();

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎨 2D Demo started!");
logger.info("🎮 PixiJS 2D Renderer active");

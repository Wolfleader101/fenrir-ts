import "@/style.css";
import "@/core/builderExtensions.ts";

import { Vector3 } from "three";
import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { createStackingBlocksDemo } from "./stackingBlocksDemo.ts";
import { createECSCameraController } from "../shared/CameraController.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("stacking-blocks.html");
initDemoInfo("Stacking Blocks Demo (WebGPU)", [
  "Physics-based construction",
  "Pyramid and tower structures",
  "Dynamic block spawning",
  "Collision detection",
  "WASD + Mouse: Camera controls",
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

// Bootstrap core engine systems with physics enabled
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  enablePhysics: true,
  enableAnimations: false,
  enableStats: true,
  rendererType: "webgpu",
});

// Camera controller
const cameraController = createECSCameraController({
  target: new Vector3(0, 0, 0),
  distance: 25,
  fov: 75,
  near: 0.1,
  far: 1000,
});

// Load and initialize stacking blocks demo
const demo = createStackingBlocksDemo(assets);

engine
  .addSystems(Schedule.Init, [cameraController.init, demo.init])
  .addSystems(Schedule.Update, [cameraController.update, demo.update])
  .addSystems(Schedule.Exit, [cameraController.exit])
  .run();

logger.info("🧱 Stacking Blocks Demo started!");
logger.info("📦 Random blocks spawn every 3 seconds");
logger.info("🎥 WASD + Mouse for camera controls");
logger.info("⌨️ Press F3 to toggle Debug UI");

import "@/style.css";
import "@/core/builderExtensions.ts";

import { Vector3 } from "three";
import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { createPhysicsDemo } from "./physicsDemo.ts";
import { createECSCameraController } from "../shared/CameraController.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("index.html");
initDemoInfo("Physics Demo (WebGPU)", [
  "Entity Component System architecture",
  "WebGPU rendering with Three.js",
  "Jolt Physics integration",
  "Dynamic object spawning",
  "Multiple material types",
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
  enableAnimations: true,
  enableStats: true,
  rendererType: "webgpu",
});

// Camera controller
const cameraController = createECSCameraController({
  target: new Vector3(0, 0, 0),
  distance: 30,
  fov: 75,
  near: 0.1,
  far: 1000,
});

engine
  .addSystems(Schedule.Init, [cameraController.init])
  .addSystems(Schedule.Update, [cameraController.update])
  .addSystems(Schedule.Exit, [cameraController.exit]);

// Load and initialize physics demo
const demo = createPhysicsDemo(assets);

engine
  .addSystem(Schedule.PostInit, demo.init)
  .addSystem(Schedule.Update, demo.update);

// Start the engine
engine.run();

logger.info("🎮 Physics Demo started!");
logger.info("📦 Dynamic object spawning enabled");
logger.info("🎥 WASD + Mouse for camera controls");
logger.info("⌨️ Press F3 to toggle Debug UI");
logger.info("🔧 Physics debug rendering enabled - toggle in Debug UI");

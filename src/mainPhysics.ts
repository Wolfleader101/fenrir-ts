import "./style.css";

import "@/core/builderExtensions.ts";
import { Vector3 } from "three";

import { createDomInputSystems } from "./core/InputSystem/DOMInputSystem.ts";
import { Engine } from "./core/Engine.ts";
import { Schedule, Scheduler } from "./core/Scheduler.ts";
import { createInputStateSystem } from "./core/InputSystem/InputStateSystem.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { EventBus } from "./core/EventBus.ts";
import { ConsoleLogger } from "./core/ConsoleLogger.ts";
import type { ILogger } from "./core/ILogger.ts";
import { createThreeRendererSystem } from "./core/Renderer/ThreeRendererSystem.ts";
import { AssetStore } from "./core/Assets/AssetStore.ts";
import { createAnimationSystem } from "./core/Animation/index.ts";

// Physics imports (simplified)
import { createPhysicsSystem } from "./core/Physics/PhysicsSystem";

// Camera and skybox systems
import { createCameraSystem } from "./core/Camera/CameraSystem.ts";
import { createSkyboxSystem } from "./core/Skybox/SkyboxSystem.ts";

import { createPhysicsDemo } from "./game/physicsDemo.ts";
import { createECSCameraController } from "./game/CameraController.ts";
import { createStatsSystem } from "./core/Util/Stats.ts";

const logger: ILogger = new ConsoleLogger();

const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

// Create AssetStore (no custom loaders needed for basic demo)
const assetStore = new AssetStore({});

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

// Input systems
const domInput = createDomInputSystems({
  target: window,
  preventDefaults: true,
});

const input = createInputStateSystem();

// Renderer
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Camera and skybox systems
const cameraSystem = createCameraSystem();
const skyboxSystem = createSkyboxSystem({ assets: assetStore });

const renderer = createThreeRendererSystem({
  logger,
  canvas,
  clearColor: 0x101010,
  assets: assetStore,
  cameraSystem,
  skyboxSystem,
});

// Animation system
const animations = createAnimationSystem({
  assets: assetStore,
  logger,
  renderer: renderer.renderer,
});

// Physics system (simplified single system like the demo)
const physics = createPhysicsSystem();

// Demo scene
const physicsDemo = createPhysicsDemo(assetStore);

// New ECS-based camera controller - use the new function with proper config
const cameraController = createECSCameraController({
  target: new Vector3(0, 0, 0),
  distance: 30,
  fov: 75,
  near: 0.1,
  far: 1000,
});

const stats = createStatsSystem(document.body);

// Configure the engine with all systems
engine
  // Initialization phase - setup systems
  .addSystems(Schedule.Init, [
    domInput.init,
    renderer.init,
    animations.init,
    physics.init,
    cameraSystem.init,
    skyboxSystem.init,
    cameraController.init,
  ])

  // Post-initialization phase - create content
  .addSystems(Schedule.PostInit, [
    physicsDemo.init, // Create demo scene after physics is ready
  ])

  // Pre-update phase - input, cameras, and animations
  .addSystems(Schedule.PreUpdate, [
    input.preUpdate,
    cameraSystem.preUpdate,
    skyboxSystem.preUpdate,
    animations.preUpdate,
  ])

  // Main tick phase - physics
  .addSystems(Schedule.Tick, [
    physics.tick, // Single physics system handles everything
  ])

  // Update phase - camera controls and demo updates
  .addSystems(Schedule.Update, [
    cameraSystem.update,
    cameraController.update,
    physicsDemo.update, // Re-enabled demo spawning
    renderer.update, // Render with updated transforms
  ])

  // Post-update phase - final rendering
  .addSystems(Schedule.PostUpdate, [renderer.postUpdate, stats.postUpdate])

  // Cleanup phase
  .addSystems(Schedule.Exit, [
    domInput.exit,
    renderer.exit,
    animations.exit,
    physics.exit,
    cameraSystem.exit,
    skyboxSystem.exit,
    cameraController.exit,
  ])
  .run();

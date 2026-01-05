import "./style.css";

import "@/core/builderExtensions.ts";

import { createDomInputSystems } from "./core/InputSystem/DOMInputSystem.ts";
import { Engine } from "./core/Engine.ts";
import { Schedule, Scheduler } from "./core/Scheduler.ts";
import { createInputStateSystem } from "./core/InputSystem/InputStateSystem.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { EventBus } from "./core/EventBus.ts";
import { ConsoleLogger } from "./core/ConsoleLogger.ts";
import type { ILogger } from "./core/ILogger.ts";
import { createTransformPropagationSystem } from "./core/TransformPropagationSystem.ts";
import { createThreeRendererSystem } from "./core/Renderer/ThreeRendererSystem.ts";
import { spinSystem } from "./game/spin.ts";
import { createTestScene } from "./game/testScene.ts";
import { AssetStore } from "./core/Assets/AssetStore.ts";
import { createObjLoader } from "./core/Assets/loaders/objLoader.ts";
import { createHdrTextureLoader } from "./core/Assets/loaders/hdrTextureLoader.ts";
import { createAnimationSystem } from "./core/Animation/index.ts";

const logger: ILogger = new ConsoleLogger();

const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

// Create enhanced AssetStore with custom loaders
const assetStore = new AssetStore({
  modelLoaders: {
    obj: {
      loader: createObjLoader(),
      extensions: ["obj"],
    },
  },
  textureLoaders: {
    hdr: {
      loader: createHdrTextureLoader(),
      extensions: ["hdr", "exr"],
    },
  },
});

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

const domInput = createDomInputSystems({
  target: window,
  preventDefaults: true,
});

const input = createInputStateSystem();

const transformPropagation = createTransformPropagationSystem();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const renderer = createThreeRendererSystem({
  logger,
  canvas,
  clearColor: 0x101010,
  assets: assetStore,
});

const animations = createAnimationSystem({
  assets: assetStore,
  logger,
  renderer: renderer.renderer,
});

const testScene = await createTestScene(assetStore);

engine
  .addSystems(Schedule.Init, [
    domInput.init,
    renderer.init,
    animations.init,

    testScene.init,
  ])
  .addSystems(Schedule.PreUpdate, [
    input.preUpdate,
    transformPropagation.preUpdate,
    animations.preUpdate,
    spinSystem,
  ])
  .addSystem(Schedule.Update, renderer.update)
  .addSystem(Schedule.PostUpdate, renderer.postUpdate)
  .addSystems(Schedule.Exit, [domInput.exit, renderer.exit, animations.exit])
  .run();

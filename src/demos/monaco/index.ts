import "@/core/builderExtensions.ts";

import * as monaco from "monaco-editor";
import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { spinSystemUpdate } from "../shared/spinComponent.ts";
import { initDemoNav } from "@/shared/demoNav.ts";
import { typescript } from "monaco-editor";
import { initMonacoWorkers } from "./initMonacoWorkers.ts";

// Import refactored components
import { TypeScriptTranspiler } from "@/editor/TypeScriptTranspiler";
import {
  SandboxProvider,
  ThreeJsPlugin,
  EngineApisPlugin,
  UtilitiesPlugin,
} from "@/editor/SandboxProvider";
import { CodeExecutor } from "@/editor/CodeExecutor";
import { LiveEngineController } from "@/editor/LiveEngineController";
import { UIController } from "@/editor/UIController";
import { ErrorDisplay } from "@/editor/ErrorDisplay";
import type { UserScript } from "@/editor/types";

// Initialize navigation
initDemoNav("monaco-editor.html");

initMonacoWorkers();

// Initialize Monaco Editor
const editorContainer = document.getElementById(
  "editor-container",
) as HTMLElement;

const defaultScript = await fetch("/defaultScript.ts").then((r) => r.text());

const uri = monaco.Uri.parse("file:///main.ts");

const model =
  monaco.editor.getModel(uri) ??
  monaco.editor.createModel(defaultScript, "typescript", uri);

const editor = monaco.editor.create(editorContainer, {
  value: defaultScript,
  language: "typescript",
  theme: "vs-dark",
  automaticLayout: true,
  minimap: {
    enabled: true,
  },
  fontSize: 14,
  lineNumbers: "on",
  scrollBeyondLastLine: true,
  wordWrap: "on",
  model,
});

// Load type definitions
const [fenrirDts, threeShim, fenrirGlobals] = await Promise.all([
  fetch("/fenrir.d.ts").then((r) => r.text()),
  fetch("/three-shim.d.ts").then((r) => r.text()),
  fetch("/fenrir-globals.d.ts").then((r) => r.text()),
]);

typescript.typescriptDefaults.addExtraLib(
  threeShim,
  "file:///types/three-shim.d.ts",
);
typescript.typescriptDefaults.addExtraLib(
  fenrirDts,
  "file:///types/fenrir.d.ts",
);

typescript.typescriptDefaults.addExtraLib(
  fenrirGlobals,
  "file:///types/fenrir-globals.d.ts",
);

// Initialize game engine
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

// Bootstrap core engine systems (but don't start yet)
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  enablePhysics: true, // Enable physics for bouncing balls
  enableAnimations: true,
  enableStats: false,
  rendererType: "webgpu",
});

// Add spin system
engine.addSystems(Schedule.Update, [spinSystemUpdate]);

// Create live engine controller
const controller = new LiveEngineController(engine);

// Initialize sandbox provider
const sandboxProvider = new SandboxProvider()
  .register(ThreeJsPlugin)
  .register(EngineApisPlugin)
  .register(UtilitiesPlugin);

// Initialize code executor
const codeExecutor = new CodeExecutor();

// Initialize TypeScript transpiler
const transpiler = new TypeScriptTranspiler(model);

// UI Elements
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnPause = document.getElementById("btn-pause") as HTMLButtonElement;
const btnResume = document.getElementById("btn-resume") as HTMLButtonElement;
const btnRestart = document.getElementById("btn-restart") as HTMLButtonElement;
const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
const statusElement = document.getElementById("status") as HTMLDivElement;
const errorPanel = document.getElementById("error-panel") as HTMLDivElement;
const errorMessage = document.getElementById("error-message") as HTMLPreElement;
const btnCloseError = document.getElementById(
  "btn-close-error",
) as HTMLButtonElement;

// Initialize UI controller
const uiController = new UIController({
  btnStart,
  btnPause,
  btnResume,
  btnRestart,
  btnSave,
  status: statusElement,
});

// Initialize error display
const errorDisplay = new ErrorDisplay({
  errorPanel,
  errorMessage,
  btnCloseError,
});

// Compile and transpile user code
const compileUserCode = async (): Promise<{
  success: boolean;
  script?: UserScript;
  error?: string;
}> => {
  // Step 1: Transpile TypeScript to JavaScript
  const transpileResult = await transpiler.transpile();

  if (!transpileResult.success || !transpileResult.javascript) {
    // Check for TypeScript diagnostics and display them
    const diagnostics = await transpiler.getDiagnostics();
    if (diagnostics.length > 0) {
      transpiler.displayDiagnostics(diagnostics);
    }
    return {
      success: false,
      error: transpileResult.error || "Transpilation failed",
    };
  }

  // Clear any previous diagnostics
  transpiler.clearDiagnostics();

  // Step 2: Build sandbox context
  const ctx = {
    scene: sceneManager.getActiveScene(),
    entities: sceneManager.getActiveScene().entityList,
    time: engine.getTime(),
    logger,
    events: eventBus,
    scenes: sceneManager,
    stop: () => engine.stop(),
  };

  const sandbox = sandboxProvider.build(ctx, assets);

  // Step 3: Execute transpiled code in sandbox
  const executionResult = codeExecutor.execute(
    transpileResult.javascript,
    sandbox,
  );

  if (!executionResult.success || !executionResult.script) {
    return {
      success: false,
      error: executionResult.error || "Code execution failed",
    };
  }

  // Step 4: Wrap systems with error handling
  const wrappedScript: UserScript = {
    // Async systems
    preInit: executionResult.script.preInit
      ? executionResult.script.preInit
      : undefined,
    init: executionResult.script.init ? executionResult.script.init : undefined,
    postInit: executionResult.script.postInit
      ? executionResult.script.postInit
      : undefined,
    exit: executionResult.script.exit ? executionResult.script.exit : undefined,
    // Sync systems
    preUpdate: executionResult.script.preUpdate
      ? executionResult.script.preUpdate
      : undefined,
    tick: executionResult.script.tick ? executionResult.script.tick : undefined,
    update: executionResult.script.update
      ? executionResult.script.update
      : undefined,
    postUpdate: executionResult.script.postUpdate
      ? executionResult.script.postUpdate
      : undefined,
  };

  return { success: true, script: wrappedScript };
};

// Button handlers
btnStart.addEventListener("click", async () => {
  errorDisplay.hideError();

  const result = await compileUserCode();

  if (!result.success || !result.script) {
    errorDisplay.showError(`Compilation Error:\n${result.error}`);
    return;
  }

  const startResult = await controller.start(result.script);

  if (!startResult.success) {
    errorDisplay.showError(`Start Error:\n${startResult.error}`);
    return;
  }

  uiController.updateButtonStates(controller.getState());
  logger.info("🎮 Engine started!");
});

btnPause.addEventListener("click", () => {
  const result = controller.pause();

  if (!result.success) {
    errorDisplay.showError(`Pause Error:\n${result.error}`);
    return;
  }

  uiController.updateButtonStates(controller.getState());
  logger.info("⏸ Engine paused");
});

btnResume.addEventListener("click", () => {
  const result = controller.resume();

  if (!result.success) {
    errorDisplay.showError(`Resume Error:\n${result.error}`);
    return;
  }

  uiController.updateButtonStates(controller.getState());
  logger.info("▶ Engine resumed");
});

btnRestart.addEventListener("click", async () => {
  errorDisplay.hideError();

  const result = await compileUserCode();

  if (!result.success || !result.script) {
    errorDisplay.showError(`Compilation Error:\n${result.error}`);
    return;
  }

  const restartResult = await controller.restart(result.script);

  if (!restartResult.success) {
    errorDisplay.showError(`Restart Error:\n${restartResult.error}`);
    return;
  }

  uiController.updateButtonStates(controller.getState());
  logger.info("⏹ Engine restarted!");
});

btnSave.addEventListener("click", async () => {
  errorDisplay.hideError();

  const state = controller.getState();

  if (state === "stopped") {
    logger.warn("⚠ Engine is stopped. Use Start to run the code.");
    return;
  }

  const result = await compileUserCode();

  if (!result.success || !result.script) {
    errorDisplay.showError(`Compilation Error:\n${result.error}`);
    return;
  }

  const hotReloadResult = controller.hotReload(result.script);

  if (!hotReloadResult.success) {
    errorDisplay.showError(`Hot Reload Error:\n${hotReloadResult.error}`);
    return;
  }

  logger.info("💾 Code hot-reloaded successfully!");
});

// Ctrl+S keyboard shortcut
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
  btnSave.click();
});

// Initialize button states
uiController.updateButtonStates(controller.getState());

logger.info("✏️ Monaco Editor initialized!");
logger.info("📝 Edit code and press Ctrl+S or click Save to hot-reload");
logger.info("▶ Press Start to begin");

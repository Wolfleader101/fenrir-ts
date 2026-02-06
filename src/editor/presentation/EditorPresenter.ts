import type { IEditorModel } from "./EditorModel";
import type { IEditorView } from "./EditorView";
import type { IEngineController } from "../interfaces";
import type { ITranspiler } from "../interfaces";
import type { ICodeExecutor } from "../interfaces";
import type { ISandboxProvider } from "../interfaces";
import type { SystemCtx } from "@/core/SystemCtx";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import type { ErrorBus } from "../events";

/**
 * EditorPresenter - Business logic layer (Presenter in MVP)
 * Coordinates between Model, View, and editor services
 * Handles all user interactions and updates
 */
export class EditorPresenter {
  private readonly model: IEditorModel;
  private readonly view: IEditorView;
  private readonly engineController: IEngineController;
  private readonly transpiler: ITranspiler;
  private readonly codeExecutor: ICodeExecutor;
  private readonly sandboxProvider: ISandboxProvider;
  private readonly errorBus: ErrorBus;
  private readonly buildContext: () => SystemCtx;
  private readonly assets: IAssetStore;

  constructor(
    model: IEditorModel,
    view: IEditorView,
    engineController: IEngineController,
    transpiler: ITranspiler,
    codeExecutor: ICodeExecutor,
    sandboxProvider: ISandboxProvider,
    errorBus: ErrorBus,
    buildContext: () => SystemCtx,
    assets: IAssetStore,
  ) {
    this.model = model;
    this.view = view;
    this.engineController = engineController;
    this.transpiler = transpiler;
    this.codeExecutor = codeExecutor;
    this.sandboxProvider = sandboxProvider;
    this.errorBus = errorBus;
    this.buildContext = buildContext;
    this.assets = assets;

    // Subscribe to model changes and update view
    this.model.subscribe((state) => {
      this.view.updateButtonStates(state.engineState);
      this.view.updateStatus(state.engineState);

      if (state.hasError && state.errorMessage) {
        this.view.showError(state.errorMessage);
      }
    });

    // Subscribe to error bus
    this.errorBus.subscribe({
      handle: (event) => {
        const errorMsg = `${event.type} Error:\n${event.error.message}`;
        this.model.setError(errorMsg);
      },
    });

    // Initialize view with current state
    const initialState = this.model.getState();
    this.view.updateButtonStates(initialState.engineState);
    this.view.updateStatus(initialState.engineState);
  }

  async handleStart(): Promise<void> {
    this.model.clearError();

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = await this.engineController.start(script);

    if (!result.success) {
      this.model.setError(`Start Error:\n${result.error}`);
      return;
    }

    this.model.setEngineState("running");
    this.model.setScript(script);
    this.view.logInfo("🎮 Engine started!");
  }

  handlePause(): void {
    const result = this.engineController.pause();

    if (!result.success) {
      this.model.setError(`Pause Error:\n${result.error}`);
      return;
    }

    this.model.setEngineState("paused");
    this.view.logInfo("⏸ Engine paused");
  }

  handleResume(): void {
    const result = this.engineController.resume();

    if (!result.success) {
      this.model.setError(`Resume Error:\n${result.error}`);
      return;
    }

    this.model.setEngineState("running");
    this.view.logInfo("▶ Engine resumed");
  }

  async handleRestart(): Promise<void> {
    this.model.clearError();

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = await this.engineController.restart(script);

    if (!result.success) {
      this.model.setError(`Restart Error:\n${result.error}`);
      return;
    }

    this.model.setEngineState("running");
    this.model.setScript(script);
    this.view.logInfo("⏹ Engine restarted!");
  }

  async handleSave(): Promise<void> {
    this.model.clearError();

    const state = this.model.getState();

    if (state.engineState === "stopped") {
      this.view.logWarning("⚠ Engine is stopped. Use Start to run the code.");
      return;
    }

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = this.engineController.hotReload(script);

    if (!result.success) {
      this.model.setError(`Hot Reload Error:\n${result.error}`);
      return;
    }

    this.model.setScript(script);
    this.view.logInfo("💾 Code hot-reloaded successfully!");
  }

  handleCloseError(): void {
    this.model.clearError();
    this.view.hideError();
  }

  private async compileAndExecuteCode() {
    // Step 1: Transpile TypeScript to JavaScript
    const transpileResult = await this.transpiler.transpile();

    if (!transpileResult.success || !transpileResult.javascript) {
      this.errorBus.publish({
        type: "transpilation",
        error: new Error(transpileResult.error || "Transpilation failed"),
        timestamp: Date.now(),
      });
      return null;
    }

    // Step 2: Build sandbox
    const ctx = this.buildContext();
    const sandbox = this.sandboxProvider.build(ctx, this.assets);

    // Step 3: Execute JavaScript code in sandbox
    const executionResult = this.codeExecutor.execute(
      transpileResult.javascript,
      sandbox,
    );

    if (!executionResult.success || !executionResult.script) {
      this.errorBus.publish({
        type: "execution",
        error: new Error(executionResult.error || "Execution failed"),
        timestamp: Date.now(),
      });
      return null;
    }

    return executionResult.script;
  }
}

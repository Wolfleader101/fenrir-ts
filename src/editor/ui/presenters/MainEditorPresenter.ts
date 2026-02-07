import { Signal } from "signal-polyfill";
import type { EditorStore } from "../stores";
import type { IEngineController } from "../../interfaces";
import type { ITranspiler } from "../../interfaces";
import type { ICodeExecutor } from "../../interfaces";
import type { ISandboxProvider } from "../../interfaces";
import type { SystemCtx } from "@/core/SystemCtx";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import type { ILogger } from "@/core/ILogger";
import type { ErrorBus } from "../../events";
import {
  ControlBarPresenter,
  StatusBadgePresenter,
  ErrorModalPresenter,
  type ControlAction,
} from "./index";

/**
 * MainEditorPresenter - Orchestrates all editor business logic
 * Creates and coordinates sub-presenters, manages engine operations,
 * handles compilation pipeline, and coordinates services
 */
export class MainEditorPresenter {
  private readonly store: EditorStore;
  private readonly engineController: IEngineController;
  private readonly transpiler: ITranspiler;
  private readonly codeExecutor: ICodeExecutor;
  private readonly sandboxProvider: ISandboxProvider;
  private readonly errorBus: ErrorBus;
  private readonly buildContext: () => SystemCtx;
  private readonly assets: IAssetStore;
  private readonly logger: ILogger;

  // Sub-presenters for UI concerns
  readonly control: ControlBarPresenter;
  readonly status: StatusBadgePresenter;
  readonly error: ErrorModalPresenter;

  constructor(options: {
    readonly store: EditorStore;
    readonly engineController: IEngineController;
    readonly transpiler: ITranspiler;
    readonly codeExecutor: ICodeExecutor;
    readonly sandboxProvider: ISandboxProvider;
    readonly errorBus: ErrorBus;
    readonly buildContext: () => SystemCtx;
    readonly assets: IAssetStore;
    readonly logger: ILogger;
  }) {
    this.store = options.store;
    this.engineController = options.engineController;
    this.transpiler = options.transpiler;
    this.codeExecutor = options.codeExecutor;
    this.sandboxProvider = options.sandboxProvider;
    this.errorBus = options.errorBus;
    this.buildContext = options.buildContext;
    this.assets = options.assets;
    this.logger = options.logger;

    // Create computed signals from store
    const engineState = new Signal.Computed(
      () => this.store.getSignal().get().engineState,
    );

    const hasError = new Signal.Computed(
      () => this.store.getSignal().get().hasError,
    );

    const errorMessage = new Signal.Computed(
      () => this.store.getSignal().get().errorMessage,
    );

    // Create sub-presenters with computed signals
    this.control = new ControlBarPresenter(engineState, (action) =>
      this.handleControlAction(action),
    );

    this.status = new StatusBadgePresenter(engineState);

    this.error = new ErrorModalPresenter(hasError, errorMessage, () =>
      this.handleErrorClose(),
    );

    // Subscribe to error bus
    this.errorBus.subscribe({
      handle: (event) => {
        const errorMsg = `${event.type} Error:\n${event.error.message}`;
        this.store.setState({
          hasError: true,
          errorMessage: errorMsg,
        });
      },
    });
  }

  /**
   * Handle control actions from ControlBarPresenter
   */
  private handleControlAction(action: ControlAction): void {
    switch (action) {
      case "start":
        this.handleStart();
        break;
      case "pause":
        this.handlePause();
        break;
      case "resume":
        this.handleResume();
        break;
      case "restart":
        this.handleRestart();
        break;
      case "save":
        this.handleSave();
        break;
    }
  }

  /**
   * Start the engine with compiled user code
   */
  async handleStart(): Promise<void> {
    this.clearError();

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = await this.engineController.start(script);

    if (!result.success) {
      this.store.setState({
        hasError: true,
        errorMessage: `Start Error:\n${result.error}`,
      });
      return;
    }

    this.store.setState({
      engineState: "running",
      currentScript: script,
    });
    this.logger.info("🎮 Engine started!");
  }

  /**
   * Pause the running engine
   */
  handlePause(): void {
    const result = this.engineController.pause();

    if (!result.success) {
      this.store.setState({
        hasError: true,
        errorMessage: `Pause Error:\n${result.error}`,
      });
      return;
    }

    this.store.setState({ engineState: "paused" });
    this.logger.info("⏸ Engine paused");
  }

  /**
   * Resume the paused engine
   */
  handleResume(): void {
    const result = this.engineController.resume();

    if (!result.success) {
      this.store.setState({
        hasError: true,
        errorMessage: `Resume Error:\n${result.error}`,
      });
      return;
    }

    this.store.setState({ engineState: "running" });
    this.logger.info("▶ Engine resumed");
  }

  /**
   * Restart the engine with recompiled code
   */
  async handleRestart(): Promise<void> {
    this.clearError();

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = await this.engineController.restart(script);

    if (!result.success) {
      this.store.setState({
        hasError: true,
        errorMessage: `Restart Error:\n${result.error}`,
      });
      return;
    }

    this.store.setState({
      engineState: "running",
      currentScript: script,
    });
    this.logger.info("🔄 Engine restarted!");
  }

  /**
   * Hot-reload code without stopping the engine
   */
  async handleSave(): Promise<void> {
    this.clearError();

    const state = this.store.getState();

    if (state.engineState === "stopped") {
      this.logger.warn("⚠ Engine is stopped. Use Start to run the code.");
      return;
    }

    const script = await this.compileAndExecuteCode();
    if (!script) return;

    const result = this.engineController.hotReload(script);

    if (!result.success) {
      this.store.setState({
        hasError: true,
        errorMessage: `Hot Reload Error:\n${result.error}`,
      });
      return;
    }

    this.store.setState({ currentScript: script });
    this.logger.info("💾 Code hot-reloaded successfully!");
  }

  /**
   * Close error modal
   */
  handleErrorClose(): void {
    this.clearError();
  }

  /**
   * Clear error state
   */
  private clearError(): void {
    this.store.setState({
      hasError: false,
      errorMessage: null,
    });
  }

  /**
   * Compile TypeScript and execute in sandbox
   * Returns UserScript on success, null on failure
   */
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

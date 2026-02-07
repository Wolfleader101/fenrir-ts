import { Signal } from "signal-polyfill";
import type { EngineState } from "../../types";

export type ControlAction = "start" | "pause" | "resume" | "restart" | "save";

/**
 * ControlBarPresenter - Business logic for ControlBar component
 * Manages button states and action handling
 */
export class ControlBarPresenter {
  private readonly engineState: Signal.Computed<EngineState>;
  private readonly onAction: (action: ControlAction) => void;

  constructor(
    engineState: Signal.Computed<EngineState>,
    onAction: (action: ControlAction) => void,
  ) {
    this.engineState = engineState;
    this.onAction = onAction;
  }

  /**
   * Get the current engine state
   */
  getState(): EngineState {
    return this.engineState.get();
  }

  /**
   * Check if start button should be enabled
   */
  canStart(): boolean {
    return this.engineState.get() === "stopped";
  }

  /**
   * Check if pause button should be enabled
   */
  canPause(): boolean {
    return this.engineState.get() === "running";
  }

  /**
   * Check if resume button should be enabled
   */
  canResume(): boolean {
    return this.engineState.get() === "paused";
  }

  /**
   * Check if restart button should be enabled
   */
  canRestart(): boolean {
    return this.engineState.get() !== "stopped";
  }

  /**
   * Handle user action from controls
   */
  handleAction(action: ControlAction): void {
    this.onAction(action);
  }
}

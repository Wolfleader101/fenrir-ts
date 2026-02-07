import { Signal } from "signal-polyfill";
import type { EngineState } from "../../types";

/**
 * StatusBadgePresenter - Business logic for StatusBadge component
 * Transforms engine state into display-ready data
 */
export class StatusBadgePresenter {
  private readonly engineState: Signal.Computed<EngineState>;

  constructor(engineState: Signal.Computed<EngineState>) {
    this.engineState = engineState;
  }

  /**
   * Get the current displayed state
   */
  getState(): EngineState {
    return this.engineState.get();
  }

  /**
   * Get computed label for current state
   */
  getLabel(): string {
    const state = this.engineState.get();
    const labels: Record<EngineState, string> = {
      running: "Running",
      paused: "Paused",
      stopped: "Stopped",
    };
    return labels[state];
  }

  /**
   * Get computed icon name for current state
   */
  getIconName(): string {
    const state = this.engineState.get();
    const icons: Record<EngineState, string> = {
      running: "circle-dot",
      paused: "circle-pause",
      stopped: "circle",
    };
    return icons[state];
  }

  /**
   * Check if icon should animate (pulse effect)
   */
  shouldAnimate(): boolean {
    return this.engineState.get() === "running";
  }
}

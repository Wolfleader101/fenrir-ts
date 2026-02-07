import { Signal } from "signal-polyfill";
import type { EngineState, UserScript } from "../types";

/**
 * EditorStore - Signal-based reactive store for editor state
 * Uses signal-polyfill for reactivity across components
 */
export interface EditorStoreState {
  engineState: EngineState;
  hasError: boolean;
  errorMessage: string | null;
  currentScript: UserScript | null;
}

export class EditorStore {
  private readonly state: Signal.State<EditorStoreState>;

  constructor(initialEngineState: EngineState = "stopped") {
    this.state = new Signal.State<EditorStoreState>({
      engineState: initialEngineState,
      hasError: false,
      errorMessage: null,
      currentScript: null,
    });
  }

  /**
   * Get the current state signal for reactive access
   */
  getSignal(): Signal.State<EditorStoreState> {
    return this.state;
  }

  /**
   * Get the current state value
   */
  getState(): EditorStoreState {
    return this.state.get();
  }

  /**
   * Update engine state
   */
  setEngineState(engineState: EngineState): void {
    this.state.set({
      ...this.state.get(),
      engineState,
    });
  }

  /**
   * Set an error message
   */
  setError(errorMessage: string): void {
    this.state.set({
      ...this.state.get(),
      hasError: true,
      errorMessage,
    });
  }

  /**
   * Clear any error state
   */
  clearError(): void {
    this.state.set({
      ...this.state.get(),
      hasError: false,
      errorMessage: null,
    });
  }

  /**
   * Set the current script
   */
  setScript(currentScript: UserScript | null): void {
    this.state.set({
      ...this.state.get(),
      currentScript,
    });
  }
}

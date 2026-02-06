import type { EngineState, UserScript } from "../types";

/**
 * EditorModel - Holds editor state (Model in MVP)
 * Manages state and notifies observers of changes
 */
export interface EditorState {
  readonly engineState: EngineState;
  readonly hasError: boolean;
  readonly errorMessage: string | null;
  readonly currentScript: UserScript | null;
}

export type StateChangeListener = (state: EditorState) => void;

export interface IEditorModel {
  getState(): EditorState;
  setEngineState(state: EngineState): void;
  setError(message: string): void;
  clearError(): void;
  setScript(script: UserScript | null): void;
  subscribe(listener: StateChangeListener): () => void;
}

export class EditorModel implements IEditorModel {
  private state: EditorState;
  private readonly listeners: StateChangeListener[] = [];

  constructor(initialEngineState: EngineState = "stopped") {
    this.state = {
      engineState: initialEngineState,
      hasError: false,
      errorMessage: null,
      currentScript: null,
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState(): EditorState {
    return this.state;
  }

  setEngineState(engineState: EngineState): void {
    this.state = { ...this.state, engineState };
    this.notifyListeners();
  }

  setError(errorMessage: string): void {
    this.state = { ...this.state, hasError: true, errorMessage };
    this.notifyListeners();
  }

  clearError(): void {
    this.state = { ...this.state, hasError: false, errorMessage: null };
    this.notifyListeners();
  }

  setScript(currentScript: UserScript | null): void {
    this.state = { ...this.state, currentScript };
    this.notifyListeners();
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) this.listeners.splice(index, 1);
    };
  }
}

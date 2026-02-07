import type { EngineState } from "../types";

/**
 * EditorView - Interface for updating UI (View in MVP)
 * Presenter calls these methods to update the view
 */
export interface IEditorView {
  // Button state updates
  updateButtonStates(state: EngineState): void;

  // Status display
  updateStatus(state: EngineState): void;

  // Error display
  showError(message: string): void;
  hideError(): void;

  // Logging
  logInfo(message: string): void;
  logWarning(message: string): void;
}

/**
 * DefaultEditorView - Legacy DOM implementation
 * @deprecated Use WebComponentEditorView instead
 */
export class DefaultEditorView implements IEditorView {
  private readonly btnStart: HTMLButtonElement;
  private readonly btnPause: HTMLButtonElement;
  private readonly btnResume: HTMLButtonElement;
  private readonly btnRestart: HTMLButtonElement;
  private readonly btnSave: HTMLButtonElement;
  private readonly statusElement: HTMLDivElement;
  private readonly errorPanel: HTMLDivElement;
  private readonly errorMessage: HTMLPreElement;
  private readonly logFn: (message: string) => void;
  private readonly warnFn: (message: string) => void;

  constructor(options: {
    btnStart: HTMLButtonElement;
    btnPause: HTMLButtonElement;
    btnResume: HTMLButtonElement;
    btnRestart: HTMLButtonElement;
    btnSave: HTMLButtonElement;
    statusElement: HTMLDivElement;
    errorPanel: HTMLDivElement;
    errorMessage: HTMLPreElement;
    logFn: (message: string) => void;
    warnFn: (message: string) => void;
  }) {
    this.btnStart = options.btnStart;
    this.btnPause = options.btnPause;
    this.btnResume = options.btnResume;
    this.btnRestart = options.btnRestart;
    this.btnSave = options.btnSave;
    this.statusElement = options.statusElement;
    this.errorPanel = options.errorPanel;
    this.errorMessage = options.errorMessage;
    this.logFn = options.logFn;
    this.warnFn = options.warnFn;
  }

  updateButtonStates(state: EngineState): void {
    this.btnStart.disabled = state !== "stopped";
    this.btnPause.disabled = state !== "running";
    this.btnResume.disabled = state !== "paused";
    this.btnRestart.disabled = state === "stopped";
    this.btnSave.disabled = false;
  }

  updateStatus(state: EngineState): void {
    this.statusElement.textContent =
      state.charAt(0).toUpperCase() + state.slice(1);
    this.statusElement.style.color =
      state === "running"
        ? "#4ec9b0"
        : state === "paused"
          ? "#dcdcaa"
          : "#d4d4d4";
  }

  showError(message: string): void {
    this.errorMessage.textContent = message;
    this.errorPanel.classList.remove("hidden");
  }

  hideError(): void {
    this.errorPanel.classList.add("hidden");
  }

  logInfo(message: string): void {
    this.logFn(message);
  }

  logWarning(message: string): void {
    this.warnFn(message);
  }
}

/**
 * WebComponentEditorView - Modern Web Components implementation
 * Uses custom elements for reactive UI updates
 */
export class WebComponentEditorView implements IEditorView {
  private readonly controlBar: HTMLElement | null;
  private readonly errorModal: HTMLElement | null;
  private readonly logFn: (message: string) => void;
  private readonly warnFn: (message: string) => void;

  constructor(options: {
    controlBar: HTMLElement | null;
    errorModal: HTMLElement | null;
    logFn: (message: string) => void;
    warnFn: (message: string) => void;
  }) {
    this.controlBar = options.controlBar;
    this.errorModal = options.errorModal;
    this.logFn = options.logFn;
    this.warnFn = options.warnFn;
  }

  updateButtonStates(state: EngineState): void {
    if (this.controlBar && "updateState" in this.controlBar) {
      (
        this.controlBar as { updateState: (state: EngineState) => void }
      ).updateState(state);
    }
  }

  updateStatus(state: EngineState): void {
    // Status is handled by control bar component
    this.updateButtonStates(state);
  }

  showError(message: string): void {
    if (this.errorModal && "showError" in this.errorModal) {
      (this.errorModal as { showError: (msg: string) => void }).showError(
        message,
      );
    }
  }

  hideError(): void {
    if (this.errorModal && "hideError" in this.errorModal) {
      (this.errorModal as { hideError: () => void }).hideError();
    }
  }

  logInfo(message: string): void {
    this.logFn(message);
  }

  logWarning(message: string): void {
    this.warnFn(message);
  }
}

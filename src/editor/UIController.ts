import type { EngineState } from "@/editor/types";

interface UIElements {
  readonly btnStart: HTMLButtonElement;
  readonly btnPause: HTMLButtonElement;
  readonly btnResume: HTMLButtonElement;
  readonly btnRestart: HTMLButtonElement;
  readonly btnSave: HTMLButtonElement;
  readonly status: HTMLDivElement;
}

export class UIController {
  private readonly elements: UIElements;

  constructor(elements: UIElements) {
    this.elements = elements;
  }

  updateButtonStates(state: EngineState): void {
    const { btnStart, btnPause, btnResume, btnRestart, btnSave, status } =
      this.elements;

    btnStart.disabled = state !== "stopped";
    btnPause.disabled = state !== "running";
    btnResume.disabled = state !== "paused";
    btnRestart.disabled = state === "stopped";
    btnSave.disabled = false;

    status.textContent = state.charAt(0).toUpperCase() + state.slice(1);
    status.style.color =
      state === "running"
        ? "#4ec9b0"
        : state === "paused"
          ? "#dcdcaa"
          : "#d4d4d4";
  }
}

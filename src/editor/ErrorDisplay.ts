interface ErrorElements {
  readonly errorPanel: HTMLDivElement;
  readonly errorMessage: HTMLPreElement;
  readonly btnCloseError: HTMLButtonElement;
}

export class ErrorDisplay {
  private readonly elements: ErrorElements;

  constructor(elements: ErrorElements) {
    this.elements = elements;
    this.setupEventListeners();
  }

  showError(error: string): void {
    this.elements.errorMessage.textContent = error;
    this.elements.errorPanel.classList.remove("hidden");
  }

  hideError(): void {
    this.elements.errorPanel.classList.add("hidden");
  }

  private setupEventListeners(): void {
    this.elements.btnCloseError.addEventListener("click", () => {
      this.hideError();
    });
  }
}

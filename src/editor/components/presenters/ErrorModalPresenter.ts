import { Signal } from "signal-polyfill";

/**
 * ErrorModalPresenter - Business logic for ErrorModal component
 * Manages error state and display
 */
export class ErrorModalPresenter {
  private readonly hasError: Signal.Computed<boolean>;
  private readonly errorMessage: Signal.Computed<string | null>;
  private readonly onClose: () => void;

  constructor(
    hasError: Signal.Computed<boolean>,
    errorMessage: Signal.Computed<string | null>,
    onClose: () => void,
  ) {
    this.hasError = hasError;
    this.errorMessage = errorMessage;
    this.onClose = onClose;
  }

  /**
   * Check if modal should be shown
   */
  isOpen(): boolean {
    return this.hasError.get();
  }

  /**
   * Get the current error message
   */
  getMessage(): string {
    return this.errorMessage.get() || "";
  }

  /**
   * Handle modal close action
   */
  handleClose(): void {
    this.onClose();
  }
}

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { tailwindStyles } from "../../utils";
import type { ErrorModalPresenter } from "../../presenters";
import "../primitives/Modal";

// Type helper to work around TypeScript issue with SignalWatcher
const SignalWatcherBase = SignalWatcher(LitElement) as typeof LitElement;

/**
 * ErrorModal - Displays error messages with syntax highlighting
 * View component that renders error state from ErrorModalPresenter
 */
@customElement("ed-error-modal")
export class ErrorModal extends SignalWatcherBase {
  static override styles = [tailwindStyles];

  @property({ attribute: false })
  presenter: ErrorModalPresenter | undefined;

  protected override render() {
    if (!this.presenter) {
      return html``;
    }

    const isOpen = this.presenter.isOpen();
    const message = this.presenter.getMessage();

    return html`
      <ed-modal
        title="Error"
        ?open=${isOpen}
        @ed-close=${() => this.handleClose()}
      >
        <pre
          class="text-sm font-mono text-gray-300 whitespace-pre-wrap bg-gray-950 p-4 rounded-md border border-gray-800 overflow-x-auto"
        >
${message}
</pre
        >
      </ed-modal>
    `;
  }

  private handleClose(): void {
    this.presenter?.handleClose();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-error-modal": ErrorModal;
  }
}

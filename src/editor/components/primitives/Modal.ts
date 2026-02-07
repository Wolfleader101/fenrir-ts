import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AlertTriangle, X } from "lucide";
import { icon, initIcons, tailwindStyles } from "../utils";

/**
 * EditorModal - Modal dialog primitive with backdrop
 * Supports close button and escape key handling
 */
@customElement("ed-modal")
export class EditorModal extends LitElement {
  static override styles = [tailwindStyles];

  @property({ type: Boolean })
  open = false;

  @property({ type: String })
  override title = "Modal";

  private keydownAbort: AbortController | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.setupEventListeners();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.keydownAbort?.abort();
  }

  private setupEventListeners(): void {
    this.keydownAbort = new AbortController();
    const { signal } = this.keydownAbort;

    document.addEventListener(
      "keydown",
      (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.open) this.closeModal();
      },
      { signal },
    );
  }

  protected override render() {
    if (!this.open) {
      return html``;
    }

    return html`
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm"
          @click=${this.closeModal}
        ></div>

        <!-- Modal Content -->
        <div
          class="relative z-10 bg-gray-900 border-2 border-red-500/50 rounded-lg shadow-2xl max-w-2xl max-h-[80vh] overflow-auto m-4"
        >
          <!-- Header -->
          <div
            class="flex items-center justify-between px-6 py-4 border-b border-gray-800"
          >
            <div class="flex items-center gap-3">
              ${icon("alert-triangle", "w-6 h-6 text-red-400")}
              <h2 class="text-lg font-bold text-red-400">${this.title}</h2>
            </div>
            <button
              class="text-gray-400 hover:text-white transition-colors p-1"
              @click=${this.closeModal}
            >
              ${icon("x", "w-5 h-5")}
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4">
            <slot></slot>
          </div>
        </div>
      </div>
    `;
  }

  protected override updated(): void {
    // Initialize icons after each render in shadow root
    if (this.shadowRoot && this.open) {
      initIcons(
        {
          AlertTriangle,
          X,
        },
        this.shadowRoot,
      );
    }
  }

  closeModal(): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent("ed-close", { bubbles: true, composed: true }),
    );
  }

  openModal(): void {
    this.open = true;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-modal": EditorModal;
  }
}

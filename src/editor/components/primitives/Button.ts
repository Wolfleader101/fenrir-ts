import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { tailwindStyles } from "../utils";

export type ButtonVariant = "primary" | "secondary" | "danger";

/**
 * EditorButton - Reusable button primitive with Tailwind styling
 * Supports primary, secondary, and danger variants
 * Accepts icon content via `icon` slot
 */
@customElement("ed-button")
export class EditorButton extends LitElement {
  @property()
  variant: ButtonVariant = "primary";

  @property({ type: Boolean })
  disabled = false;

  static override styles = [tailwindStyles];

  override render() {
    const variantClasses = {
      primary:
        "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white border-blue-700",
      secondary:
        "bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-gray-100 border-gray-600",
      danger:
        "bg-red-600 hover:bg-red-700 active:bg-red-800 text-white border-red-700",
    };

    const baseClasses =
      "px-4 py-2 rounded font-medium transition-all duration-200 border flex items-center gap-2 text-sm";
    const variantClass = variantClasses[this.variant];
    const disabledClasses = this.disabled
      ? "opacity-50 cursor-not-allowed pointer-events-none"
      : "cursor-pointer";

    return html`
      <button
        class="${baseClasses} ${variantClass} ${disabledClasses}"
        ?disabled=${this.disabled}
        @click=${this.handleClick}
      >
        <slot name="icon"></slot>
        <slot></slot>
      </button>
    `;
  }

  private handleClick(): void {
    if (!this.disabled) {
      this.dispatchEvent(
        new CustomEvent("ed-click", { bubbles: true, composed: true }),
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-button": EditorButton;
  }
}

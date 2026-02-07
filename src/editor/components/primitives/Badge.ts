import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { tailwindStyles } from "../utils";

export type BadgeVariant =
  | "default"
  | "running"
  | "paused"
  | "stopped"
  | "error"
  | "success";

export type BadgeSize = "sm" | "md" | "lg";

/**
 * EditorBadge - Status indicator primitive with color variants
 * Used for displaying engine state and other status information
 */
@customElement("ed-badge")
export class EditorBadge extends LitElement {
  @property()
  variant: BadgeVariant = "default";

  @property({ type: String })
  size: BadgeSize = "md";

  static override styles = [tailwindStyles];

  override render() {
    const variantClasses = {
      default: "bg-gray-700 text-gray-100 border-gray-600",
      running: "bg-emerald-600/20 text-emerald-400 border-emerald-600/50",
      paused: "bg-yellow-600/20 text-yellow-400 border-yellow-600/50",
      stopped: "bg-gray-700/20 text-gray-400 border-gray-600/50",
      error: "bg-red-600/20 text-red-400 border-red-600/50",
      success: "bg-green-600/20 text-green-400 border-green-600/50",
    };

    const sizeClasses = {
      sm: "text-xs px-2 py-0.5",
      md: "text-sm px-3 py-1",
      lg: "text-base px-4 py-2",
    };

    const baseClasses =
      "inline-flex items-center gap-2 rounded-full border font-semibold transition-colors";
    const variantClass = variantClasses[this.variant];
    const sizeClass = sizeClasses[this.size];

    return html`
      <span class="${baseClasses} ${variantClass} ${sizeClass}">
        <slot></slot>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-badge": EditorBadge;
  }
}

import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { tailwindStyles } from "../../utils";

export type PanelShadow = "none" | "sm" | "md" | "lg" | "xl";

/**
 * EditorPanel - Container primitive with consistent styling
 * Supports dark theme with optional shadow and border radius
 */
@customElement("ed-panel")
export class EditorPanel extends LitElement {
  static override styles = [tailwindStyles];

  @property()
  shadow: PanelShadow = "md";

  @property()
  padding = "4";

  protected override render() {
    const shadowClasses = {
      none: "",
      sm: "shadow-sm",
      md: "shadow-md",
      lg: "shadow-lg",
      xl: "shadow-xl",
    };

    const baseClasses =
      "bg-gray-900 border border-gray-800 rounded-lg backdrop-blur-sm";
    const shadowClass = shadowClasses[this.shadow];
    const paddingClass = `p-${this.padding}`;

    return html`
      <div class="${baseClasses} ${shadowClass} ${paddingClass}">
        <slot></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-panel": EditorPanel;
  }
}

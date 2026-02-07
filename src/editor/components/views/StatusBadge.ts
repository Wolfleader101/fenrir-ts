import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { Circle, CirclePause, CircleDot } from "lucide";
import { icon, initIcons, tailwindStyles } from "../utils";
import type { StatusBadgePresenter } from "../presenters";

import "../primitives/Badge";

/**
 * StatusBadge - Displays current engine state with appropriate styling
 * View component that renders data from StatusBadgePresenter
 */
@customElement("ed-status-badge")
export class StatusBadge extends SignalWatcher(LitElement) {
  static override styles = [tailwindStyles];

  @property({ attribute: false })
  presenter: StatusBadgePresenter | undefined;

  protected override render() {
    if (!this.presenter) {
      return html`<ed-badge>No data</ed-badge>`;
    }

    const state = this.presenter.getState();
    const label = this.presenter.getLabel();
    const iconName = this.presenter.getIconName();
    const shouldAnimate = this.presenter.shouldAnimate();

    const iconClass = shouldAnimate ? "w-4 h-4 animate-pulse" : "w-4 h-4";

    return html`
      <ed-badge variant="${state}" size="md">
        <span class="flex items-center gap-2">
          ${icon(iconName, iconClass)} ${label}
        </span>
      </ed-badge>
    `;
  }

  protected override updated(): void {
    // Initialize icons after each render in shadow root
    if (this.shadowRoot) {
      initIcons(
        {
          Circle,
          CirclePause,
          CircleDot,
        },
        this.shadowRoot,
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-status-badge": StatusBadge;
  }
}

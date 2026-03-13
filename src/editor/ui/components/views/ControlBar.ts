import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { Play, Pause, RotateCcw, Save } from "lucide";
import { slottedIcon, initIcons, tailwindStyles } from "../../utils";
import type {
  ControlBarPresenter,
  ControlAction,
  StatusBadgePresenter,
} from "../../presenters";
import "../primitives/Button";
import "../primitives/Panel";
import "./StatusBadge";

// Type helper to work around TypeScript issue with SignalWatcher
const SignalWatcherBase = SignalWatcher(LitElement) as typeof LitElement;

/**
 * ControlBar - Editor control panel with play/pause/restart/save buttons
 * View component that renders controls based on ControlBarPresenter state
 */
@customElement("ed-control-bar")
export class ControlBar extends SignalWatcherBase {
  static override styles = [tailwindStyles];

  @property({ attribute: false })
  presenter: ControlBarPresenter | undefined;

  @property({ attribute: false })
  statusPresenter: StatusBadgePresenter | undefined;

  protected override render() {
    if (!this.presenter) {
      return html`<div>No presenter</div>`;
    }

    const state = this.presenter.getState();
    const canPause = this.presenter.canPause();
    const canRestart = this.presenter.canRestart();

    // Determine start/resume button state
    const isStartResumeEnabled = state === "stopped" || state === "paused";
    const startResumeLabel = state === "paused" ? "Resume" : "Start";
    const startResumeAction: ControlAction =
      state === "paused" ? "resume" : "start";

    return html`
      <ed-panel shadow="xl" padding="4">
        <div class="flex items-center gap-3">
          <!-- Start/Resume Button -->
          <ed-button
            variant="primary"
            ?disabled=${!isStartResumeEnabled}
            @ed-click=${() => this.handleAction(startResumeAction)}
          >
            ${slottedIcon("play")} ${startResumeLabel}
          </ed-button>

          <!-- Pause Button -->
          <ed-button
            variant="secondary"
            ?disabled=${!canPause}
            @ed-click=${() => this.handleAction("pause")}
          >
            ${slottedIcon("pause")} Pause
          </ed-button>

          <!-- Restart Button -->
          <ed-button
            variant="secondary"
            ?disabled=${!canRestart}
            @ed-click=${() => this.handleAction("restart")}
          >
            ${slottedIcon("rotate-ccw")} Restart
          </ed-button>

          <!-- Save Button -->
          <ed-button
            variant="primary"
            @ed-click=${() => this.handleAction("save")}
          >
            ${slottedIcon("save")} Save
            <span class="text-xs opacity-70">(Ctrl+S)</span>
          </ed-button>

          <!-- Divider -->
          <div class="h-8 w-px bg-gray-700 mx-2"></div>

          <!-- Status Badge -->
          <ed-status-badge .presenter=${this.statusPresenter}></ed-status-badge>
        </div>
      </ed-panel>
    `;
  }

  protected override updated(): void {
    // Initialize icons after each render in shadow root
    if (this.shadowRoot) {
      initIcons(
        {
          Play,
          Pause,
          RotateCcw,
          Save,
        },
        this.shadowRoot,
      );
    }
  }

  private handleAction(action: ControlAction): void {
    this.presenter?.handleAction(action);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ed-control-bar": ControlBar;
  }
}

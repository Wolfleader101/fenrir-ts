import { Signal } from "signal-polyfill";
import { EditorStore } from "./stores";
import {
  StatusBadgePresenter,
  ControlBarPresenter,
  ErrorModalPresenter,
  type ControlAction,
} from "./components/presenters";

export interface ComponentWiringOptions {
  readonly controlBarSelector?: string;
  readonly errorModalSelector?: string;
  readonly onControlAction: (action: ControlAction) => void;
  readonly onErrorClose: () => void;
}

export interface WiredComponents {
  readonly store: EditorStore;
  readonly statusPresenter: StatusBadgePresenter;
  readonly controlPresenter: ControlBarPresenter;
  readonly errorPresenter: ErrorModalPresenter;
}

/**
 * Wire up the signal-based store and presenters to the web components
 * This connects the MVP architecture together
 */
export const wireComponentsWithSignals = (
  options: ComponentWiringOptions,
): WiredComponents => {
  const {
    controlBarSelector = "ed-control-bar",
    errorModalSelector = "ed-error-modal",
    onControlAction,
    onErrorClose,
  } = options;

  // Create the signal-based store
  const store = new EditorStore("stopped");

  // Create computed signals from the store
  const engineState = new Signal.Computed(
    () => store.getSignal().get().engineState,
  );

  const hasError = new Signal.Computed(() => store.getSignal().get().hasError);

  const errorMessage = new Signal.Computed(
    () => store.getSignal().get().errorMessage,
  );

  // Create presenters with computed signals
  const statusPresenter = new StatusBadgePresenter(engineState);

  const controlPresenter = new ControlBarPresenter(
    engineState,
    onControlAction,
  );

  const errorPresenter = new ErrorModalPresenter(
    hasError,
    errorMessage,
    onErrorClose,
  );

  // Wire up the components with their presenters
  const controlBar = document.querySelector(controlBarSelector);
  if (controlBar) {
    (controlBar as HTMLElement & { presenter: ControlBarPresenter }).presenter =
      controlPresenter;
    (
      controlBar as HTMLElement & { statusPresenter: StatusBadgePresenter }
    ).statusPresenter = statusPresenter;
  }

  const errorModal = document.querySelector(errorModalSelector);
  if (errorModal) {
    (errorModal as HTMLElement & { presenter: ErrorModalPresenter }).presenter =
      errorPresenter;
  }

  return {
    store,
    statusPresenter,
    controlPresenter,
    errorPresenter,
  };
};

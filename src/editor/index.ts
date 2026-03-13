// Bootstrap
export {
  bootstrapEditor,
  type EditorBootstrapOptions,
  type BootstrappedEditor,
} from "./bootstrap";

// Core interfaces
export type {
  ITranspiler,
  TranspilationResult,
  ICodeExecutor,
  CodeExecutionResult,
  ISandboxProvider,
  IEngineController,
} from "./interfaces";

// Types
export type { EngineState, UserScript, OperationResult } from "./types";

// Events
export type { ErrorEvent, ErrorHandler, ErrorBus } from "./events";
export { createErrorBus } from "./events";

// Registries
export type { PluginRegistry } from "./registries";
export { createPluginRegistry } from "./registries";

// Implementations
export { TypeScriptTranspiler } from "./TypeScriptTranspiler";
export { CodeExecutor } from "./CodeExecutor";
export type { SandboxPlugin } from "./SandboxProvider";
export {
  SandboxProvider,
  ThreeJsPlugin,
  EngineApisPlugin,
  UtilitiesPlugin,
} from "./SandboxProvider";
export { LiveEngineController } from "./LiveEngineController";

// UI Layer (Signal-based MVP)
export { EditorStore, type EditorStoreState } from "./ui/stores";
export {
  MainEditorPresenter,
  ControlBarPresenter,
  StatusBadgePresenter,
  ErrorModalPresenter,
  type ControlAction,
} from "./ui/presenters";

// UI Components (Web Components)
export {
  EditorBadge,
  EditorButton,
  EditorModal,
  EditorPanel,
  StatusBadge,
  ControlBar,
  ErrorModal,
  type BadgeVariant,
  type BadgeSize,
  type ButtonVariant,
  type PanelShadow,
} from "./ui/components";

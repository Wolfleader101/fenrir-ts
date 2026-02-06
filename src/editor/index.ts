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

// Presentation Layer (MVP)
export {
  type IEditorModel,
  type EditorState,
  type StateChangeListener,
  EditorModel,
  type IEditorView,
  DefaultEditorView,
  EditorPresenter,
} from "./presentation";

// UI Components (if needed)
export { UIController } from "./UIController";
export { ErrorDisplay } from "./ErrorDisplay";

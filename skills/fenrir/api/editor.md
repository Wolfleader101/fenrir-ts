# `fenrir-ts/editor` API reference

Generated from the TSDoc in the source by `scripts/api-reference.mjs`. Do not edit: run `pnpm api:reference`.

Frozen: kept working, no new features. The Monaco live code editor.

Peer packages: `monaco-editor`. Import from `fenrir-ts/editor` only, never from `dist/` or a source path.

## Contents

- Classes: [`CodeExecutor`](#codeexecutor), [`ControlBar`](#controlbar), [`ControlBarPresenter`](#controlbarpresenter), [`EditorBadge`](#editorbadge), [`EditorButton`](#editorbutton), [`EditorModal`](#editormodal), [`EditorPanel`](#editorpanel), [`EditorStore`](#editorstore), [`ErrorModal`](#errormodal), [`ErrorModalPresenter`](#errormodalpresenter), [`LiveEngineController`](#liveenginecontroller), [`MainEditorPresenter`](#maineditorpresenter), [`SandboxProvider`](#sandboxprovider), [`StatusBadge`](#statusbadge), [`StatusBadgePresenter`](#statusbadgepresenter), [`TypeScriptTranspiler`](#typescripttranspiler)
- Constants: [`bootstrapEditor`](#bootstrapeditor), [`createErrorBus`](#createerrorbus), [`createPluginRegistry`](#createpluginregistry), [`EngineApisPlugin`](#engineapisplugin), [`ThreeJsPlugin`](#threejsplugin), [`UtilitiesPlugin`](#utilitiesplugin)
- Types: [`BadgeSize`](#badgesize), [`BadgeVariant`](#badgevariant), [`BootstrappedEditor`](#bootstrappededitor), [`ButtonVariant`](#buttonvariant), [`CodeExecutionResult`](#codeexecutionresult), [`ControlAction`](#controlaction), [`EditorBootstrapOptions`](#editorbootstrapoptions), [`EditorStoreState`](#editorstorestate), [`EngineState`](#enginestate), [`ErrorBus`](#errorbus), [`ErrorEvent`](#errorevent), [`ErrorHandler`](#errorhandler), [`ICodeExecutor`](#icodeexecutor), [`IEngineController`](#ienginecontroller), [`ISandboxProvider`](#isandboxprovider), [`ITranspiler`](#itranspiler), [`MonacoWorkerLoaders`](#monacoworkerloaders), [`OperationResult`](#operationresult), [`PanelShadow`](#panelshadow), [`PluginRegistry`](#pluginregistry), [`SandboxContext`](#sandboxcontext), [`SandboxPlugin`](#sandboxplugin), [`TranspilationResult`](#transpilationresult), [`UserScript`](#userscript)
- [Added to core types when imported](#added-to-core-types-when-imported)

## Classes

### CodeExecutor

```ts
class CodeExecutor implements ICodeExecutor {
    execute(javascript: string, sandbox: Record<string, unknown>): CodeExecutionResult;
}
```

### ControlBar

```ts
class ControlBar extends SignalWatcherBase {
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    presenter: ControlBarPresenter | undefined;
    statusPresenter: StatusBadgePresenter | undefined;
}
```

ControlBar - Editor control panel with play/pause/restart/save buttons
View component that renders controls based on ControlBarPresenter state

### ControlBarPresenter

```ts
class ControlBarPresenter {
    constructor(engineState: Signal.Computed<EngineState>, onAction: (action: ControlAction) => void);
    getState(): EngineState;
    canStart(): boolean;
    canPause(): boolean;
    canResume(): boolean;
    canRestart(): boolean;
    handleAction(action: ControlAction): void;
}
```

ControlBarPresenter - Business logic for ControlBar component
Manages button states and action handling

Members:

- `getState`: Get the current engine state
- `canStart`: Check if start button should be enabled
- `canPause`: Check if pause button should be enabled
- `canResume`: Check if resume button should be enabled
- `canRestart`: Check if restart button should be enabled
- `handleAction`: Handle user action from controls

### EditorBadge

```ts
class EditorBadge extends LitElement {
    variant: BadgeVariant;
    size: BadgeSize;
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    override render();
}
```

EditorBadge - Status indicator primitive with color variants
Used for displaying engine state and other status information

### EditorButton

```ts
class EditorButton extends LitElement {
    variant: ButtonVariant;
    disabled: boolean;
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    override render();
}
```

EditorButton - Reusable button primitive with Tailwind styling
Supports primary, secondary, and danger variants
Accepts icon content via `icon` slot

### EditorModal

```ts
class EditorModal extends LitElement {
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    open: boolean;
    override title: string;
    override connectedCallback(): void;
    override disconnectedCallback(): void;
    closeModal(): void;
    openModal(): void;
}
```

EditorModal - Modal dialog primitive with backdrop
Supports close button and escape key handling

### EditorPanel

```ts
class EditorPanel extends LitElement {
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    shadow: PanelShadow;
    padding: string;
}
```

EditorPanel - Container primitive with consistent styling
Supports dark theme with optional shadow and border radius

### EditorStore

```ts
class EditorStore {
    constructor(initialEngineState: EngineState);
    getSignal(): Signal.State<EditorStoreState>;
    getState(): EditorStoreState;
    setState(update: Partial<EditorStoreState>): void;
}
```

Members:

- `getSignal`: Get the current state signal for reactive access
- `getState`: Get the current state value
- `setState`: Update state with partial update Business logic should be in presenters, not here

### ErrorModal

```ts
class ErrorModal extends SignalWatcherBase {
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    presenter: ErrorModalPresenter | undefined;
}
```

ErrorModal - Displays error messages with syntax highlighting
View component that renders error state from ErrorModalPresenter

### ErrorModalPresenter

```ts
class ErrorModalPresenter {
    constructor(hasError: Signal.Computed<boolean>, errorMessage: Signal.Computed<string | null>, onClose: () => void);
    isOpen(): boolean;
    getMessage(): string;
    handleClose(): void;
}
```

ErrorModalPresenter - Business logic for ErrorModal component
Manages error state and display

Members:

- `isOpen`: Check if modal should be shown
- `getMessage`: Get the current error message
- `handleClose`: Handle modal close action

### LiveEngineController

```ts
class LiveEngineController implements IEngineController {
    constructor(engine: Engine);
    getState(): EngineState;
    start(userScript: UserScript): Promise<OperationResult>;
    pause(): OperationResult;
    resume(): OperationResult;
    restart(userScript: UserScript): Promise<OperationResult>;
    hotReload(userScript: UserScript): OperationResult;
}
```

### MainEditorPresenter

```ts
class MainEditorPresenter {
    readonly control: ControlBarPresenter;
    readonly status: StatusBadgePresenter;
    readonly error: ErrorModalPresenter;
    constructor(options: {
        readonly store: EditorStore;
        readonly engineController: IEngineController;
        readonly transpiler: ITranspiler;
        readonly codeExecutor: ICodeExecutor;
        readonly sandboxProvider: ISandboxProvider;
        readonly errorBus: ErrorBus;
        readonly buildContext: () => SandboxContext;
        readonly assets: IAssetStore;
        readonly logger: ILogger;
    });
    handleStart(): Promise<void>;
    handlePause(): void;
    handleResume(): void;
    handleRestart(): Promise<void>;
    handleSave(): Promise<void>;
    handleErrorClose(): void;
}
```

MainEditorPresenter - Orchestrates all editor business logic
Creates and coordinates sub-presenters, manages engine operations,
handles compilation pipeline, and coordinates services

Members:

- `handleStart`: Start the engine with compiled user code
- `handlePause`: Pause the running engine
- `handleResume`: Resume the paused engine
- `handleRestart`: Restart the engine with recompiled code
- `handleSave`: Hot-reload code without stopping the engine
- `handleErrorClose`: Close error modal

### SandboxProvider

```ts
class SandboxProvider implements ISandboxProvider {
    register(plugin: SandboxPlugin): this;
    build(ctx: SandboxContext, assets: IAssetStore): Record<string, unknown>;
}
```

### StatusBadge

```ts
class StatusBadge extends SignalWatcherBase {
    static override styles: import("lit-element/development/lit-element").CSSResult[];
    presenter: StatusBadgePresenter | undefined;
}
```

StatusBadge - Displays current engine state with appropriate styling
View component that renders data from StatusBadgePresenter

### StatusBadgePresenter

```ts
class StatusBadgePresenter {
    constructor(engineState: Signal.Computed<EngineState>);
    getState(): EngineState;
    getLabel(): string;
    getIconName(): string;
    shouldAnimate(): boolean;
}
```

StatusBadgePresenter - Business logic for StatusBadge component
Transforms engine state into display-ready data

Members:

- `getState`: Get the current displayed state
- `getLabel`: Get computed label for current state
- `getIconName`: Get computed icon name for current state
- `shouldAnimate`: Check if icon should animate (pulse effect)

### TypeScriptTranspiler

```ts
class TypeScriptTranspiler implements ITranspiler {
    constructor(model: monaco.editor.ITextModel);
    transpile(): Promise<TranspilationResult>;
    getDiagnostics(): Promise<any[]>;
    displayDiagnostics(diagnostics: any[]): void;
    clearDiagnostics(): void;
}
```

## Constants

### bootstrapEditor

```ts
const bootstrapEditor: (options: EditorBootstrapOptions) => Promise<BootstrappedEditor>;
```

Bootstrap the Monaco Editor with all necessary components
Similar to bootstrapEngine()

### createErrorBus

```ts
const createErrorBus: () => ErrorBus;
```

### createPluginRegistry

```ts
const createPluginRegistry: () => PluginRegistry;
```

### EngineApisPlugin

```ts
const EngineApisPlugin: SandboxPlugin;
```

### ThreeJsPlugin

```ts
const ThreeJsPlugin: SandboxPlugin;
```

### UtilitiesPlugin

```ts
const UtilitiesPlugin: SandboxPlugin;
```

## Types

### BadgeSize

```ts
type BadgeSize = "sm" | "md" | "lg";
```

### BadgeVariant

```ts
type BadgeVariant = "default" | "running" | "paused" | "stopped" | "error" | "success";
```

### BootstrappedEditor

```ts
interface BootstrappedEditor {
    readonly editor: monaco.editor.IStandaloneCodeEditor;
    readonly model: monaco.editor.ITextModel;
    readonly mainPresenter: MainEditorPresenter;
    readonly errorBus: ReturnType<typeof createErrorBus>;
}
```

### ButtonVariant

```ts
type ButtonVariant = "primary" | "secondary" | "danger";
```

### CodeExecutionResult

```ts
interface CodeExecutionResult {
    readonly success: boolean;
    readonly script: UserScript | null;
    readonly error: string | null;
}
```

### ControlAction

```ts
type ControlAction = "start" | "pause" | "resume" | "restart" | "save";
```

### EditorBootstrapOptions

```ts
interface EditorBootstrapOptions {
    readonly engine: Engine;
    readonly assets: IAssetStore;
    readonly logger: ILogger;
    readonly buildContext: () => SandboxContext;
    readonly monacoWorkers: MonacoWorkerLoaders;
    readonly editorContainerId?: string;
    readonly defaultScript?: string;
    readonly additionalPlugins?: SandboxPlugin[];
}
```

### EditorStoreState

```ts
interface EditorStoreState {
    engineState: EngineState;
    hasError: boolean;
    errorMessage: string | null;
    currentScript: UserScript | null;
}
```

EditorStore - Signal-based reactive store for editor state
Uses signal-polyfill for reactivity across components

### EngineState

```ts
type EngineState = "stopped" | "running" | "paused";
```

### ErrorBus

```ts
interface ErrorBus {
    subscribe(handler: ErrorHandler): () => void;
    publish(event: ErrorEvent): void;
}
```

### ErrorEvent

```ts
interface ErrorEvent {
    readonly type: "transpilation" | "execution" | "runtime";
    readonly error: Error;
    readonly context?: string;
    readonly timestamp: number;
}
```

### ErrorHandler

```ts
interface ErrorHandler {
    handle(event: ErrorEvent): void;
}
```

### ICodeExecutor

```ts
interface ICodeExecutor {
    execute(javascript: string, sandbox: Record<string, unknown>): CodeExecutionResult;
}
```

### IEngineController

```ts
interface IEngineController {
    getState(): EngineState;
    start(script: UserScript): Promise<OperationResult>;
    pause(): OperationResult;
    resume(): OperationResult;
    restart(script: UserScript): Promise<OperationResult>;
    hotReload(script: UserScript): OperationResult;
}
```

### ISandboxProvider

```ts
interface ISandboxProvider {
    build(ctx: SandboxContext, assets: IAssetStore): Record<string, unknown>;
}
```

### ITranspiler

```ts
interface ITranspiler {
    transpile(): Promise<TranspilationResult>;
    getDiagnostics(): Promise<any[]>;
    displayDiagnostics(diagnostics: any[]): void;
    clearDiagnostics(): void;
}
```

### MonacoWorkerLoaders

```ts
interface MonacoWorkerLoaders {
    readonly jsonWorker: () => Worker;
    readonly cssWorker: () => Worker;
    readonly htmlWorker: () => Worker;
    readonly tsWorker: () => Worker;
    readonly editorWorker: () => Worker;
}
```

Monaco Editor Workers Configuration

Worker loader functions that must be provided by the consuming application.
The actual worker imports depend on your bundler's worker loading mechanism.

```ts
Vite
```ts
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
// ... other workers

const monacoWorkers = {
jsonWorker: () => new jsonWorker(),
// ... other workers
};
```

### OperationResult

```ts
interface OperationResult {
    readonly success: boolean;
    readonly error?: string;
}
```

### PanelShadow

```ts
type PanelShadow = "none" | "sm" | "md" | "lg" | "xl";
```

### PluginRegistry

```ts
interface PluginRegistry {
    register(name: string, plugin: SandboxPlugin): void;
    unregister(name: string): void;
    get(name: string): SandboxPlugin | undefined;
    getAll(): SandboxPlugin[];
    has(name: string): boolean;
}
```

### SandboxContext

```ts
type SandboxContext = Omit<SystemCtx, "signal" | "onCleanup" | keyof GameServices>;
```

The engine state exposed to live scripts. It is built outside an engine run,
so it has no run lifetime (, ) and
none of a game's services ().

### SandboxPlugin

```ts
interface SandboxPlugin {
    readonly name: string;
    provide(ctx: SandboxContext, assets: IAssetStore): Record<string, unknown>;
}
```

### TranspilationResult

```ts
interface TranspilationResult {
    readonly success: boolean;
    readonly javascript?: string;
    readonly error?: string;
}
```

### UserScript

```ts
interface UserScript {
    readonly preInit?: AsyncSystemFn;
    readonly init?: AsyncSystemFn;
    readonly postInit?: AsyncSystemFn;
    readonly exit?: AsyncSystemFn;
    readonly preUpdate?: SyncSystemFn;
    readonly tick?: SyncSystemFn;
    readonly update?: SyncSystemFn;
    readonly postUpdate?: SyncSystemFn;
}
```

## Added to core types when imported

Importing `fenrir-ts/editor` adds these members to core types for the whole program.

### Scene

```ts
interface Scene {
    skybox?: SkyboxDescriptor;
    setSkybox(skybox: SkyboxDescriptor | undefined): void;
    removeSkybox(): void;
    hasSkybox(): boolean;
}
```

- `skybox`: This scene's skybox, read by the skybox system. Set it with `setSkybox`.
- `setSkybox`: Sets the skybox for this scene, or removes it with `undefined`.
- `removeSkybox`: Removes the skybox from this scene.
- `hasSkybox`: Whether this scene has a skybox that is not disabled.

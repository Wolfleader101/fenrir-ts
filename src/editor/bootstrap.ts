import * as monaco from "monaco-editor";
import { typescript } from "monaco-editor";
import type { Engine } from "@/core/Engine";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import type { ILogger } from "@/core/ILogger";
import type { SystemCtx } from "@/core/SystemCtx";
import {
  TypeScriptTranspiler,
  CodeExecutor,
  SandboxProvider,
  ThreeJsPlugin,
  EngineApisPlugin,
  UtilitiesPlugin,
  LiveEngineController,
  createErrorBus,
  EditorModel,
  DefaultEditorView,
  EditorPresenter,
  type SandboxPlugin,
} from "@/editor";

export interface EditorBootstrapOptions {
  readonly engine: Engine;
  readonly assets: IAssetStore;
  readonly logger: ILogger;
  readonly buildContext: () => SystemCtx;
  readonly editorContainerId?: string;
  readonly defaultScriptUrl?: string;
  readonly additionalPlugins?: SandboxPlugin[];
}

export interface BootstrappedEditor {
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly model: monaco.editor.ITextModel;
  readonly presenter: EditorPresenter;
  readonly errorBus: ReturnType<typeof createErrorBus>;
}

/**
 * Bootstrap the Monaco Editor with all necessary components
 * Similar to bootstrapEngine()
 */
export const bootstrapEditor = async (
  options: EditorBootstrapOptions,
): Promise<BootstrappedEditor> => {
  const {
    engine,
    assets,
    logger,
    buildContext,
    editorContainerId = "editor-container",
    defaultScriptUrl = "/defaultScript.ts",
    additionalPlugins = [],
  } = options;

  // Load default script
  const defaultScript = await fetch(defaultScriptUrl).then((r) => r.text());

  // Create Monaco model
  const uri = monaco.Uri.parse("file:///main.ts");
  const model =
    monaco.editor.getModel(uri) ??
    monaco.editor.createModel(defaultScript, "typescript", uri);

  // Create editor instance
  const editorContainer = document.getElementById(
    editorContainerId,
  ) as HTMLElement;

  const editor = monaco.editor.create(editorContainer, {
    value: defaultScript,
    language: "typescript",
    theme: "vs-dark",
    automaticLayout: true,
    minimap: {
      enabled: true,
    },
    fontSize: 14,
    lineNumbers: "on",
    scrollBeyondLastLine: true,
    wordWrap: "on",
    model,
  });

  // Load TypeScript definitions
  const [fenrirDts, threeShim, fenrirGlobals] = await Promise.all([
    fetch("/fenrir.d.ts").then((r) => r.text()),
    fetch("/three-shim.d.ts").then((r) => r.text()),
    fetch("/fenrir-globals.d.ts").then((r) => r.text()),
  ]);

  typescript.typescriptDefaults.addExtraLib(
    threeShim,
    "file:///types/three-shim.d.ts",
  );
  typescript.typescriptDefaults.addExtraLib(
    fenrirDts,
    "file:///types/fenrir.d.ts",
  );
  typescript.typescriptDefaults.addExtraLib(
    fenrirGlobals,
    "file:///types/fenrir-globals.d.ts",
  );

  // Create error bus
  const errorBus = createErrorBus();

  // Create editor components
  const transpiler = new TypeScriptTranspiler(model);
  const codeExecutor = new CodeExecutor();

  // Setup sandbox with default + additional plugins
  const sandboxProvider = new SandboxProvider()
    .register(ThreeJsPlugin)
    .register(EngineApisPlugin)
    .register(UtilitiesPlugin);

  // Register additional user-provided plugins
  for (const plugin of additionalPlugins) {
    sandboxProvider.register(plugin);
  }

  const engineController = new LiveEngineController(engine);

  // Create MVP components
  const editorModel = new EditorModel("stopped");

  const editorView = new DefaultEditorView({
    btnStart: document.getElementById("btn-start") as HTMLButtonElement,
    btnPause: document.getElementById("btn-pause") as HTMLButtonElement,
    btnResume: document.getElementById("btn-resume") as HTMLButtonElement,
    btnRestart: document.getElementById("btn-restart") as HTMLButtonElement,
    btnSave: document.getElementById("btn-save") as HTMLButtonElement,
    statusElement: document.getElementById("status") as HTMLDivElement,
    errorPanel: document.getElementById("error-panel") as HTMLDivElement,
    errorMessage: document.getElementById("error-message") as HTMLPreElement,
    logFn: (msg) => logger.info(msg),
    warnFn: (msg) => logger.warn(msg),
  });

  const presenter = new EditorPresenter(
    editorModel,
    editorView,
    engineController,
    transpiler,
    codeExecutor,
    sandboxProvider,
    errorBus,
    buildContext,
    assets,
  );

  // Wire up UI event handlers
  const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
  const btnPause = document.getElementById("btn-pause") as HTMLButtonElement;
  const btnResume = document.getElementById("btn-resume") as HTMLButtonElement;
  const btnRestart = document.getElementById(
    "btn-restart",
  ) as HTMLButtonElement;
  const btnSave = document.getElementById("btn-save") as HTMLButtonElement;
  const btnCloseError = document.getElementById(
    "btn-close-error",
  ) as HTMLButtonElement;

  btnStart.addEventListener("click", () => presenter.handleStart());
  btnPause.addEventListener("click", () => presenter.handlePause());
  btnResume.addEventListener("click", () => presenter.handleResume());
  btnRestart.addEventListener("click", () => presenter.handleRestart());
  btnSave.addEventListener("click", () => presenter.handleSave());
  btnCloseError.addEventListener("click", () => presenter.handleCloseError());

  // Ctrl+S keyboard shortcut
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    await presenter.handleSave();
  });

  logger.info("✏️ Monaco Editor initialized!");
  logger.info("📝 Edit code and press Ctrl+S or click Save to hot-reload");
  logger.info("▶ Press Start to begin");

  return {
    editor,
    model,
    presenter,
    errorBus,
  };
};

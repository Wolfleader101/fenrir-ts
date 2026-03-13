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
  type SandboxPlugin,
} from "@/editor";
// Import and register Web Components
import "@/editor/ui/components";
import { EditorStore } from "@/editor/ui/stores";
import { MainEditorPresenter } from "@/editor/ui/presenters";

// Import type definition resources as raw strings
import fenrirDts from "./resources/fenrir.d.ts?raw";
import threeShimDts from "./resources/three-shim.d.ts?raw";
import fenrirGlobalsDts from "./resources/fenrir-globals.d.ts?raw";
import defaultScriptContent from "./resources/defaultScript.ts?raw";

/**
 * Monaco Editor Workers Configuration
 *
 * Worker loader functions that must be provided by the consuming application.
 * The actual worker imports depend on your bundler's worker loading mechanism.
 *
 * @example Vite
 * ```ts
 * import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
 * // ... other workers
 *
 * const monacoWorkers = {
 *   jsonWorker: () => new jsonWorker(),
 *   // ... other workers
 * };
 * ```
 */
export interface MonacoWorkerLoaders {
  readonly jsonWorker: () => Worker;
  readonly cssWorker: () => Worker;
  readonly htmlWorker: () => Worker;
  readonly tsWorker: () => Worker;
  readonly editorWorker: () => Worker;
}

export interface EditorBootstrapOptions {
  readonly engine: Engine;
  readonly assets: IAssetStore;
  readonly logger: ILogger;
  readonly buildContext: () => SystemCtx;
  readonly monacoWorkers: MonacoWorkerLoaders;
  readonly editorContainerId?: string;
  readonly defaultScript?: string;
  readonly additionalPlugins?: SandboxPlugin[];
}

export interface BootstrappedEditor {
  readonly editor: monaco.editor.IStandaloneCodeEditor;
  readonly model: monaco.editor.ITextModel;
  readonly mainPresenter: MainEditorPresenter;
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
    monacoWorkers,
    editorContainerId = "editor-container",
    defaultScript = defaultScriptContent,
    additionalPlugins = [],
  } = options;

  // Configure Monaco workers (must be done before creating editor)
  self.MonacoEnvironment = {
    getWorker(_moduleId: unknown, label: string) {
      if (label === "json") {
        return monacoWorkers.jsonWorker();
      }
      if (label === "css" || label === "scss" || label === "less") {
        return monacoWorkers.cssWorker();
      }
      if (label === "html" || label === "handlebars" || label === "razor") {
        return monacoWorkers.htmlWorker();
      }
      if (label === "typescript" || label === "javascript") {
        return monacoWorkers.tsWorker();
      }
      return monacoWorkers.editorWorker();
    },
  };

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

  // Add TypeScript definitions from embedded resources
  typescript.typescriptDefaults.addExtraLib(
    threeShimDts,
    "file:///types/three-shim.d.ts",
  );
  typescript.typescriptDefaults.addExtraLib(
    fenrirDts,
    "file:///types/fenrir.d.ts",
  );
  typescript.typescriptDefaults.addExtraLib(
    fenrirGlobalsDts,
    "file:///types/fenrir-globals.d.ts",
  );

  // Create error bus
  const errorBus = createErrorBus();

  // Create editor services
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

  // Create signal-based store (single source of truth)
  const store = new EditorStore("stopped");

  // Create main presenter (orchestrates everything)
  const mainPresenter = new MainEditorPresenter({
    store,
    engineController,
    transpiler,
    codeExecutor,
    sandboxProvider,
    errorBus,
    buildContext,
    assets,
    logger,
  });

  // Wire up components to presenters
  const controlBar = document.querySelector("ed-control-bar");
  if (controlBar) {
    controlBar.presenter = mainPresenter.control;
    controlBar.statusPresenter = mainPresenter.status;
  }

  const errorModal = document.querySelector("ed-error-modal");
  if (errorModal) {
    errorModal.presenter = mainPresenter.error;
  }

  // Ctrl+S keyboard shortcut
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
    await mainPresenter.handleSave();
  });

  logger.info("✏️ Monaco Editor initialized!");
  logger.info("📝 Edit code and press Ctrl+S or click Save to hot-reload");
  logger.info("▶ Press Start to begin");

  return {
    editor,
    model,
    mainPresenter,
    errorBus,
  };
};

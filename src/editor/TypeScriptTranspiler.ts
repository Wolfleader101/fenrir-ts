import * as monaco from "monaco-editor";
import { typescript } from "monaco-editor";
import type { ITranspiler, TranspilationResult } from "./interfaces";

export class TypeScriptTranspiler implements ITranspiler {
  private readonly model: monaco.editor.ITextModel;

  constructor(model: monaco.editor.ITextModel) {
    this.model = model;
  }

  async transpile(): Promise<TranspilationResult> {
    try {
      const tsWorker = await typescript
        .getTypeScriptWorker()
        .then((worker) => worker(this.model.uri));

      const emitOutput = await tsWorker.getEmitOutput(
        this.model.uri.toString(),
      );

      const jsFile = emitOutput.outputFiles[0];
      if (!jsFile) {
        return {
          success: false,
          error: "No JavaScript output from transpilation",
        };
      }

      return { success: true, javascript: jsFile.text };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getDiagnostics(): Promise<any[]> {
    try {
      const tsWorker = await typescript
        .getTypeScriptWorker()
        .then((worker) => worker(this.model.uri));

      const [semantic, syntactic] = await Promise.all([
        tsWorker.getSemanticDiagnostics(this.model.uri.toString()),
        tsWorker.getSyntacticDiagnostics(this.model.uri.toString()),
      ]);

      return [...semantic, ...syntactic];
    } catch (error) {
      return [];
    }
  }

  displayDiagnostics(diagnostics: any[]): void {
    const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => ({
      severity: monaco.MarkerSeverity.Error,
      startLineNumber: d.start
        ? this.model.getPositionAt(d.start).lineNumber
        : 1,
      startColumn: d.start ? this.model.getPositionAt(d.start).column : 1,
      endLineNumber:
        d.start && d.length
          ? this.model.getPositionAt(d.start + d.length).lineNumber
          : 1,
      endColumn:
        d.start && d.length
          ? this.model.getPositionAt(d.start + d.length).column
          : 1,
      message:
        typeof d.messageText === "string"
          ? d.messageText
          : d.messageText.messageText,
    }));

    monaco.editor.setModelMarkers(this.model, "typescript", markers);
  }

  clearDiagnostics(): void {
    monaco.editor.setModelMarkers(this.model, "typescript", []);
  }
}

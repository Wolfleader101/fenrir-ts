export interface TranspilationResult {
  readonly success: boolean;
  readonly javascript?: string;
  readonly error?: string;
}

export interface ITranspiler {
  transpile(): Promise<TranspilationResult>;
  getDiagnostics(): Promise<any[]>;
  displayDiagnostics(diagnostics: any[]): void;
  clearDiagnostics(): void;
}

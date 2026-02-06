import type { UserScript } from "../types";

export interface CodeExecutionResult {
  readonly success: boolean;
  readonly script: UserScript | null;
  readonly error: string | null;
}

export interface ICodeExecutor {
  execute(
    javascript: string,
    sandbox: Record<string, unknown>,
  ): CodeExecutionResult;
}

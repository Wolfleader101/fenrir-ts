import type { ICodeExecutor, CodeExecutionResult } from "./interfaces";

export class CodeExecutor implements ICodeExecutor {
  execute(
    javascript: string,
    sandbox: Record<string, unknown>,
  ): CodeExecutionResult {
    const wrappedCode = this.wrapCode(javascript, sandbox);

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("ctx", wrappedCode);
      const exports = fn(sandbox);

      const hasAnyFunction = Object.values(exports).some(
        (fn) => typeof fn === "function",
      );

      if (!hasAnyFunction) {
        throw new Error(
          "At least one schedule function must be defined (preInit, init, postInit, preUpdate, tick, update, postUpdate, or exit)",
        );
      }

      return { success: true, script: exports, error: null };
    } catch (error) {
      return {
        success: false,
        script: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private wrapCode(
    javascript: string,
    sandbox: Record<string, unknown>,
  ): string {
    const keys = Object.keys(sandbox).join(", ");

    return `
      'use strict';
      const { ${keys} } = ctx;
      
      ${javascript}
      
      return {
        preInit: typeof preInit !== 'undefined' ? preInit : undefined,
        init: typeof init !== 'undefined' ? init : undefined,
        postInit: typeof postInit !== 'undefined' ? postInit : undefined,
        preUpdate: typeof preUpdate !== 'undefined' ? preUpdate : undefined,
        tick: typeof tick !== 'undefined' ? tick : undefined,
        update: typeof update !== 'undefined' ? update : undefined,
        postUpdate: typeof postUpdate !== 'undefined' ? postUpdate : undefined,
        exit: typeof exit !== 'undefined' ? exit : undefined,
      };
    `;
  }
}

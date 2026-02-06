import type { UserScript, EngineState, OperationResult } from "../types";

export interface IEngineController {
  getState(): EngineState;
  start(script: UserScript): Promise<OperationResult>;
  pause(): OperationResult;
  resume(): OperationResult;
  restart(script: UserScript): Promise<OperationResult>;
  hotReload(script: UserScript): OperationResult;
}

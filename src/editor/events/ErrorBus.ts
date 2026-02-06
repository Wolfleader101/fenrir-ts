export interface ErrorEvent {
  readonly type: "transpilation" | "execution" | "runtime";
  readonly error: Error;
  readonly context?: string;
  readonly timestamp: number;
}

export interface ErrorHandler {
  handle(event: ErrorEvent): void;
}

export interface ErrorBus {
  subscribe(handler: ErrorHandler): () => void; // Returns unsubscribe function
  publish(event: ErrorEvent): void;
}

export const createErrorBus = (): ErrorBus => {
  const handlers: ErrorHandler[] = [];

  return {
    subscribe(handler: ErrorHandler) {
      handlers.push(handler);

      // Return unsubscribe function
      return () => {
        const index = handlers.indexOf(handler);
        if (index > -1) handlers.splice(index, 1);
      };
    },

    publish(event: ErrorEvent) {
      handlers.forEach((h) => h.handle(event));
    },
  };
};

import { AsyncLocalStorage } from "node:async_hooks";

type ScopeContext = {
  readonly scopeId: string;
};

export type AsyncContext = {
  getCurrentScopeId(): string | undefined;
  runInScope<T>(scopeId: string, fn: () => T): T;
};

export function createAsyncContext(): AsyncContext {
  const storage = new AsyncLocalStorage<ScopeContext>();

  return {
    getCurrentScopeId(): string | undefined {
      return storage.getStore()?.scopeId;
    },
    runInScope<T>(scopeId: string, fn: () => T): T {
      return storage.run({ scopeId }, fn);
    },
  };
}

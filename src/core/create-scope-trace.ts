import { createAsyncContext } from "../context/async-context";
import { ScopeStore } from "../context/scope-store";
import { ResourceRegistry } from "../registry/resource-registry";
import { createIdGenerator } from "../registry/ids";
import type {
  ScopeTrace,
  TrackOptions,
  ReportOptions,
  AssertOptions,
  IgnoreRule,
  ScopeTraceReport,
} from "../types/public";

export function createScopeTrace(): ScopeTrace {
  const { getCurrentScopeId, runInScope } = createAsyncContext();
  const ids = createIdGenerator();
  const scopeStore = new ScopeStore();
  const registry = new ResourceRegistry();

  function scope<T>(
    name: string,
    fn: () => T | Promise<T>,
    meta?: Record<string, unknown>,
  ): T | Promise<T> {
    const parentId = getCurrentScopeId();
    const id = ids.generateId("scope");

    scopeStore.add({
      id,
      name,
      parentId,
      createdAt: Date.now(),
      meta,
    });

    return runInScope(id, fn as () => T | Promise<T>);
  }

  // ── Phase 3 stubs ────────────────────────────────────────────────────────

  function trackTimeout(
    timeout: NodeJS.Timeout,
    _options?: TrackOptions,
  ): NodeJS.Timeout {
    return timeout;
  }

  function trackInterval(
    interval: NodeJS.Timeout,
    _options?: TrackOptions,
  ): NodeJS.Timeout {
    return interval;
  }

  function trackServer<T extends { close(cb?: (err?: Error) => void): void }>(
    server: T,
    _options?: TrackOptions,
  ): T {
    return server;
  }

  function trackDisposable<T>(
    resource: T,
    _disposer: (resource: T) => Promise<void> | void,
    _options?: TrackOptions,
  ): T {
    return resource;
  }

  function disposeTracked(_id: string): Promise<void> {
    return Promise.resolve();
  }

  // ── Phase 4 stub ─────────────────────────────────────────────────────────

  function report(_options?: ReportOptions): ScopeTraceReport {
    return {
      summary: { total: 0, active: 0, disposed: 0, leaked: 0 },
      leaks: [],
    };
  }

  // ── Phase 5 stub ─────────────────────────────────────────────────────────

  function assertNoLeaks(_options?: AssertOptions): void {
    // no-op until Phase 5
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function ignore(rule: IgnoreRule): void {
    registry.addIgnoreRule(rule);
  }

  function reset(): void {
    scopeStore.clear();
    registry.clear();
  }

  return {
    scope,
    getCurrentScopeId,
    trackTimeout,
    trackInterval,
    trackServer,
    trackDisposable,
    disposeTracked,
    report,
    assertNoLeaks,
    ignore,
    reset,
  };
}

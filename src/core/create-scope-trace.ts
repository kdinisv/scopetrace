import { createAsyncContext } from "../context/async-context";
import { ScopeStore } from "../context/scope-store";
import { ScopeRefCounter } from "../context/scope-ref-counter";
import { ResourceRegistry } from "../registry/resource-registry";
import { createIdGenerator } from "../registry/ids";
import { TrackedIdentity } from "./tracked-identity";
import { captureStack, isPromiseLike, isTimerDisposed } from "./utils";
import { assertNoLeaksFromReport } from "../assertion/assert-no-leaks";
import { ScopeTraceDisposeError, ScopeTraceUsageError } from "../errors";
import type {
  ScopeTrace,
  TrackOptions,
  ReportOptions,
  AssertOptions,
  IgnoreRule,
  LeakedResource,
  ScopeTraceReport,
} from "../types/public";
import type { ResourceKind } from "../types/internal";

export function createScopeTrace(): ScopeTrace {
  const { getCurrentScopeId, runInScope } = createAsyncContext();
  const ids = createIdGenerator();
  const scopeStore = new ScopeStore();
  const registry = new ResourceRegistry();
  const refCounter = new ScopeRefCounter(scopeStore);
  const identity = new TrackedIdentity();

  function scope<T>(
    name: string,
    fn: () => T | Promise<T>,
    meta?: Record<string, unknown>,
  ): T | Promise<T> {
    const parentId = getCurrentScopeId();
    const id = ids.generateId("scope");

    scopeStore.add({ id, name, parentId, createdAt: Date.now(), meta });
    refCounter.retain(id);

    const finalizeScope = (): void => {
      refCounter.release(id);
    };

    try {
      const result = runInScope(id, fn as () => T | Promise<T>);

      if (isPromiseLike(result)) {
        return Promise.resolve(result).finally(finalizeScope) as Promise<T>;
      }

      finalizeScope();
      return result;
    } catch (error) {
      finalizeScope();
      throw error;
    }
  }

  function trackTimeout(
    timeout: NodeJS.Timeout,
    options?: TrackOptions,
  ): NodeJS.Timeout {
    if (identity.get(timeout) !== undefined) {
      return timeout;
    }

    const id = registerResource("timeout", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "clearTimeout()",
      resource: timeout,
      isDisposed: () => isTimerDisposed(timeout),
    });

    identity.remember(timeout, id);
    return timeout;
  }

  function trackInterval(
    interval: NodeJS.Timeout,
    options?: TrackOptions,
  ): NodeJS.Timeout {
    if (identity.get(interval) !== undefined) {
      return interval;
    }

    const id = registerResource("interval", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "clearInterval()",
      resource: interval,
      isDisposed: () => isTimerDisposed(interval),
    });

    identity.remember(interval, id);
    return interval;
  }

  function trackServer<T extends { close(cb?: (err?: Error) => void): void }>(
    server: T,
    options?: TrackOptions,
  ): T {
    if (identity.get(server) !== undefined) {
      return server;
    }

    const id = registerResource("server", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "server.close()",
      resource: server,
    });

    identity.remember(server, id);
    instrumentServerClose(server, id);

    return server;
  }

  function trackDisposable<T>(
    resource: T,
    disposer: (resource: T) => Promise<void> | void,
    options?: TrackOptions,
  ): T {
    if (typeof disposer !== "function") {
      throw new ScopeTraceUsageError(
        "trackDisposable() requires a disposer function",
      );
    }

    if (identity.get(resource) !== undefined) {
      return resource;
    }

    const id = registerResource("disposable", {
      ...options,
      resource,
      dispose: () => disposer(resource),
    });

    identity.remember(resource, id);
    return resource;
  }

  async function disposeTracked(id: string): Promise<void> {
    try {
      const result = await registry.dispose(id);

      if (result === "missing") {
        throw new ScopeTraceUsageError(
          `disposeTracked(): unknown resource id \"${id}\"`,
        );
      }

      if (result === "unsupported") {
        throw new ScopeTraceUsageError(
          `disposeTracked(): resource \"${id}\" is not disposable via disposeTracked()`,
        );
      }
    } catch (error) {
      if (error instanceof ScopeTraceUsageError) {
        throw error;
      }

      throw new ScopeTraceDisposeError(
        error instanceof Error
          ? error.message
          : `Failed to dispose tracked resource \"${id}\"`,
      );
    }
  }

  function report(options?: ReportOptions): ScopeTraceReport {
    return createReport(options?.ignoreRules ?? []);
  }

  function assertNoLeaks(options?: AssertOptions): void {
    const scopedReport = createReport(options?.ignoreRules ?? []);
    assertNoLeaksFromReport(scopedReport, options);
  }

  function ignore(rule: IgnoreRule): void {
    registry.addIgnoreRule(rule);
  }

  function reset(): void {
    refCounter.clear();
    identity.reset();
    scopeStore.clear();
    registry.clear();
  }

  function getTrackedId(resource: unknown): string | undefined {
    return identity.get(resource);
  }

  // --- Internal helpers ---

  function createReport(
    extraIgnoreRules: readonly IgnoreRule[],
  ): ScopeTraceReport {
    const activeResources = registry.listActive();
    const counts = registry.getCounts();
    const createdAt = Date.now();

    const leaks = activeResources
      .filter(
        (resource) =>
          !registry.matchesIgnoreRules(
            resource,
            resolveScopePath,
            extraIgnoreRules,
          ),
      )
      .map(
        (resource): LeakedResource => ({
          id: resource.id,
          kind: resource.kind,
          label: resource.label,
          scope:
            resource.scopeId !== undefined
              ? scopeStore.getAncestryPath(resource.scopeId)
              : undefined,
          createdAt: resource.createdAt,
          ageMs: createdAt - resource.createdAt,
          stack: resource.stack,
          meta: resource.meta,
          expectedDispose: resource.expectedDispose,
        }),
      )
      .sort((left, right) => right.ageMs - left.ageMs);

    return {
      summary: {
        total: counts.total,
        active: counts.active,
        disposed: counts.disposed,
        leaked: leaks.length,
      },
      leaks,
    };
  }

  function registerResource(
    kind: ResourceKind,
    options: TrackOptions & {
      resource?: unknown;
      dispose?: () => Promise<void> | void;
      isDisposed?: () => boolean;
    },
  ): string {
    const id = ids.generateId(kind);
    const scopeId = getCurrentScopeId();

    refCounter.retainChain(scopeId);

    registry.register({
      id,
      kind,
      label: options.label,
      scopeId,
      createdAt: Date.now(),
      expectedDispose: options.expectedDispose,
      meta: options.meta,
      stack: captureStack(options.captureStack),
      resource: options.resource,
      dispose: options.dispose,
      isDisposed: options.isDisposed,
      onDispose: () => {
        identity.forget(options.resource);
        refCounter.releaseChain(scopeId);
      },
    });

    return id;
  }

  function resolveScopePath(scopeId: string): string {
    return scopeStore.getAncestryPath(scopeId);
  }

  function instrumentServerClose(
    server: { close(cb?: (err?: Error) => void): void },
    id: string,
  ): void {
    const originalClose = server.close.bind(server);
    const eventEmitterLike = server as {
      once?: (event: string, listener: () => void) => void;
      close: typeof server.close;
    };

    eventEmitterLike.once?.("close", () => {
      registry.markDisposed(id);
    });

    eventEmitterLike.close = ((callback?: (err?: Error) => void) => {
      const wrappedCallback = (error?: Error): void => {
        if (error === undefined) {
          registry.markDisposed(id);
        }

        callback?.(error);
      };

      const result = originalClose(wrappedCallback);

      if (isPromiseLike(result)) {
        void (result as Promise<unknown>).then(
          () => {
            registry.markDisposed(id);
          },
          () => {
            // Close failed — do not mark as disposed.
          },
        );
      }

      return result;
    }) as typeof server.close;
  }

  return {
    scope,
    getCurrentScopeId,
    getTrackedId,
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

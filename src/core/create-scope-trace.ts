import { createAsyncContext } from "../context/async-context";
import { ScopeStore } from "../context/scope-store";
import { ResourceRegistry } from "../registry/resource-registry";
import { createIdGenerator } from "../registry/ids";
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
import type {
  RegisterTrackedResourceInput,
  ResourceKind,
} from "../types/internal";

const TRACKED_RESOURCE_ID = Symbol.for("scopetrace.resourceId");

export function createScopeTrace(): ScopeTrace {
  const { getCurrentScopeId, runInScope } = createAsyncContext();
  const ids = createIdGenerator();
  const scopeStore = new ScopeStore();
  const registry = new ResourceRegistry();
  const scopeRefCounts = new Map<string, number>();
  let trackedObjectIds = new WeakMap<object, string>();

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

    retainScope(id);

    const finalizeScope = (): void => {
      releaseScope(id);
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
    if (isObjectLike(timeout)) {
      const existingId = trackedObjectIds.get(timeout);
      if (existingId !== undefined) {
        return timeout;
      }
    }

    const id = registerResource("timeout", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "clearTimeout()",
      resource: timeout,
      isDisposed: () => isTimerDisposed(timeout),
    });

    rememberTrackedObject(timeout, id);
    return timeout;
  }

  function trackInterval(
    interval: NodeJS.Timeout,
    options?: TrackOptions,
  ): NodeJS.Timeout {
    if (isObjectLike(interval)) {
      const existingId = trackedObjectIds.get(interval);
      if (existingId !== undefined) {
        return interval;
      }
    }

    const id = registerResource("interval", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "clearInterval()",
      resource: interval,
      isDisposed: () => isTimerDisposed(interval),
    });

    rememberTrackedObject(interval, id);
    return interval;
  }

  function trackServer<T extends { close(cb?: (err?: Error) => void): void }>(
    server: T,
    options?: TrackOptions,
  ): T {
    if (isObjectLike(server)) {
      const existingId = trackedObjectIds.get(server);
      if (existingId !== undefined) {
        return server;
      }
    }

    const id = registerResource("server", {
      ...options,
      expectedDispose: options?.expectedDispose ?? "server.close()",
      resource: server,
    });

    rememberTrackedObject(server, id);
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

    if (isObjectLike(resource)) {
      const existingId = trackedObjectIds.get(resource);
      if (existingId !== undefined) {
        return resource;
      }
    }

    const id = registerResource("disposable", {
      ...options,
      resource,
      dispose: () => disposer(resource),
    });

    rememberTrackedObject(resource, id);
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
    scopeRefCounts.clear();
    trackedObjectIds = new WeakMap<object, string>();
    scopeStore.clear();
    registry.clear();
  }

  function getTrackedId(resource: unknown): string | undefined {
    if (!isObjectLike(resource)) {
      return undefined;
    }

    return trackedObjectIds.get(resource) ?? getTrackedIdFromSymbol(resource);
  }

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

    retainScopeChain(scopeId);

    const input: RegisterTrackedResourceInput = {
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
        forgetTrackedObject(options.resource);
        releaseScopeChain(scopeId);
      },
    };

    registry.register(input);
    return id;
  }

  function resolveScopePath(scopeId: string): string {
    return scopeStore.getAncestryPath(scopeId);
  }

  function retainScope(scopeId: string): void {
    scopeRefCounts.set(scopeId, (scopeRefCounts.get(scopeId) ?? 0) + 1);
  }

  function releaseScope(scopeId: string): void {
    const nextCount = (scopeRefCounts.get(scopeId) ?? 0) - 1;

    if (nextCount <= 0) {
      scopeRefCounts.delete(scopeId);
      scopeStore.delete(scopeId);
      return;
    }

    scopeRefCounts.set(scopeId, nextCount);
  }

  function retainScopeChain(scopeId: string | undefined): void {
    if (scopeId === undefined) {
      return;
    }

    for (const ancestorId of scopeStore.getAncestryIds(scopeId)) {
      retainScope(ancestorId);
    }
  }

  function releaseScopeChain(scopeId: string | undefined): void {
    if (scopeId === undefined) {
      return;
    }

    for (const ancestorId of scopeStore.getAncestryIds(scopeId)) {
      releaseScope(ancestorId);
    }
  }

  function rememberTrackedObject(resource: unknown, id: string): void {
    if (!isObjectLike(resource)) {
      return;
    }

    trackedObjectIds.set(resource, id);

    try {
      Object.defineProperty(resource, TRACKED_RESOURCE_ID, {
        configurable: true,
        enumerable: false,
        value: id,
      });
    } catch {
      // Ignore non-extensible resources.
    }
  }

  function forgetTrackedObject(resource: unknown): void {
    if (!isObjectLike(resource)) {
      return;
    }

    trackedObjectIds.delete(resource);
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
          (value) => {
            registry.markDisposed(id);
            return value;
          },
          (error) => {
            throw error;
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

function captureStack(
  captureStackOption: boolean | undefined,
): string | undefined {
  if (captureStackOption === false) {
    return undefined;
  }

  const stack = new Error().stack;

  if (stack === undefined) {
    return undefined;
  }

  return stack.split("\n").slice(3).join("\n").trim();
}

function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

function isTimerDisposed(timer: NodeJS.Timeout): boolean {
  return Boolean(
    (timer as NodeJS.Timeout & { _destroyed?: boolean })._destroyed,
  );
}

function getTrackedIdFromSymbol(resource: object): string | undefined {
  const value = (resource as Record<PropertyKey, unknown>)[TRACKED_RESOURCE_ID];
  return typeof value === "string" ? value : undefined;
}

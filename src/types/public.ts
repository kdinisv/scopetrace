import type { ResourceKind, TrackedResource } from "./internal";

export type ReportFormat = "pretty" | "compact" | "json";

export type TrackOptions = {
  label?: string;
  expectedDispose?: string;
  meta?: Record<string, unknown>;
  captureStack?: boolean;
};

export type IgnoreRule =
  | { kind: ResourceKind }
  | { label: string }
  | { scope: string }
  | { scopeId: string }
  | { predicate: (resource: TrackedResource) => boolean };

export type ReportOptions = {
  ignoreRules?: IgnoreRule[];
};

export type FormatReportOptions = {
  format?: ReportFormat;
  limit?: number;
};

export type AssertOptions = {
  mode?: "strict" | "soft";
  limit?: number;
  ignoreRules?: IgnoreRule[];
  format?: ReportFormat;
};

export type LeakedResource = {
  id: string;
  kind: ResourceKind;
  label?: string;
  scope?: string;
  createdAt: number;
  ageMs: number;
  stack?: string;
  meta?: Record<string, unknown>;
  expectedDispose?: string;
};

export type ScopeTraceReport = {
  summary: {
    total: number;
    active: number;
    disposed: number;
    leaked: number;
  };
  leaks: LeakedResource[];
};

export type ScopeTrace = {
  scope<T>(
    name: string,
    fn: () => T | Promise<T>,
    meta?: Record<string, unknown>,
  ): T | Promise<T>;

  getCurrentScopeId(): string | undefined;
  getTrackedId(resource: unknown): string | undefined;

  trackTimeout(timeout: NodeJS.Timeout, options?: TrackOptions): NodeJS.Timeout;
  trackInterval(
    interval: NodeJS.Timeout,
    options?: TrackOptions,
  ): NodeJS.Timeout;
  trackServer<T extends { close(cb?: (err?: Error) => void): void }>(
    server: T,
    options?: TrackOptions,
  ): T;
  trackDisposable<T>(
    resource: T,
    disposer: (resource: T) => Promise<void> | void,
    options?: TrackOptions,
  ): T;

  disposeTracked(id: string): Promise<void>;

  report(options?: ReportOptions): ScopeTraceReport;
  assertNoLeaks(options?: AssertOptions): void;

  ignore(rule: IgnoreRule): void;
  reset(): void;
};

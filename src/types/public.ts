import type { ResourceKind, TrackedResource } from "./internal";

export type ReportFormat = "pretty" | "compact" | "json";

export type GracefulShutdownProcessLike = {
  on(
    event: NodeJS.Signals,
    listener: (signal: NodeJS.Signals) => void,
  ): unknown;
  removeListener(
    event: NodeJS.Signals,
    listener: (signal: NodeJS.Signals) => void,
  ): unknown;
  exit(code?: number): void | never;
};

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
  stackFrameLimit?: number;
  color?: boolean;
};

export type AssertOptions = {
  mode?: "strict" | "soft";
  limit?: number;
  ignoreRules?: IgnoreRule[];
  format?: ReportFormat;
  stackFrameLimit?: number;
  color?: boolean;
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

export type GracefulShutdownOptions = {
  cleanup?: (signal: NodeJS.Signals) => Promise<void> | void;
  signals?: readonly NodeJS.Signals[];
  ignoreRules?: IgnoreRule[];
  mode?: "strict" | "soft";
  format?: ReportFormat;
  limit?: number;
  stackFrameLimit?: number;
  color?: boolean;
  logger?: (message: string) => void;
  process?: GracefulShutdownProcessLike;
  cleanExitCode?: number;
  leakExitCode?: number;
  errorExitCode?: number;
  exitOnSignal?: boolean;
};

export type GracefulShutdownResult = {
  signal: NodeJS.Signals;
  report: ScopeTraceReport;
  exitCode: number;
  error?: Error;
};

export type GracefulShutdownController = {
  trace: ScopeTrace;
  run(signal: NodeJS.Signals): Promise<GracefulShutdownResult>;
  install(): void;
  uninstall(): void;
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

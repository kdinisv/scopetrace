export { createScopeTrace } from "./core/create-scope-trace";

export type { AsyncContext } from "./context/async-context";

export type {
  ScopeTrace,
  TrackOptions,
  ReportOptions,
  AssertOptions,
  IgnoreRule,
  ScopeTraceReport,
  LeakedResource,
} from "./types/public";

export {
  ScopeTraceError,
  ScopeTraceDisposeError,
  ScopeTraceAssertionError,
  ScopeTraceUsageError,
} from "./errors";

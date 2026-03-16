export { createScopeTrace } from "./core/create-scope-trace";
export { formatCompactReport } from "./reporting/format-compact";
export { formatJsonReport } from "./reporting/format-json";
export { formatPrettyReport } from "./reporting/format-pretty";
export { formatReport } from "./reporting/format-report";

export type { AsyncContext } from "./context/async-context";

export type {
  ScopeTrace,
  TrackOptions,
  ReportOptions,
  FormatReportOptions,
  ReportFormat,
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

import { ScopeTraceAssertionError } from "../errors";
import { formatCompactReport } from "../reporting/format-compact";
import { formatJsonReport } from "../reporting/format-json";
import { formatPrettyReport } from "../reporting/format-pretty";
import type { AssertOptions, ScopeTraceReport } from "../types/public";

export function assertNoLeaksFromReport(
  report: ScopeTraceReport,
  options: AssertOptions = {},
): void {
  if (report.summary.leaked === 0) {
    return;
  }

  const mode = options.mode ?? "strict";
  const limit = options.limit ?? 3;
  const format = options.format ?? "compact";
  const message = createAssertionMessage(report, format, limit);

  if (mode === "soft") {
    console.warn(message);
    return;
  }

  throw new ScopeTraceAssertionError(message);
}

function createAssertionMessage(
  report: ScopeTraceReport,
  format: NonNullable<AssertOptions["format"]>,
  limit: number,
): string {
  switch (format) {
    case "json":
      return formatJsonReport(report, { limit });
    case "pretty":
      return `ScopeTraceAssertionError: detected ${report.summary.leaked} leaked resource${
        report.summary.leaked === 1 ? "" : "s"
      }\n\n${formatPrettyReport(report, { limit })}`;
    case "compact":
    default:
      return `ScopeTraceAssertionError: detected ${report.summary.leaked} leaked resource${
        report.summary.leaked === 1 ? "" : "s"
      }\n${formatCompactReport(report, { limit })}`;
  }
}

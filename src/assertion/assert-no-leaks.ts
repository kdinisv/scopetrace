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
  const format = options.format ?? "pretty";
  const message = createAssertionMessage(report, format, limit, options);

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
  options: AssertOptions,
): string {
  switch (format) {
    case "json":
      return formatJsonReport(report, {
        limit,
        stackFrameLimit: options.stackFrameLimit,
        color: options.color,
      });
    case "pretty":
      return `ScopeTraceAssertionError\n\n${formatPrettyReport(report, {
        limit,
        stackFrameLimit: options.stackFrameLimit,
        color: options.color,
      })}`;
    case "compact":
    default:
      return `ScopeTraceAssertionError: detected ${report.summary.leaked} leaked resource${
        report.summary.leaked === 1 ? "" : "s"
      }\n${formatCompactReport(report, {
        limit,
        stackFrameLimit: options.stackFrameLimit,
        color: options.color,
      })}`;
  }
}

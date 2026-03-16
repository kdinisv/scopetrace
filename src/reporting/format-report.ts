import type {
  FormatReportOptions,
  ReportFormat,
  ScopeTraceReport,
} from "../types/public";
import { formatCompactReport } from "./format-compact";
import { formatJsonReport } from "./format-json";
import { formatPrettyReport } from "./format-pretty";

export function formatReport(
  report: ScopeTraceReport,
  options: FormatReportOptions = {},
): string {
  const format = options.format ?? "pretty";

  switch (format) {
    case "compact":
      return formatCompactReport(report, options);
    case "json":
      return formatJsonReport(report, options);
    case "pretty":
      return formatPrettyReport(report, options);
    default:
      return assertNever(format);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unsupported report format: ${String(value)}`);
}

export type { ReportFormat };

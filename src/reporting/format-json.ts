import type { FormatReportOptions, ScopeTraceReport } from "../types/public";

export function formatJsonReport(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): string {
  const limit = options.limit;

  if (limit === undefined || limit >= report.leaks.length) {
    return JSON.stringify(report, null, 2);
  }

  return JSON.stringify(
    {
      ...report,
      leaks: report.leaks.slice(0, limit),
      truncatedLeaks: report.leaks.length - limit,
    },
    null,
    2,
  );
}

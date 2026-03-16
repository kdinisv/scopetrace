import type { FormatReportOptions, ScopeTraceReport } from "../types/public";

export function formatCompactReport(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): string {
  if (report.summary.leaked === 0) {
    return `ScopeTrace: no leaks (total=${report.summary.total} active=${report.summary.active} disposed=${report.summary.disposed})`;
  }

  const limit = options.limit ?? report.leaks.length;
  const items = report.leaks.slice(0, limit).map((leak) => {
    const parts: string[] = [leak.kind];

    if (leak.label !== undefined) {
      parts.push(`\"${leak.label}\"`);
    }

    if (leak.scope !== undefined && leak.scope.length > 0) {
      parts.push(`scope=${leak.scope}`);
    }

    parts.push(`age=${leak.ageMs}ms`);

    if (leak.expectedDispose !== undefined) {
      parts.push(`dispose=${leak.expectedDispose}`);
    }

    return `- ${parts.join(" | ")}`;
  });

  const remaining =
    report.summary.leaked - Math.min(limit, report.summary.leaked);
  const suffix = remaining > 0 ? `\n... and ${remaining} more` : "";

  return `ScopeTrace: leaked=${report.summary.leaked} total=${report.summary.total} active=${report.summary.active} disposed=${report.summary.disposed}\n${items.join("\n")}${suffix}`;
}

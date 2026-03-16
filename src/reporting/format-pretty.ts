import type { FormatReportOptions, ScopeTraceReport } from "../types/public";

export function formatPrettyReport(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): string {
  const limit = options.limit ?? report.leaks.length;
  const leaks = report.leaks.slice(0, limit);
  const lines = [
    "ScopeTrace report",
    `summary: total=${report.summary.total} active=${report.summary.active} disposed=${report.summary.disposed} leaked=${report.summary.leaked}`,
  ];

  if (report.summary.leaked === 0) {
    lines.push("no leaked resources detected");
    return lines.join("\n");
  }

  for (const leak of leaks) {
    lines.push("");
    lines.push(
      `- ${leak.kind}${leak.label !== undefined ? ` \"${leak.label}\"` : ""}`,
    );

    if (leak.scope !== undefined && leak.scope.length > 0) {
      lines.push(`  scope: ${leak.scope}`);
    }

    lines.push(`  age: ${leak.ageMs}ms`);

    if (leak.expectedDispose !== undefined) {
      lines.push(`  expected dispose: ${leak.expectedDispose}`);
    }

    if (leak.meta !== undefined) {
      lines.push(`  meta: ${JSON.stringify(leak.meta)}`);
    }

    if (leak.stack !== undefined) {
      lines.push("  created at:");
      lines.push(indentMultiline(leak.stack, "  "));
    }
  }

  const remaining = report.summary.leaked - leaks.length;

  if (remaining > 0) {
    lines.push("");
    lines.push(
      `... and ${remaining} more leaked resource${remaining === 1 ? "" : "s"}`,
    );
  }

  return lines.join("\n");
}

function indentMultiline(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

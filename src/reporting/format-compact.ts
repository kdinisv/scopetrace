import type { FormatReportOptions, ScopeTraceReport } from "../types/public";
import {
  createPalette,
  formatDuration,
  normalizeFormatOptions,
} from "./format-shared";

export function formatCompactReport(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): string {
  const normalized = normalizeFormatOptions(report, options);
  const palette = createPalette(normalized.color);

  if (report.summary.leaked === 0) {
    if (report.summary.total === 0) {
      return `${palette.ok("ScopeTrace")}: no leaks; no tracked resources were observed`;
    }

    return `${palette.ok("ScopeTrace")}: no leaks (total=${report.summary.total} active=${report.summary.active} disposed=${report.summary.disposed})`;
  }

  const items = report.leaks.slice(0, normalized.limit).map((leak, index) => {
    const parts: string[] = [leak.kind];

    if (leak.label !== undefined) {
      parts.push(`\"${leak.label}\"`);
    }

    if (leak.scope !== undefined && leak.scope.length > 0) {
      parts.push(`scope=${leak.scope}`);
    }

    parts.push(`age=${formatDuration(leak.ageMs)}`);

    if (leak.expectedDispose !== undefined) {
      parts.push(`dispose=${leak.expectedDispose}`);
    }

    return `${palette.error(`[${index + 1}]`)} ${parts.join(" | ")}`;
  });

  const remaining =
    report.summary.leaked - Math.min(normalized.limit, report.summary.leaked);
  const suffix =
    remaining > 0 ? `\n${palette.warn(`... and ${remaining} more`)}` : "";

  return `${palette.error("ScopeTrace")}: leaked=${report.summary.leaked} total=${report.summary.total} active=${report.summary.active} disposed=${report.summary.disposed}\n${items.join("\n")}${suffix}`;
}

import type { FormatReportOptions, ScopeTraceReport } from "../types/public";
import {
  createPalette,
  formatDuration,
  getStackPreview,
  normalizeFormatOptions,
} from "./format-shared";

export function formatPrettyReport(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): string {
  const normalized = normalizeFormatOptions(report, options);
  const palette = createPalette(normalized.color);
  const leaks = report.leaks.slice(0, normalized.limit);
  const lines = [
    palette.title("ScopeTrace Report"),
    palette.muted("=".repeat(72)),
    `${palette.label("Status:")} ${
      report.summary.leaked === 0
        ? palette.ok("OK")
        : palette.error("LEAKS DETECTED")
    }`,
    `${palette.label("Summary:")} total ${report.summary.total} | active ${report.summary.active} | disposed ${report.summary.disposed} | leaked ${report.summary.leaked}`,
  ];

  if (report.summary.leaked === 0) {
    lines.push("");
    lines.push(palette.ok("No leaked resources detected."));

    if (report.summary.total === 0) {
      lines.push(
        palette.muted(
          "No tracked resources were observed during process lifetime. The entry file may have exported helpers without executing them.",
        ),
      );
    }

    return lines.join("\n");
  }

  for (const [index, leak] of leaks.entries()) {
    const stackPreview = getStackPreview(
      leak.stack,
      normalized.stackFrameLimit,
    );

    lines.push("");
    lines.push(
      `${palette.error(`[${index + 1}]`)} ${palette.value(leak.kind.toUpperCase())}${leak.label !== undefined ? ` ${palette.value(`\"${leak.label}\"`)}` : ""}`,
    );

    lines.push(`    ${palette.label("Id:")} ${palette.muted(leak.id)}`);

    if (leak.scope !== undefined && leak.scope.length > 0) {
      lines.push(`    ${palette.label("Scope:")} ${leak.scope}`);
    }

    lines.push(`    ${palette.label("Age:")} ${formatDuration(leak.ageMs)}`);

    if (leak.expectedDispose !== undefined) {
      lines.push(
        `    ${palette.label("Expected dispose:")} ${leak.expectedDispose}`,
      );
    }

    if (leak.meta !== undefined) {
      lines.push(`    ${palette.label("Meta:")} ${JSON.stringify(leak.meta)}`);
    }

    if (stackPreview.lines.length > 0) {
      lines.push(
        `    ${palette.label("Created at:")} ${stackPreview.lines[0]}`,
      );

      if (stackPreview.lines.length > 1) {
        lines.push(`    ${palette.label("Stack preview:")}`);

        for (const line of stackPreview.lines.slice(1)) {
          lines.push(`      ${palette.muted(line)}`);
        }
      }

      if (stackPreview.remaining > 0) {
        lines.push(
          `      ${palette.muted(`... ${stackPreview.remaining} more frame${stackPreview.remaining === 1 ? "" : "s"}`)}`,
        );
      }
    }
  }

  const remaining = report.summary.leaked - leaks.length;

  if (remaining > 0) {
    lines.push("");
    lines.push(
      palette.warn(
        `... and ${remaining} more leaked resource${remaining === 1 ? "" : "s"}`,
      ),
    );
  }

  return lines.join("\n");
}

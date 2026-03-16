import type { FormatReportOptions, ScopeTraceReport } from "../types/public";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
} as const;

export type NormalizedFormatOptions = {
  limit: number;
  stackFrameLimit: number;
  color: boolean;
};

export type Palette = {
  title(value: string): string;
  muted(value: string): string;
  label(value: string): string;
  value(value: string): string;
  ok(value: string): string;
  warn(value: string): string;
  error(value: string): string;
};

export function normalizeFormatOptions(
  report: ScopeTraceReport,
  options: Omit<FormatReportOptions, "format"> = {},
): NormalizedFormatOptions {
  return {
    limit: options.limit ?? report.leaks.length,
    stackFrameLimit: options.stackFrameLimit ?? 3,
    color: options.color ?? shouldUseColor(),
  };
}

export function createPalette(color: boolean): Palette {
  if (!color) {
    return {
      title: identity,
      muted: identity,
      label: identity,
      value: identity,
      ok: identity,
      warn: identity,
      error: identity,
    };
  }

  return {
    title: (value) => wrap(value, ANSI.bold, ANSI.cyan),
    muted: (value) => wrap(value, ANSI.gray),
    label: (value) => wrap(value, ANSI.bold, ANSI.blue),
    value: (value) => wrap(value, ANSI.bold),
    ok: (value) => wrap(value, ANSI.bold, ANSI.green),
    warn: (value) => wrap(value, ANSI.bold, ANSI.yellow),
    error: (value) => wrap(value, ANSI.bold, ANSI.red),
  };
}

export function formatDuration(ageMs: number): string {
  if (ageMs < 1_000) {
    return `${ageMs} ms`;
  }

  if (ageMs < 60_000) {
    return `${trimDecimal(ageMs / 1_000)} s`;
  }

  if (ageMs < 3_600_000) {
    const minutes = Math.floor(ageMs / 60_000);
    const seconds = Math.floor((ageMs % 60_000) / 1_000);
    return seconds > 0 ? `${minutes} min ${seconds} s` : `${minutes} min`;
  }

  const hours = Math.floor(ageMs / 3_600_000);
  const minutes = Math.floor((ageMs % 3_600_000) / 60_000);
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

export function getStackPreview(
  stack: string | undefined,
  frameLimit: number,
): {
  lines: string[];
  remaining: number;
} {
  if (stack === undefined || stack.trim().length === 0) {
    return { lines: [], remaining: 0 };
  }

  const normalizedLines = stack
    .split("\n")
    .map((line) => normalizeStackLine(line))
    .filter((line) => line.length > 0);

  const relevantLines = normalizedLines.filter(
    (line) => !isInternalFrame(line),
  );
  const lines = relevantLines.length > 0 ? relevantLines : normalizedLines;

  return {
    lines: lines.slice(0, frameLimit),
    remaining: Math.max(0, lines.length - frameLimit),
  };
}

function normalizeStackLine(line: string): string {
  return line
    .trim()
    .replace(/file:\/\//g, "")
    .replace(/^at \/([A-Za-z]:\/)/, "at $1")
    .replace(/\(\/([A-Za-z]:\/)/g, "($1")
    .replace(/\s+/g, " ");
}

function isInternalFrame(line: string): boolean {
  return (
    line.includes("node:internal/") ||
    line.includes("ModuleJob.run") ||
    line.includes("asyncRunEntryPointWithESMLoader") ||
    line.includes("onImport.tracePromise")
  );
}

function shouldUseColor(): boolean {
  return Boolean(process.stdout?.isTTY && process.env.NO_COLOR === undefined);
}

function wrap(value: string, ...codes: string[]): string {
  return `${codes.join("")}${value}${ANSI.reset}`;
}

function trimDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function identity(value: string): string {
  return value;
}

import * as nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

type NormalizeStackOptions = {
  skipFrames?: number;
};

type ParsedStackLine = {
  head: string;
  location: string;
  lineNumber: number;
  columnNumber: number;
  tail: string;
};

type SourceLocation = {
  filePath: string;
  lineNumber: number;
  columnNumber: number;
};

let findSourceMapImpl: typeof nodeModule.findSourceMap =
  nodeModule.findSourceMap;

export function captureNormalizedStack(skipFrames: number): string | undefined {
  const lines = normalizeStackLines(new Error().stack, {
    skipFrames,
  }).filter((line) => !isInternalFrame(line));

  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function normalizeStackLines(
  stack: string | undefined,
  options: NormalizeStackOptions = {},
): string[] {
  if (stack === undefined || stack.trim().length === 0) {
    return [];
  }

  return stack
    .split("\n")
    .slice(options.skipFrames ?? 0)
    .map((line) => normalizeStackLine(line))
    .filter((line) => line.length > 0);
}

const INTERNAL_FRAME_PATTERNS = [
  "src/stack/normalize-stack.",
  "src/core/utils.",
  "src/context/async-context.",
  "src/core/create-scope-trace.",
  "src/zero-setup/install.",
  "src/register.",
  "dist/register.",
  "dist/zero-setup/index.",
  "scopetrace/dist/",
  "node:internal/",
  "ModuleJob.run",
  "asyncRunEntryPointWithESMLoader",
  "onImport.tracePromise",
] as const;

export function isInternalFrame(line: string): boolean {
  const normalized = line.replace(/\\/g, "/");

  return INTERNAL_FRAME_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

function normalizeStackLine(line: string): string {
  const trimmed = line.trim();

  if (trimmed.length === 0 || isErrorHeaderLine(trimmed)) {
    return "";
  }

  const parsed = parseStackLine(trimmed);

  if (parsed === undefined) {
    return collapseWhitespace(trimmed);
  }

  return `${normalizeFrameHead(parsed.head)}${normalizeFrameLocation(parsed)}${parsed.tail}`;
}

function parseStackLine(line: string): ParsedStackLine | undefined {
  const parenthesized = line.match(
    /^(?<head>at .*?\()(?<location>.+):(?<line>\d+):(?<column>\d+)\)$/,
  );

  if (parenthesized?.groups !== undefined) {
    return toParsedStackLine(parenthesized.groups, ")");
  }

  const bareAt = line.match(
    /^(?<head>at\s+)(?<location>.+):(?<line>\d+):(?<column>\d+)$/,
  );

  if (bareAt?.groups !== undefined) {
    return toParsedStackLine(bareAt.groups, "");
  }

  const plain = line.match(/^(?<location>.+):(?<line>\d+):(?<column>\d+)$/);

  if (plain?.groups !== undefined) {
    return toParsedStackLine(plain.groups, "");
  }

  return undefined;
}

function toParsedStackLine(
  groups: Record<string, string>,
  tail: string,
): ParsedStackLine {
  return {
    head: groups.head ?? "",
    location: groups.location,
    lineNumber: Number(groups.line),
    columnNumber: Number(groups.column),
    tail,
  };
}

function normalizeFrameHead(head: string): string {
  if (head.length === 0) {
    return "";
  }

  const compact = collapseWhitespace(head);

  if (compact.endsWith("(")) {
    return `${compact.slice(0, -1).trim()} (`;
  }

  return `${compact} `;
}

function normalizeFrameLocation(frame: ParsedStackLine): string {
  const resolved = resolveSourceLocation(
    frame.location,
    frame.lineNumber,
    frame.columnNumber,
  );

  if (resolved !== undefined) {
    return `${formatDisplayPath(resolved.filePath)}:${resolved.lineNumber}:${resolved.columnNumber}`;
  }

  return `${normalizeLooseLocation(frame.location)}:${frame.lineNumber}:${frame.columnNumber}`;
}

function resolveSourceLocation(
  location: string,
  lineNumber: number,
  columnNumber: number,
): SourceLocation | undefined {
  const generatedFilePath = resolveFilePath(location);

  if (generatedFilePath === undefined) {
    return undefined;
  }

  try {
    const sourceMap = findSourceMapImpl(generatedFilePath);

    if (sourceMap === undefined) {
      return {
        filePath: generatedFilePath,
        lineNumber,
        columnNumber,
      };
    }

    const origin = sourceMap.findOrigin(lineNumber, columnNumber);

    if (!isSourceOrigin(origin)) {
      return {
        filePath: generatedFilePath,
        lineNumber,
        columnNumber,
      };
    }

    const originFilePath = resolveSourceOriginPath(
      generatedFilePath,
      sourceMap,
      origin.fileName,
    );

    if (isSameFilePath(originFilePath, generatedFilePath)) {
      return {
        filePath: generatedFilePath,
        lineNumber,
        columnNumber,
      };
    }

    return {
      filePath: originFilePath,
      lineNumber: pickPositiveNumber(origin.lineNumber, lineNumber),
      columnNumber: pickPositiveNumber(origin.columnNumber, columnNumber),
    };
  } catch {
    return {
      filePath: generatedFilePath,
      lineNumber,
      columnNumber,
    };
  }
}

function resolveSourceOriginPath(
  generatedFilePath: string,
  sourceMap: nodeModule.SourceMap,
  fileName: string,
): string {
  if (fileName.startsWith("file://")) {
    return fileURLToPath(fileName);
  }

  if (path.isAbsolute(fileName) || isWindowsAbsolutePath(fileName)) {
    return path.normalize(fileName);
  }

  const sourceRootPath = resolveFilePath(sourceMap.payload.sourceRoot);

  if (sourceRootPath !== undefined) {
    return path.resolve(sourceRootPath, fileName);
  }

  if (sourceMap.payload.sourceRoot.length > 0) {
    return path.resolve(
      path.dirname(generatedFilePath),
      sourceMap.payload.sourceRoot,
      fileName,
    );
  }

  return path.resolve(path.dirname(generatedFilePath), fileName);
}

function resolveFilePath(location: string): string | undefined {
  if (location.length === 0 || location === "native") {
    return undefined;
  }

  if (location.startsWith("node:")) {
    return undefined;
  }

  if (location.startsWith("file://")) {
    try {
      return fileURLToPath(location);
    } catch {
      return undefined;
    }
  }

  if (path.isAbsolute(location) || isWindowsAbsolutePath(location)) {
    return path.normalize(location);
  }

  if (!looksLikeFilePath(location)) {
    return undefined;
  }

  return path.resolve(location);
}

function formatDisplayPath(filePath: string): string {
  const normalized = stripExtendedLengthPrefix(path.normalize(filePath));
  const relative = path.relative(process.cwd(), normalized);

  if (
    relative.length > 0 &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative)
  ) {
    return toPosixPath(stripLeadingCurrentDir(relative));
  }

  return toPosixPath(normalized);
}

function normalizeLooseLocation(location: string): string {
  const filePath = resolveFilePath(location);

  if (filePath !== undefined) {
    return formatDisplayPath(filePath);
  }

  return location.replace(/\\/g, "/").replace(/^file:\/\//, "");
}

function looksLikeFilePath(location: string): boolean {
  return (
    location.startsWith("./") ||
    location.startsWith("../") ||
    location.includes("/") ||
    location.includes("\\")
  );
}

function isWindowsAbsolutePath(location: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(location);
}

function isSourceOrigin(
  value: nodeModule.SourceOrigin | {},
): value is nodeModule.SourceOrigin {
  return (
    "fileName" in value &&
    typeof value.fileName === "string" &&
    typeof value.lineNumber === "number" &&
    typeof value.columnNumber === "number"
  );
}

function isErrorHeaderLine(line: string): boolean {
  return /^(?:[A-Za-z0-9_$]*Error|Exception)(?::|$)/.test(line);
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripLeadingCurrentDir(value: string): string {
  return value.replace(/^\.([\\/])/, "");
}

function stripExtendedLengthPrefix(value: string): string {
  return value.replace(/^\\\\\?\\/, "");
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function isSameFilePath(left: string, right: string): boolean {
  const normalizedLeft = stripExtendedLengthPrefix(path.normalize(left));
  const normalizedRight = stripExtendedLengthPrefix(path.normalize(right));

  if (process.platform === "win32") {
    return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }

  return normalizedLeft === normalizedRight;
}

function pickPositiveNumber(value: number, fallback: number): number {
  return value > 0 ? value : fallback;
}

export function setFindSourceMapForTesting(
  implementation: typeof nodeModule.findSourceMap | undefined,
): void {
  findSourceMapImpl = implementation ?? nodeModule.findSourceMap;
}

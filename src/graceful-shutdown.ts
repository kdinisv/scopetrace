import { ScopeTraceAssertionError } from "./errors";
import { formatReport } from "./reporting/format-report";
import type {
  GracefulShutdownController,
  GracefulShutdownOptions,
  GracefulShutdownProcessLike,
  GracefulShutdownResult,
  ScopeTrace,
  ScopeTraceReport,
} from "./types/public";

export function createGracefulShutdown(
  trace: ScopeTrace,
  options: GracefulShutdownOptions = {},
): GracefulShutdownController {
  const processRef =
    options.process ?? (process as GracefulShutdownProcessLike);
  const signals = normalizeSignals(options.signals);
  const formatOptions = {
    format: options.format ?? "compact",
    limit: options.limit,
    stackFrameLimit: options.stackFrameLimit,
    color: options.color,
  };
  const mode = options.mode ?? "strict";
  const cleanExitCode = options.cleanExitCode ?? 0;
  const leakExitCode = options.leakExitCode ?? 1;
  const errorExitCode = options.errorExitCode ?? 1;
  const listeners = new Map<NodeJS.Signals, (signal: NodeJS.Signals) => void>();
  let installed = false;
  let runPromise: Promise<GracefulShutdownResult> | undefined;

  async function run(signal: NodeJS.Signals): Promise<GracefulShutdownResult> {
    if (runPromise !== undefined) {
      return runPromise;
    }

    runPromise = (async () => {
      let error: Error | undefined;

      try {
        await options.cleanup?.(signal);
      } catch (value) {
        error = toError(
          value,
          `ScopeTrace graceful shutdown cleanup failed for ${signal}`,
        );
      }

      const report = trace.report({
        ignoreRules: options.ignoreRules,
      });
      const formattedReport = formatReport(report, formatOptions);

      if (
        error === undefined &&
        report.summary.leaked > 0 &&
        mode === "strict"
      ) {
        error = new ScopeTraceAssertionError(
          `ScopeTrace graceful shutdown detected ${report.summary.leaked} leaked resource${
            report.summary.leaked === 1 ? "" : "s"
          }\n${formattedReport}`,
        );
      }

      const exitCode = pickExitCode({
        error,
        report,
        mode,
        cleanExitCode,
        leakExitCode,
        errorExitCode,
      });

      pickLogger(
        options.logger,
        report,
        error,
      )(createLogMessage(formattedReport, error));

      return {
        signal,
        report,
        exitCode,
        error,
      };
    })();

    return runPromise;
  }

  function install(): void {
    if (installed) {
      return;
    }

    for (const signal of signals) {
      const listener = () => {
        uninstall();

        void run(signal).then((result) => {
          if (options.exitOnSignal !== false) {
            processRef.exit(result.exitCode);
          }
        });
      };

      listeners.set(signal, listener);
      processRef.on(signal, listener);
    }

    installed = true;
  }

  function uninstall(): void {
    if (!installed) {
      return;
    }

    for (const [signal, listener] of listeners) {
      processRef.removeListener(signal, listener);
    }

    listeners.clear();
    installed = false;
  }

  return {
    trace,
    run,
    install,
    uninstall,
  };
}

function createLogMessage(
  formattedReport: string,
  error: Error | undefined,
): string {
  if (error === undefined || error instanceof ScopeTraceAssertionError) {
    return formattedReport;
  }

  return `${error.message}\n${formattedReport}`;
}

function normalizeSignals(
  signals: readonly NodeJS.Signals[] | undefined,
): NodeJS.Signals[] {
  if (signals !== undefined && signals.length > 0) {
    return Array.from(new Set(signals));
  }

  return process.platform === "win32"
    ? ["SIGINT", "SIGTERM", "SIGBREAK"]
    : ["SIGINT", "SIGTERM"];
}

function pickLogger(
  logger: ((message: string) => void) | undefined,
  report: ScopeTraceReport,
  error: Error | undefined,
): (message: string) => void {
  if (logger !== undefined) {
    return logger;
  }

  return error !== undefined || report.summary.leaked > 0
    ? console.error
    : console.log;
}

function pickExitCode(input: {
  error: Error | undefined;
  report: ScopeTraceReport;
  mode: "strict" | "soft";
  cleanExitCode: number;
  leakExitCode: number;
  errorExitCode: number;
}): number {
  if (
    input.error !== undefined &&
    !(input.error instanceof ScopeTraceAssertionError)
  ) {
    return input.errorExitCode;
  }

  if (input.report.summary.leaked > 0 && input.mode === "strict") {
    return input.leakExitCode;
  }

  return input.cleanExitCode;
}

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(fallbackMessage);
}

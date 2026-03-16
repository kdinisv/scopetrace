import http from "node:http";
import https from "node:https";
import net from "node:net";
import { createScopeTrace } from "../core/create-scope-trace";
import { isInternalFrame } from "../reporting/format-shared";
import { formatReport } from "../reporting/format-report";
import type {
  FormatReportOptions,
  ScopeTrace,
  TrackOptions,
  ScopeTraceReport,
} from "../types/public";

export type ZeroSetupInstallOptions = {
  trace?: ScopeTrace;
  format?: FormatReportOptions["format"];
  color?: boolean;
  stackFrameLimit?: number;
  reportOnExit?: boolean;
  includeTimers?: boolean;
  includeHttp?: boolean;
  includeHttps?: boolean;
  includeNet?: boolean;
  logger?: (message: string) => void;
};

export type ZeroSetupController = {
  trace: ScopeTrace;
  report(): ScopeTraceReport;
  formatReport(): string;
  printReport(): ScopeTraceReport;
  uninstall(): void;
};

type Cleanup = () => void;

let installedController: ZeroSetupController | undefined;

export function installZeroSetup(
  options: ZeroSetupInstallOptions = {},
): ZeroSetupController {
  if (installedController !== undefined) {
    return installedController;
  }

  const trace = options.trace ?? createScopeTrace();
  const cleanups: Cleanup[] = [];
  const formatOptions = {
    format: options.format ?? "pretty",
    color: options.color,
    stackFrameLimit: options.stackFrameLimit,
  } satisfies Omit<FormatReportOptions, "limit">;
  let didPrint = false;

  if (options.includeTimers !== false) {
    cleanups.push(patchTimers(trace));
  }

  if (options.includeHttp !== false) {
    cleanups.push(
      patchServerFactory(http, "http.createServer", "http.createServer", trace),
    );
  }

  if (options.includeHttps !== false) {
    cleanups.push(
      patchServerFactory(
        https,
        "https.createServer",
        "https.createServer",
        trace,
      ),
    );
  }

  if (options.includeNet !== false) {
    cleanups.push(
      patchServerFactory(net, "net.createServer", "net.createServer", trace),
    );
  }

  if (options.reportOnExit !== false) {
    const onExit = (): void => {
      if (didPrint) {
        return;
      }

      didPrint = true;
      const report = trace.report();
      const message = formatReport(report, formatOptions);
      const logger = options.logger ?? pickLogger(report);
      logger(message);
    };

    process.once("exit", onExit);
    cleanups.push(() => {
      process.removeListener("exit", onExit);
    });
  }

  installedController = {
    trace,
    report(): ScopeTraceReport {
      return trace.report();
    },
    formatReport(): string {
      return formatReport(trace.report(), formatOptions);
    },
    printReport(): ScopeTraceReport {
      const report = trace.report();
      const message = formatReport(report, formatOptions);
      const logger = options.logger ?? pickLogger(report);
      logger(message);
      return report;
    },
    uninstall(): void {
      for (const cleanup of cleanups.reverse()) {
        cleanup();
      }

      installedController = undefined;
    },
  };

  return installedController;
}

export function getZeroSetupTrace(): ScopeTrace | undefined {
  return installedController?.trace;
}

export function uninstallZeroSetup(): void {
  installedController?.uninstall();
}

function pickLogger(report: ScopeTraceReport): (message: string) => void {
  return report.summary.leaked > 0 ? console.error : console.log;
}

function patchTimers(trace: ScopeTrace): Cleanup {
  const originalSetTimeout = globalThis.setTimeout;
  const originalSetInterval = globalThis.setInterval;
  type TimeoutHandler = Parameters<typeof globalThis.setTimeout>[0];
  type IntervalHandler = Parameters<typeof globalThis.setInterval>[0];

  globalThis.setTimeout = ((
    handler: TimeoutHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    const handle = originalSetTimeout(handler, timeout, ...args);
    return trace.trackTimeout(
      handle,
      createAutoTrackOptions("setTimeout", "global.setTimeout") as TrackOptions,
    );
  }) as typeof globalThis.setTimeout;

  globalThis.setInterval = ((
    handler: IntervalHandler,
    timeout?: number,
    ...args: unknown[]
  ) => {
    const handle = originalSetInterval(handler, timeout, ...args);
    return trace.trackInterval(
      handle,
      createAutoTrackOptions(
        "setInterval",
        "global.setInterval",
      ) as TrackOptions,
    );
  }) as typeof globalThis.setInterval;

  return () => {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.setInterval = originalSetInterval;
  };
}

function patchServerFactory<
  TModule extends {
    createServer: (...args: never[]) => {
      close(cb?: (err?: Error) => void): void;
    };
  },
>(
  moduleRef: TModule,
  label: string,
  source: string,
  trace: ScopeTrace,
): Cleanup {
  const originalCreateServer = moduleRef.createServer;

  moduleRef.createServer = ((...args: Parameters<TModule["createServer"]>) => {
    const server = originalCreateServer.apply(moduleRef, args) as ReturnType<
      TModule["createServer"]
    >;
    return trace.trackServer(
      server,
      createAutoTrackOptions(label, source) as TrackOptions,
    );
  }) as unknown as TModule["createServer"];

  return () => {
    moduleRef.createServer = originalCreateServer;
  };
}

function createAutoTrackOptions(
  label: string,
  source: string,
): TrackOptions & { stack?: string } {
  return {
    label,
    meta: {
      autoTracked: true,
      source,
    },
    stack: captureZeroSetupStack(),
  };
}

function captureZeroSetupStack(): string | undefined {
  const stack = new Error().stack;

  if (stack === undefined) {
    return undefined;
  }

  const lines = stack
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !isInternalFrame(line));

  return lines.length > 0 ? lines.join("\n") : undefined;
}

import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScopeTraceAssertionError } from "../../src/errors";
import { createGracefulShutdown, createScopeTrace } from "../../src/index";
import type {
  GracefulShutdownProcessLike,
  ScopeTrace,
} from "../../src/types/public";

class FakeProcess extends EventEmitter implements GracefulShutdownProcessLike {
  readonly exitCalls: number[] = [];

  exit(code?: number): void {
    this.exitCalls.push(code ?? 0);
  }
}

describe("graceful shutdown helper", () => {
  let st: ScopeTrace;
  const timers: NodeJS.Timeout[] = [];

  beforeEach(() => {
    st = createScopeTrace();
  });

  afterEach(() => {
    for (const timer of timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }

    timers.length = 0;
    st.reset();
    vi.restoreAllMocks();
  });

  it("run() performs cleanup, prints a report, and exits cleanly", async () => {
    const logger = vi.fn();
    const interval = st.trackInterval(
      setInterval(() => {}, 10_000),
      {
        label: "heartbeat",
      },
    );
    timers.push(interval);

    const shutdown = createGracefulShutdown(st, {
      cleanup: () => {
        clearInterval(interval);
      },
      format: "compact",
      color: false,
      logger,
    });

    const result = await shutdown.run("SIGTERM");

    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.report.summary.total).toBe(1);
    expect(result.report.summary.disposed).toBe(1);
    expect(result.report.summary.leaked).toBe(0);
    expect(logger).toHaveBeenCalledTimes(1);
    expect(logger.mock.calls[0]?.[0]).toContain("no leaks");
  });

  it("run() returns a leak error in strict mode", async () => {
    const logger = vi.fn();

    await st.scope("worker", async () => {
      st.trackDisposable({ name: "leaky" }, () => {}, {
        label: "leaky-resource",
      });
    });

    const shutdown = createGracefulShutdown(st, {
      format: "compact",
      color: false,
      logger,
    });

    const result = await shutdown.run("SIGTERM");

    expect(result.exitCode).toBe(1);
    expect(result.error).toBeInstanceOf(ScopeTraceAssertionError);
    expect(result.report.summary.leaked).toBe(1);
    expect(logger.mock.calls[0]?.[0]).toContain("leaked=1");
    expect(logger.mock.calls[0]?.[0]).toContain("leaky-resource");
  });

  it("run() exits cleanly in soft mode even with leaks", async () => {
    const logger = vi.fn();

    await st.scope("worker", async () => {
      st.trackDisposable({ name: "leaky" }, () => {}, {
        label: "soft-leak",
      });
    });

    const shutdown = createGracefulShutdown(st, {
      mode: "soft",
      format: "compact",
      color: false,
      logger,
    });

    const result = await shutdown.run("SIGTERM");

    expect(result.exitCode).toBe(0);
    expect(result.error).toBeUndefined();
    expect(result.report.summary.leaked).toBe(1);
    expect(logger.mock.calls[0]?.[0]).toContain("leaked=1");
  });

  it("run() is idempotent and returns the same result", async () => {
    const logger = vi.fn();

    const shutdown = createGracefulShutdown(st, {
      format: "compact",
      color: false,
      logger,
    });

    const first = await shutdown.run("SIGTERM");
    const second = await shutdown.run("SIGINT");

    expect(second).toBe(first);
    expect(second.signal).toBe("SIGTERM");
    expect(logger).toHaveBeenCalledTimes(1);
  });

  it("run() reports cleanup failures with the error exit code", async () => {
    const logger = vi.fn();

    const shutdown = createGracefulShutdown(st, {
      cleanup: () => {
        throw new Error("cleanup boom");
      },
      format: "compact",
      color: false,
      logger,
    });

    const result = await shutdown.run("SIGINT");

    expect(result.exitCode).toBe(1);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error).not.toBeInstanceOf(ScopeTraceAssertionError);
    expect(result.error?.message).toContain("cleanup boom");
    expect(logger.mock.calls[0]?.[0]).toContain("cleanup boom");
  });

  it("install() is idempotent and uninstall() removes signal listeners", async () => {
    const fakeProcess = new FakeProcess();
    const logger = vi.fn();
    const timeout = st.trackTimeout(
      setTimeout(() => {}, 10_000),
      {
        label: "shutdown-timeout",
      },
    );
    timers.push(timeout);

    const shutdown = createGracefulShutdown(st, {
      signals: ["SIGINT"],
      cleanup: () => {
        clearTimeout(timeout);
      },
      process: fakeProcess,
      format: "compact",
      color: false,
      logger,
    });

    shutdown.install();
    shutdown.install();

    expect(fakeProcess.listenerCount("SIGINT")).toBe(1);

    fakeProcess.emit("SIGINT", "SIGINT");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(fakeProcess.exitCalls).toEqual([0]);
    expect(fakeProcess.listenerCount("SIGINT")).toBe(0);

    shutdown.uninstall();
    shutdown.uninstall();

    expect(fakeProcess.listenerCount("SIGINT")).toBe(0);
  });
});

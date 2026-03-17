import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScopeTrace } from "../../src/core/create-scope-trace";
import {
  ScopeTraceAssertionError,
  ScopeTraceDisposeError,
  ScopeTraceUsageError,
} from "../../src/errors";
import type { ScopeTrace } from "../../src/types/public";

class FakeServer extends EventEmitter {
  close(callback?: (err?: Error) => void): void {
    setTimeout(() => {
      this.emit("close");
      callback?.();
    }, 0);
  }
}

describe("tracking and reporting", () => {
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

  it("reports an active tracked disposable with scope metadata", async () => {
    await st.scope("bootstrap", async () => {
      await st.scope("worker", async () => {
        st.trackDisposable({ name: "worker-resource" }, () => {}, {
          label: "worker-resource",
          expectedDispose: "disposeTracked(id)",
          meta: { subsystem: "jobs" },
        });
      });
    });

    const result = st.report();

    expect(result.summary.total).toBe(1);
    expect(result.summary.active).toBe(1);
    expect(result.summary.disposed).toBe(0);
    expect(result.summary.leaked).toBe(1);
    expect(result.leaks[0]).toMatchObject({
      kind: "disposable",
      label: "worker-resource",
      scope: "bootstrap > worker",
      expectedDispose: "disposeTracked(id)",
      meta: { subsystem: "jobs" },
    });
    expect(result.leaks[0]?.stack).toBeTruthy();
    expect(result.leaks[0]?.stack?.split("\n")[0]).toContain(
      "test/unit/tracking.test.ts",
    );
    expect(result.leaks[0]?.stack).not.toContain(
      "src/core/create-scope-trace.ts",
    );
  });

  it("disposeTracked() runs the disposer and removes the leak from report", async () => {
    const resource = { disposed: false };

    await st.scope("job", async () => {
      st.trackDisposable(
        resource,
        (value) => {
          value.disposed = true;
        },
        {
          label: "job-resource",
        },
      );
    });

    const leakId = st.getTrackedId(resource);
    expect(leakId).toBeDefined();

    await st.disposeTracked(leakId!);

    const result = st.report();
    expect(resource.disposed).toBe(true);
    expect(result.summary.total).toBe(1);
    expect(result.summary.active).toBe(0);
    expect(result.summary.disposed).toBe(1);
    expect(result.summary.leaked).toBe(0);
  });

  it("disposeTracked() throws ScopeTraceUsageError for unknown resource ids", async () => {
    await expect(st.disposeTracked("missing-id")).rejects.toBeInstanceOf(
      ScopeTraceUsageError,
    );
  });

  it("disposeTracked() wraps disposer failures in ScopeTraceDisposeError", async () => {
    await st.scope("job", async () => {
      st.trackDisposable(
        { value: 1 },
        () => {
          throw new Error("boom");
        },
        { label: "broken-resource" },
      );
    });

    const leakId = st.report().leaks[0]?.id;
    await expect(st.disposeTracked(leakId!)).rejects.toBeInstanceOf(
      ScopeTraceDisposeError,
    );
  });

  it("marks tracked timeouts as disposed after clearTimeout()", () => {
    const timeout = st.trackTimeout(
      setTimeout(() => {}, 10_000),
      { label: "slow-timeout" },
    );
    timers.push(timeout);

    expect(st.report().summary.leaked).toBe(1);

    clearTimeout(timeout);

    const result = st.report();
    expect(result.summary.total).toBe(1);
    expect(result.summary.active).toBe(0);
    expect(result.summary.disposed).toBe(1);
    expect(result.summary.leaked).toBe(0);
  });

  it("marks tracked timeouts as disposed after they fire", async () => {
    const timeout = st.trackTimeout(
      setTimeout(() => {}, 0),
      { label: "short-timeout" },
    );
    timers.push(timeout);

    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    const result = st.report();
    expect(result.summary.active).toBe(0);
    expect(result.summary.disposed).toBe(1);
    expect(result.summary.leaked).toBe(0);
  });

  it("marks tracked intervals as disposed after clearInterval()", () => {
    const interval = st.trackInterval(
      setInterval(() => {}, 10_000),
      { label: "heartbeat" },
    );
    timers.push(interval);

    expect(st.report().summary.leaked).toBe(1);

    clearInterval(interval);

    const result = st.report();
    expect(result.summary.active).toBe(0);
    expect(result.summary.disposed).toBe(1);
    expect(result.summary.leaked).toBe(0);
  });

  it("tracks servers and marks them disposed after close()", async () => {
    const server = st.trackServer(new FakeServer(), {
      label: "api-server",
    });

    expect(st.report().summary.leaked).toBe(1);

    server.close();
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    const result = st.report();
    expect(result.summary.active).toBe(0);
    expect(result.summary.disposed).toBe(1);
    expect(result.summary.leaked).toBe(0);
  });

  it("supports global ignore rules by label and scope path", async () => {
    await st.scope("bootstrap", async () => {
      await st.scope("ignored-worker", async () => {
        st.trackDisposable({ id: 1 }, () => {}, { label: "ignore-me" });
      });
    });

    st.ignore({ label: "ignore-me" });
    st.ignore({ scope: "bootstrap > ignored-worker" });

    const result = st.report();
    expect(result.summary.active).toBe(1);
    expect(result.summary.leaked).toBe(0);
    expect(result.leaks).toHaveLength(0);
  });

  it("supports per-call ignore rules in report()", async () => {
    await st.scope("bootstrap", async () => {
      st.trackDisposable({ id: 1 }, () => {}, { label: "skip-in-report" });
    });

    const result = st.report({
      ignoreRules: [{ label: "skip-in-report" }],
    });

    expect(result.summary.active).toBe(1);
    expect(result.summary.leaked).toBe(0);
    expect(result.leaks).toHaveLength(0);
  });

  it("assertNoLeaks() throws in strict mode and warns in soft mode", async () => {
    await st.scope("bootstrap", async () => {
      st.trackDisposable({ id: 1 }, () => {}, { label: "leaky-resource" });
    });

    expect(() => st.assertNoLeaks()).toThrow(ScopeTraceAssertionError);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    st.assertNoLeaks({ mode: "soft", limit: 1 });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("leaky-resource");
  });

  it("assertNoLeaks() respects per-call ignore rules", async () => {
    await st.scope("bootstrap", async () => {
      st.trackDisposable({ id: 1 }, () => {}, { label: "ignored-for-assert" });
    });

    expect(() =>
      st.assertNoLeaks({
        ignoreRules: [{ label: "ignored-for-assert" }],
      }),
    ).not.toThrow();
  });
});

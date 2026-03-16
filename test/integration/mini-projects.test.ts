import { afterEach, describe, expect, it } from "vitest";
import { ScopeTraceAssertionError } from "../../src/errors";
import { runBadMiniProject } from "../fixtures/mini-projects/bad-app";
import { runGoodMiniProject } from "../fixtures/mini-projects/good-app";

describe("mini projects", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup !== undefined) {
        await cleanup();
      }
    }
  });

  it("good mini project completes without leaks", async () => {
    const { trace, report } = await runGoodMiniProject();

    expect(report.summary.total).toBeGreaterThanOrEqual(4);
    expect(report.summary.active).toBe(0);
    expect(report.summary.leaked).toBe(0);
    expect(report.leaks).toHaveLength(0);
    expect(() => trace.assertNoLeaks()).not.toThrow();
  });

  it("bad mini project reports real leaked resources", async () => {
    const { trace, report, cleanup } = await runBadMiniProject();
    cleanups.push(cleanup);

    expect(report.summary.active).toBe(4);
    expect(report.summary.leaked).toBe(4);
    expect(report.leaks.map((leak) => leak.label)).toEqual(
      expect.arrayContaining([
        "bad-http-server",
        "bad-heartbeat",
        "bad-timeout",
        "bad-disposable",
      ]),
    );
    expect(() => trace.assertNoLeaks()).toThrow(ScopeTraceAssertionError);
  });

  it("tracked ids are cleared after dispose and reset", async () => {
    const { trace } = await runGoodMiniProject();
    const resource = { closed: false };

    trace.trackDisposable(
      resource,
      (value) => {
        value.closed = true;
      },
      {
        label: "retrackable-resource",
      },
    );

    const firstId = trace.getTrackedId(resource);
    expect(firstId).toBeDefined();

    await trace.disposeTracked(firstId!);
    expect(trace.getTrackedId(resource)).toBeUndefined();

    trace.trackDisposable(
      resource,
      (value) => {
        value.closed = true;
      },
      {
        label: "retracked-resource",
      },
    );

    const secondId = trace.getTrackedId(resource);
    expect(secondId).toBeDefined();
    expect(secondId).not.toBe(firstId);

    trace.reset();
    expect(trace.getTrackedId(resource)).toBeUndefined();
  });

  it("good mini project stays clean across repeated runs", async () => {
    for (let index = 0; index < 3; index += 1) {
      const { trace, report } = await runGoodMiniProject();
      expect(report.summary.active).toBe(0);
      expect(report.summary.leaked).toBe(0);
      expect(() => trace.assertNoLeaks()).not.toThrow();
    }
  });
});

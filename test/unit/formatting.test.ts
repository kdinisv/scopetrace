import { describe, expect, it } from "vitest";
import {
  formatCompactReport,
  formatJsonReport,
  formatPrettyReport,
  formatReport,
} from "../../src/index";
import type { ScopeTraceReport } from "../../src/types/public";

const sampleReport: ScopeTraceReport = {
  summary: {
    total: 3,
    active: 2,
    disposed: 1,
    leaked: 2,
  },
  leaks: [
    {
      id: "interval_a",
      kind: "interval",
      label: "heartbeat",
      scope: "bootstrap > worker",
      createdAt: 100,
      ageMs: 3000,
      expectedDispose: "clearInterval()",
      stack: "src/worker.ts:10:1",
      meta: { component: "worker" },
    },
    {
      id: "server_b",
      kind: "server",
      label: "api-server",
      scope: "bootstrap",
      createdAt: 200,
      ageMs: 1500,
      expectedDispose: "server.close()",
    },
  ],
};

describe("report formatting", () => {
  it("formats a pretty report", () => {
    const output = formatPrettyReport(sampleReport);

    expect(output).toContain("ScopeTrace report");
    expect(output).toContain('interval \"heartbeat\"');
    expect(output).toContain("scope: bootstrap > worker");
  });

  it("formats a compact report", () => {
    const output = formatCompactReport(sampleReport, { limit: 1 });

    expect(output).toContain("ScopeTrace: leaked=2");
    expect(output).toContain("heartbeat");
    expect(output).toContain("... and 1 more");
  });

  it("formats a json report", () => {
    const output = formatJsonReport(sampleReport, { limit: 1 });
    const parsed = JSON.parse(output) as ScopeTraceReport & {
      truncatedLeaks?: number;
    };

    expect(parsed.summary.leaked).toBe(2);
    expect(parsed.leaks).toHaveLength(1);
    expect(parsed.truncatedLeaks).toBe(1);
  });

  it("dispatches formatting via formatReport()", () => {
    expect(formatReport(sampleReport, { format: "pretty" })).toContain(
      "ScopeTrace report",
    );
    expect(formatReport(sampleReport, { format: "compact" })).toContain(
      "ScopeTrace: leaked=2",
    );
    expect(formatReport(sampleReport, { format: "json" })).toContain(
      '"summary"',
    );
  });
});

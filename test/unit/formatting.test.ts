import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatCompactReport,
  formatJsonReport,
  formatPrettyReport,
  formatReport,
} from "../../src/index";
import { setFindSourceMapForTesting } from "../../src/stack/normalize-stack";
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

const emptyReport: ScopeTraceReport = {
  summary: {
    total: 0,
    active: 0,
    disposed: 0,
    leaked: 0,
  },
  leaks: [],
};

afterEach(() => {
  setFindSourceMapForTesting(undefined);
});

describe("report formatting", () => {
  it("formats a pretty report", () => {
    const output = formatPrettyReport(sampleReport, {
      color: false,
      stackFrameLimit: 2,
    });

    expect(output).toContain("ScopeTrace Report");
    expect(output).toContain("Status: LEAKS DETECTED");
    expect(output).toContain('[1] INTERVAL "heartbeat"');
    expect(output).toContain("Scope: bootstrap > worker");
    expect(output).toContain("Age: 3 s");
    expect(output).toContain("Created at: src/worker.ts:10:1");
  });

  it("formats a compact report", () => {
    const output = formatCompactReport(sampleReport, {
      limit: 1,
      color: false,
    });

    expect(output).toContain("ScopeTrace: leaked=2");
    expect(output).toContain("[1] interval");
    expect(output).toContain("heartbeat");
    expect(output).toContain("... and 1 more");
  });

  it("clarifies when no resources were observed", () => {
    expect(formatPrettyReport(emptyReport, { color: false })).toContain(
      "No tracked resources were observed during process lifetime.",
    );
    expect(formatCompactReport(emptyReport, { color: false })).toContain(
      "no tracked resources were observed",
    );
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

  it("normalizes file urls and workspace paths in stack previews", () => {
    const stack = `at createWorker (${pathToFileURL(path.resolve("src/worker.ts")).href}:10:1)`;
    const report: ScopeTraceReport = {
      ...sampleReport,
      leaks: [
        {
          ...sampleReport.leaks[0],
          stack,
        },
      ],
    };

    const output = formatPrettyReport(report, {
      color: false,
      stackFrameLimit: 2,
    });

    expect(output).toContain(
      "Created at: at createWorker (src/worker.ts:10:1)",
    );
    expect(output).not.toContain(process.cwd());
  });

  it("uses source maps when available for stack previews", () => {
    const generatedFile = path.resolve("dist/generated/example.js");
    setFindSourceMapForTesting((filePath) => {
      if (filePath !== generatedFile) {
        return undefined;
      }

      return {
        payload: {
          file: generatedFile,
          version: 3,
          sources: ["../../src/example.ts"],
          sourcesContent: [],
          names: [],
          mappings: "",
          sourceRoot: "",
        },
        findEntry: () => ({}),
        findOrigin: () => ({
          name: undefined,
          fileName: "../../src/example.ts",
          lineNumber: 7,
          columnNumber: 9,
        }),
      };
    });

    const report: ScopeTraceReport = {
      ...sampleReport,
      leaks: [
        {
          ...sampleReport.leaks[0],
          stack: `at bootstrap (${generatedFile}:12:34)`,
        },
      ],
    };

    const output = formatPrettyReport(report, {
      color: false,
      stackFrameLimit: 2,
    });

    expect(output).toContain("Created at: at bootstrap (src/example.ts:7:9)");
    expect(output).not.toContain("dist/generated/example.js:12:34");
  });

  it("dispatches formatting via formatReport()", () => {
    expect(
      formatReport(sampleReport, { format: "pretty", color: false }),
    ).toContain("ScopeTrace Report");
    expect(
      formatReport(sampleReport, { format: "compact", color: false }),
    ).toContain("ScopeTrace: leaked=2");
    expect(
      formatReport(sampleReport, { format: "json", color: false }),
    ).toContain('"summary"');
  });
});

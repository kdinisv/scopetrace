import http from "node:http";
import { createScopeTrace } from "../../../src/core/create-scope-trace";
import type { ScopeTrace, ScopeTraceReport } from "../../../src/types/public";
import { close, listen, waitForCleanup } from "./helpers";

export async function runBadMiniProject(): Promise<{
  trace: ScopeTrace;
  report: ScopeTraceReport;
  cleanup: () => Promise<void>;
}> {
  const trace = createScopeTrace();

  const server = trace.trackServer(
    http.createServer((_req, res) => {
      res.end("leaky");
    }),
    { label: "bad-http-server" },
  );
  await listen(server);

  const interval = trace.trackInterval(
    setInterval(() => {}, 1_000),
    {
      label: "bad-heartbeat",
    },
  );

  const timeout = trace.trackTimeout(
    setTimeout(() => {}, 60_000),
    {
      label: "bad-timeout",
    },
  );

  const disposable = await trace.scope("bad-app:bootstrap", async () => {
    return trace.trackDisposable(
      { closed: false },
      (resource) => {
        resource.closed = true;
      },
      {
        label: "bad-disposable",
        expectedDispose: "disposeTracked(id)",
      },
    );
  });

  return {
    trace,
    report: trace.report(),
    cleanup: async () => {
      clearInterval(interval);
      clearTimeout(timeout);

      const disposableId = trace.getTrackedId(disposable);
      if (disposableId !== undefined) {
        await trace.disposeTracked(disposableId);
      }

      await close(server);
      await waitForCleanup();
    },
  };
}

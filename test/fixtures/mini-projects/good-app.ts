import http from "node:http";
import { createScopeTrace } from "../../../src/core/create-scope-trace";
import type { ScopeTrace, ScopeTraceReport } from "../../../src/types/public";
import { close, listen, waitForCleanup } from "./helpers";

export async function runGoodMiniProject(): Promise<{
  trace: ScopeTrace;
  report: ScopeTraceReport;
}> {
  const trace = createScopeTrace();

  await trace.scope("good-app:bootstrap", async () => {
    const server = trace.trackServer(
      http.createServer((_req, res) => {
        res.end("ok");
      }),
      { label: "good-http-server" },
    );
    await listen(server);

    const startupTimeout = trace.trackTimeout(
      setTimeout(() => {}, 50),
      {
        label: "good-startup-timeout",
      },
    );

    const heartbeat = trace.trackInterval(
      setInterval(() => {}, 1_000),
      {
        label: "good-heartbeat",
      },
    );

    const disposable = trace.trackDisposable(
      { closed: false },
      (resource) => {
        resource.closed = true;
      },
      {
        label: "good-disposable",
        expectedDispose: "disposeTracked(id)",
      },
    );

    clearTimeout(startupTimeout);
    clearInterval(heartbeat);

    const disposableId = trace.getTrackedId(disposable);
    if (disposableId === undefined) {
      throw new Error("good mini project: disposable id not found");
    }

    await trace.disposeTracked(disposableId);
    await close(server);
    await waitForCleanup();
  });

  return {
    trace,
    report: trace.report(),
  };
}

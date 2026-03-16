import {
  createScopeTrace,
  ScopeTraceAssertionError,
  formatPrettyReport,
} from "scopetrace";
import { close, createServer, listen, sleep } from "./helpers.mjs";

const trace = createScopeTrace();

async function main() {
  const server = trace.trackServer(
    createServer((_req, res) => {
      res.end("leaky");
    }),
    { label: "bad-http-server" },
  );
  await listen(server);

  const interval = trace.trackInterval(setInterval(() => { }, 1_000), {
    label: "bad-heartbeat",
  });

  const timeout = trace.trackTimeout(setTimeout(() => { }, 60_000), {
    label: "bad-timeout",
  });

  const disposable = await trace.scope("bad-cli:bootstrap", async () => {
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

  console.error("BAD FIXTURE RESULT: running leak detection (leaks expected)");

  try {
    trace.assertNoLeaks({ format: "pretty", stackFrameLimit: 2 });
    console.error("BAD FIXTURE RESULT: expected leaks, but none were detected");
    process.exitCode = 2;
  } catch (error) {
    if (!(error instanceof ScopeTraceAssertionError)) {
      throw error;
    }

    console.error(error.message);
    console.error("BAD FIXTURE RESULT: leaks detected as expected");
    process.exitCode = 1;
  } finally {
    clearInterval(interval);
    clearTimeout(timeout);

    const disposableId = trace.getTrackedId(disposable);
    if (disposableId !== undefined) {
      await trace.disposeTracked(disposableId);
    }

    await close(server);
    await sleep(20);
    console.log("Cleanup report after bad fixture:");
    console.log(formatPrettyReport(trace.report()));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 3;
});

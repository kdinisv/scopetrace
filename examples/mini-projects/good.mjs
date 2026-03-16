import { createScopeTrace, formatPrettyReport } from "scopetrace";
import { close, createServer, listen, sleep } from "./helpers.mjs";

const trace = createScopeTrace();

async function main() {
  await trace.scope("good-cli:bootstrap", async () => {
    const server = trace.trackServer(
      createServer((_req, res) => {
        res.end("ok");
      }),
      { label: "good-http-server" },
    );
    await listen(server);

    const timeout = trace.trackTimeout(setTimeout(() => { }, 100), {
      label: "good-timeout",
    });

    const interval = trace.trackInterval(setInterval(() => { }, 1_000), {
      label: "good-heartbeat",
    });

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

    clearTimeout(timeout);
    clearInterval(interval);

    const disposableId = trace.getTrackedId(disposable);
    if (disposableId === undefined) {
      throw new Error("good fixture: tracked disposable id not found");
    }

    await trace.disposeTracked(disposableId);
    await close(server);
    await sleep(20);
  });

  const report = trace.report();
  console.log(formatPrettyReport(report));
  trace.assertNoLeaks({ format: "pretty" });
  console.log("GOOD FIXTURE RESULT: no leaks detected");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

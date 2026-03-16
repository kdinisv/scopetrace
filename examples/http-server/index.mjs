import http from "node:http";
import { createScopeTrace, formatPrettyReport } from "scopetrace";

const st = createScopeTrace();

const server = st.trackServer(
  http.createServer((req, res) => {
    void st.scope(`http:${req.method}:${req.url}`, async () => {
      const timeout = st.trackTimeout(setTimeout(() => {
        res.destroy(new Error("request timed out"));
      }, 5_000), {
        label: "request-timeout",
      });

      await Promise.resolve();
      clearTimeout(timeout);
      res.end("ok");
    });
  }),
  {
    label: "example-http-server",
  },
);

server.listen(3000, () => {
  console.log("Listening on http://localhost:3000");
});

process.on("SIGINT", async () => {
  server.close();
  await new Promise((resolve) => setTimeout(resolve, 20));
  console.log(formatPrettyReport(st.report()));
  process.exit(0);
});

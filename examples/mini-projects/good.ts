// Plain app with no explicit scopetrace instrumentation.
// Run via: npx scopetrace examples/mini-projects/good.ts
// Zero-setup will auto-track all resources and print Status: OK on exit.
import http from "node:http";

async function main(): Promise<void> {
  const server = http.createServer((_req, res) => {
    res.end("ok");
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  const timeout = setTimeout(() => {}, 100);
  const interval = setInterval(() => {}, 1_000);

  // Clean up everything before exit
  clearTimeout(timeout);
  clearInterval(interval);

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err !== undefined ? reject(err) : resolve()));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

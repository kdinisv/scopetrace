// Plain app with no explicit scopetrace instrumentation.
// Run via: npx scopetrace examples/mini-projects/bad.ts
// Zero-setup will auto-track all resources and print LEAKS DETECTED on exit.
import http from "node:http";

async function main(): Promise<void> {
  const server = http.createServer((_req, res) => {
    res.end("leaky");
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  setInterval(() => {}, 1_000); // intentionally leaked
  setTimeout(() => {}, 60_000); // intentionally leaked

  // Intentionally exit without closing server or timers.
  // Zero-setup will print the leak report in the exit handler.
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

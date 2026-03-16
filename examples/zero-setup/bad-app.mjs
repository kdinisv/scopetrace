import http from "node:http";

async function main() {
  const server = http.createServer((_req, res) => {
    res.end("leaky");
  });

  await new Promise((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  setInterval(() => { }, 1_000);
  setTimeout(() => { }, 60_000);

  // Force process exit so the preload can dump a best-effort report.
  setTimeout(() => {
    process.exit(0);
  }, 50);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

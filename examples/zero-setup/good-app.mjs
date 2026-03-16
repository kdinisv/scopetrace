import http from "node:http";

async function main() {
  const server = http.createServer((_req, res) => {
    res.end("ok");
  });

  await new Promise((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });

  const timeout = setTimeout(() => { }, 100);
  const interval = setInterval(() => { }, 1_000);

  clearTimeout(timeout);
  clearInterval(interval);

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

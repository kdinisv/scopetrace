import http from "node:http";

export async function listen(server) {
  await new Promise((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });
}

export async function close(server) {
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

export async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function createServer(handler) {
  return http.createServer(handler);
}

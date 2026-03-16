import http from "node:http";

export async function listen(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, () => resolve());
    server.once("error", reject);
  });
}

export async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function waitForCleanup(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 20));
}

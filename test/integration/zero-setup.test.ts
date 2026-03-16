import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  installZeroSetup,
  uninstallZeroSetup,
} from "../../src/zero-setup/install";

const servers: http.Server[] = [];
const timeouts: NodeJS.Timeout[] = [];
const intervals: NodeJS.Timeout[] = [];

afterEach(async () => {
  for (const interval of intervals.splice(0)) {
    clearInterval(interval);
  }

  for (const timeout of timeouts.splice(0)) {
    clearTimeout(timeout);
  }

  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  uninstallZeroSetup();
});

describe("zero-setup mode", () => {
  it("auto-tracks timers and servers without explicit instrumentation", async () => {
    const controller = installZeroSetup({ reportOnExit: false, color: false });

    const server = http.createServer((_req, res) => {
      res.end("ok");
    });
    servers.push(server);

    await new Promise<void>((resolve, reject) => {
      server.listen(0, () => resolve());
      server.once("error", reject);
    });

    const timeout = setTimeout(() => {}, 100);
    const interval = setInterval(() => {}, 1_000);
    timeouts.push(timeout);
    intervals.push(interval);

    clearTimeout(timeout);
    clearInterval(interval);

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error !== undefined) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    servers.length = 0;

    await new Promise<void>((resolve) => setImmediate(resolve));

    const report = controller.report();
    expect(report.summary.total).toBeGreaterThanOrEqual(3);
    expect(report.summary.active).toBe(0);
    expect(report.summary.leaked).toBe(0);
  });

  it("captures user callsites for auto-tracked resources", () => {
    const controller = installZeroSetup({ reportOnExit: false, color: false });

    const timeout = setTimeout(() => {}, 60_000);
    timeouts.push(timeout);

    const report = controller.report();
    const leak = report.leaks.find((resource) =>
      resource.stack?.includes("zero-setup.test.ts"),
    );

    expect(leak).toBeDefined();
    expect(leak?.stack?.split("\n")[0]).toContain("zero-setup.test.ts");
    expect(leak?.stack).not.toContain("src/zero-setup/install.ts");
    expect(leak?.stack).not.toContain("dist/register.js");
  });

  it("uninstall restores patched globals", () => {
    const originalSetTimeout = globalThis.setTimeout;
    const originalSetInterval = globalThis.setInterval;
    const originalCreateServer = http.createServer;

    const controller = installZeroSetup({ reportOnExit: false, color: false });
    controller.uninstall();

    expect(globalThis.setTimeout).toBe(originalSetTimeout);
    expect(globalThis.setInterval).toBe(originalSetInterval);
    expect(http.createServer).toBe(originalCreateServer);
  });
});

import https from "node:https";

export function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string): number[] => v.split(".").map(Number);
  const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest);
  const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

export async function checkForUpdate(
  name: string,
  currentVersion: string,
): Promise<string | undefined> {
  try {
    const latestVersion = await fetchLatestVersion(name, 3000);

    if (
      latestVersion !== undefined &&
      isNewerVersion(latestVersion, currentVersion)
    ) {
      return [
        `Update available: ${currentVersion} → ${latestVersion}`,
        `Run: npm install -g ${name}`,
      ].join("\n");
    }
  } catch {
    // best-effort: network errors are silently ignored
  }

  return undefined;
}

function fetchLatestVersion(
  packageName: string,
  timeoutMs: number,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (value: string | undefined): void => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const req = https.get(
      `https://registry.npmjs.org/${packageName}/latest`,
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          settle(undefined);
          return;
        }

        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { version?: string };
            settle(parsed.version);
          } catch {
            settle(undefined);
          }
        });
        res.on("error", () => settle(undefined));
      },
    );

    req.on("error", () => settle(undefined));

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      settle(undefined);
    });

    // Don't block process exit waiting for the network response
    req.once("socket", (socket) => {
      socket.unref();
    });
  });
}

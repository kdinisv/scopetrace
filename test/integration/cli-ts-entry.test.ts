import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("cli TypeScript entry support", () => {
  it("runs a .ts entry through the built-in tsx runtime", () => {
    const cliPath = path.resolve("dist/cli.js");
    const entryPath = path.resolve("test/fixtures/zero-setup/good-entry.ts");
    const npmExecPath = process.env.npm_execpath;

    expect(npmExecPath).toBeDefined();

    const build = spawnSync(process.execPath, [npmExecPath!, "run", "build"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(build.status).toBe(0);

    const run = spawnSync(process.execPath, [cliPath, entryPath], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(run.status).toBe(0);
    expect(run.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(run.stderr).toContain("scopetrace v");
    expect(run.stdout).toContain("ScopeTrace Report");
    expect(run.stdout).toContain("Status: OK");
  });
});

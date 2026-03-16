#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkForUpdate } from "./cli/check-update";
import { parseCliArgs, type RunCliOptions } from "./cli/parse-cli-args";

const TYPE_SCRIPT_ENTRY_PATTERN = /\.(cts|mts|ts|tsx)$/;
const PACKAGE_NAME = "scopetrace";
const CURRENT_VERSION = readCurrentVersion();

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    return;
  }

  const parsed = parseCliArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  if (parsed.error !== undefined) {
    printHelp(parsed.error);
    process.exitCode = 1;
    return;
  }

  if (parsed.nodeArgs.length === 0) {
    printHelp("Missing script. Example: scopetrace app.mjs");
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`scopetrace v${CURRENT_VERSION}\n\n`);

  // Start update check before spawning — runs concurrently with the child process
  const updateCheckPromise = shouldCheckForUpdate()
    ? checkForUpdate(PACKAGE_NAME, CURRENT_VERSION)
    : Promise.resolve(undefined);

  const env = {
    ...process.env,
    ...buildScopedEnv(parsed.options),
  };
  const runtimeImports = shouldEnableTypeScriptRuntime(parsed.nodeArgs)
    ? ["--import", "tsx"]
    : [];

  const child = spawn(
    process.execPath,
    [...runtimeImports, "--import", resolveRegisterPath(), ...parsed.nodeArgs],
    {
      stdio: "inherit",
      env,
    },
  );

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        resolve(1);
        return;
      }

      resolve(code ?? 0);
    });
  });

  process.exitCode = exitCode;

  // Race the update check against a short fallback — usually already resolved
  const updateMessage = await Promise.race([
    updateCheckPromise,
    new Promise<undefined>((resolve) => {
      setTimeout(() => resolve(undefined), 1500).unref();
    }),
  ]);

  if (updateMessage !== undefined) {
    process.stderr.write(`\n${updateMessage}\n`);
  }
}

function buildScopedEnv(options: RunCliOptions): Record<string, string> {
  const env: Record<string, string> = {};

  if (options.format !== undefined) {
    env.SCOPETRACE_FORMAT = options.format;
  }

  if (options.stackFrames !== undefined) {
    env.SCOPETRACE_STACK_FRAMES = String(options.stackFrames);
  }

  setBoolEnv(env, "SCOPETRACE_COLOR", options.color);
  setBoolEnv(env, "SCOPETRACE_INCLUDE_TIMERS", options.includeTimers);
  setBoolEnv(env, "SCOPETRACE_INCLUDE_HTTP", options.includeHttp);
  setBoolEnv(env, "SCOPETRACE_INCLUDE_HTTPS", options.includeHttps);
  setBoolEnv(env, "SCOPETRACE_INCLUDE_NET", options.includeNet);

  return env;
}

function setBoolEnv(
  env: Record<string, string>,
  key: string,
  value: boolean | undefined,
): void {
  if (value !== undefined) {
    env[key] = value ? "1" : "0";
  }
}

function resolveRegisterPath(): string {
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  return pathToFileURL(path.join(cliDir, "register.js")).href;
}

function shouldEnableTypeScriptRuntime(nodeArgs: string[]): boolean {
  const entry = nodeArgs.find((arg) => !arg.startsWith("-"));
  return entry !== undefined && TYPE_SCRIPT_ENTRY_PATTERN.test(entry);
}

function readCurrentVersion(): string {
  try {
    const pkgPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../package.json",
    );
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return "unknown";
  }
}

function shouldCheckForUpdate(): boolean {
  return (
    process.env.SCOPETRACE_NO_UPDATE_CHECK === undefined &&
    process.env.CI === undefined
  );
}

function printHelp(error?: string): void {
  const output = [
    error,
    "Usage:",
    "  scopetrace [options] <script> [...args]",
    "  scopetrace [options] node <script> [...args]",
    "  scopetrace run node <script> [...args]",
    "",
    "Examples:",
    "  npx scopetrace app.mjs",
    "  npx scopetrace src/app.ts",
    "  npx scopetrace --format compact --stack-frames 2 app.mjs",
    "  npx scopetrace run node app.mjs",
    "  npm exec --package scopetrace sctrace app.mjs",
    "",
    "Options:",
    "  --format pretty|compact|json",
    "  --stack-frames <number>",
    "  --color | --no-color",
    "  --timers | --no-timers",
    "  --http | --no-http",
    "  --https | --no-https",
    "  --net | --no-net",
    "",
    "Note:",
    "  TypeScript entry files (.ts, .tsx, .mts, .cts) are executed through the built-in tsx runtime.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  console.error(output);
}

void main();

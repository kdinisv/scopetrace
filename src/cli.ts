#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { parseCliArgs, type RunCliOptions } from "./cli/parse-cli-args";

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

  const env = {
    ...process.env,
    ...buildScopedEnv(parsed.options),
  };

  const child = spawn(
    process.execPath,
    ["--import", resolveRegisterPath(), ...parsed.nodeArgs],
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

  if (exitCode !== 0) {
    maybePrintTypeScriptHint(parsed.nodeArgs);
  }

  process.exitCode = exitCode;
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
  return pathToFileURL(
    path.join(path.dirname(process.argv[1] ?? process.cwd()), "register.js"),
  ).href;
}

function maybePrintTypeScriptHint(nodeArgs: string[]): void {
  const typeScriptEntry = nodeArgs.find((arg) =>
    /\.(cts|mts|ts|tsx)$/.test(arg),
  );

  if (typeScriptEntry === undefined) {
    return;
  }

  console.error(
    [
      "",
      "TypeScript note:",
      `  ${typeScriptEntry} is executed by Node directly through scopetrace.`,
      "  scopetrace does not transpile TypeScript or rewrite TS-only import resolution.",
      "  If this entry is not directly runnable by Node, point scopetrace at built JavaScript or use a TS runtime such as tsx.",
    ].join("\n"),
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
    "  scopetrace runs Node directly. For TypeScript projects, point it at built JS or a TS runtime entry that Node can execute.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");

  console.error(output);
}

void main();

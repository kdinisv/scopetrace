import { installZeroSetup } from "./zero-setup/install";

installZeroSetup({
  format: readFormat(),
  color: readColor(),
  stackFrameLimit: readStackFrameLimit(),
  reportOnExit: readBooleanEnv("SCOPETRACE_REPORT_ON_EXIT", true),
  includeTimers: readBooleanEnv("SCOPETRACE_INCLUDE_TIMERS", true),
  includeHttp: readBooleanEnv("SCOPETRACE_INCLUDE_HTTP", true),
  includeHttps: readBooleanEnv("SCOPETRACE_INCLUDE_HTTPS", true),
  includeNet: readBooleanEnv("SCOPETRACE_INCLUDE_NET", true),
});

function readFormat(): "pretty" | "compact" | "json" {
  const value = process.env.SCOPETRACE_FORMAT;

  if (value === "compact" || value === "json") {
    return value;
  }

  return "pretty";
}

function readStackFrameLimit(): number | undefined {
  const value = process.env.SCOPETRACE_STACK_FRAMES;

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readColor(): boolean | undefined {
  const value = process.env.SCOPETRACE_COLOR;

  if (value === undefined) {
    return undefined;
  }

  return value !== "0" && value.toLowerCase() !== "false";
}

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  return value !== "0" && value.toLowerCase() !== "false";
}

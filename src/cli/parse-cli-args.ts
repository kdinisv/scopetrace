export type RunCliOptions = {
  format?: "pretty" | "compact" | "json";
  stackFrames?: number;
  color?: boolean;
  includeTimers?: boolean;
  includeHttp?: boolean;
  includeHttps?: boolean;
  includeNet?: boolean;
};

export type ParsedCliArgs = {
  options: RunCliOptions;
  nodeArgs: string[];
  error?: string;
  help?: boolean;
};

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const parsed = parseLeadingOptions(args);

  if (parsed.help || parsed.error !== undefined) {
    return {
      options: parsed.options,
      nodeArgs: [],
      help: parsed.help,
      error: parsed.error,
    };
  }

  const commandTokens = args.slice(parsed.index);

  if (commandTokens.length === 0) {
    return {
      options: parsed.options,
      nodeArgs: [],
      error: "Missing script. Example: scopetrace app.mjs",
    };
  }

  if (commandTokens[0] === "run") {
    return parseLegacyRun(commandTokens.slice(1), parsed.options);
  }

  return parseDirectInvocation(commandTokens, parsed.options);
}

type BooleanCliFlag =
  | "color"
  | "includeTimers"
  | "includeHttp"
  | "includeHttps"
  | "includeNet";

const BOOLEAN_FLAGS: Record<string, readonly [BooleanCliFlag, boolean]> = {
  "--color": ["color", true],
  "--no-color": ["color", false],
  "--timers": ["includeTimers", true],
  "--no-timers": ["includeTimers", false],
  "--http": ["includeHttp", true],
  "--no-http": ["includeHttp", false],
  "--https": ["includeHttps", true],
  "--no-https": ["includeHttps", false],
  "--net": ["includeNet", true],
  "--no-net": ["includeNet", false],
};

function parseLeadingOptions(args: string[]): {
  options: RunCliOptions;
  index: number;
  error?: string;
  help?: boolean;
} {
  const options: RunCliOptions = {};
  let index = 0;

  while (index < args.length) {
    const current = args[index];

    if (current === "--") {
      return { options, index: index + 1 };
    }

    if (current === "--help" || current === "-h") {
      return { options, index, help: true };
    }

    if (!current.startsWith("--")) {
      return { options, index };
    }

    if (current === "--format") {
      const value = args[index + 1];
      if (value !== "pretty" && value !== "compact" && value !== "json") {
        return {
          options,
          index,
          error: "Invalid value for --format. Use pretty, compact, or json.",
        };
      }

      options.format = value;
      index += 2;
      continue;
    }

    if (current === "--stack-frames") {
      const value = Number(args[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        return {
          options,
          index,
          error: "Invalid value for --stack-frames. Use a positive number.",
        };
      }

      options.stackFrames = value;
      index += 2;
      continue;
    }

    const booleanFlag = BOOLEAN_FLAGS[current];
    if (booleanFlag !== undefined) {
      options[booleanFlag[0]] = booleanFlag[1];
      index += 1;
      continue;
    }

    return {
      options,
      index,
      error: `Unknown option: ${current}`,
    };
  }

  return { options, index };
}

function parseLegacyRun(args: string[], options: RunCliOptions): ParsedCliArgs {
  if (args.length === 0) {
    return {
      options,
      nodeArgs: [],
      error: "Missing command. Example: scopetrace run node app.mjs",
    };
  }

  if (args[0] === "--help" || args[0] === "-h") {
    return {
      options,
      nodeArgs: [],
      help: true,
    };
  }

  if (!isNodeCommand(args[0])) {
    return {
      options,
      nodeArgs: [],
      error: `Unsupported command: ${args[0]}. The wrapper currently supports Node only. Use: scopetrace app.mjs`,
    };
  }

  if (args.length === 1) {
    return {
      options,
      nodeArgs: [],
      error: "Missing script after node. Example: scopetrace app.mjs",
    };
  }

  return {
    options,
    nodeArgs: args.slice(1),
  };
}

function parseDirectInvocation(
  args: string[],
  options: RunCliOptions,
): ParsedCliArgs {
  if (args[0] === "--help" || args[0] === "-h") {
    return {
      options,
      nodeArgs: [],
      help: true,
    };
  }

  if (isNodeCommand(args[0])) {
    if (args.length === 1) {
      return {
        options,
        nodeArgs: [],
        error: "Missing script after node. Example: scopetrace app.mjs",
      };
    }

    return {
      options,
      nodeArgs: args.slice(1),
    };
  }

  return {
    options,
    nodeArgs: args,
  };
}

function isNodeCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return normalized === "node" || normalized === "node.exe";
}

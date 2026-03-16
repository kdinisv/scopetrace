import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/parse-cli-args";

describe("cli argument parsing", () => {
  it("parses direct script invocation", () => {
    const parsed = parseCliArgs(["app.mjs"]);

    expect(parsed.error).toBeUndefined();
    expect(parsed.nodeArgs).toEqual(["app.mjs"]);
  });

  it("parses direct invocation with explicit node", () => {
    const parsed = parseCliArgs(["node", "app.mjs", "--flag"]);

    expect(parsed.error).toBeUndefined();
    expect(parsed.nodeArgs).toEqual(["app.mjs", "--flag"]);
  });

  it("keeps legacy run node syntax working", () => {
    const parsed = parseCliArgs(["run", "node", "app.mjs"]);

    expect(parsed.error).toBeUndefined();
    expect(parsed.nodeArgs).toEqual(["app.mjs"]);
  });

  it("parses wrapper options before direct script invocation", () => {
    const parsed = parseCliArgs([
      "--format",
      "compact",
      "--stack-frames",
      "2",
      "--no-color",
      "app.mjs",
    ]);

    expect(parsed.options).toMatchObject({
      format: "compact",
      stackFrames: 2,
      color: false,
    });
    expect(parsed.nodeArgs).toEqual(["app.mjs"]);
  });

  it("supports passing node args after separator", () => {
    const parsed = parseCliArgs([
      "--format",
      "json",
      "--",
      "--inspect",
      "app.mjs",
    ]);

    expect(parsed.options.format).toBe("json");
    expect(parsed.nodeArgs).toEqual(["--inspect", "app.mjs"]);
  });

  it("returns help for direct help flag", () => {
    const parsed = parseCliArgs(["--help"]);

    expect(parsed.help).toBe(true);
  });

  it("returns error for unsupported legacy command", () => {
    const parsed = parseCliArgs(["run", "python", "app.py"]);

    expect(parsed.error).toContain("supports Node only");
  });
});

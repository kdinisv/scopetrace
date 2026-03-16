import { describe, it, expect } from "vitest";
import {
  ScopeTraceError,
  ScopeTraceDisposeError,
  ScopeTraceAssertionError,
  ScopeTraceUsageError,
} from "../../src/errors";

describe("error classes", () => {
  it("ScopeTraceError has correct name and is an Error", () => {
    const err = new ScopeTraceError("test message");
    expect(err.name).toBe("ScopeTraceError");
    expect(err.message).toBe("test message");
    expect(err).toBeInstanceOf(Error);
  });

  it("ScopeTraceDisposeError extends ScopeTraceError", () => {
    const err = new ScopeTraceDisposeError("dispose failed");
    expect(err.name).toBe("ScopeTraceDisposeError");
    expect(err).toBeInstanceOf(ScopeTraceError);
    expect(err).toBeInstanceOf(Error);
  });

  it("ScopeTraceAssertionError extends ScopeTraceError", () => {
    const err = new ScopeTraceAssertionError("2 leaked resources");
    expect(err.name).toBe("ScopeTraceAssertionError");
    expect(err).toBeInstanceOf(ScopeTraceError);
  });

  it("ScopeTraceUsageError extends ScopeTraceError", () => {
    const err = new ScopeTraceUsageError("invalid usage");
    expect(err.name).toBe("ScopeTraceUsageError");
    expect(err).toBeInstanceOf(ScopeTraceError);
  });

  it("all error classes have a stack trace", () => {
    const err = new ScopeTraceAssertionError("with stack");
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain("ScopeTraceAssertionError");
  });
});

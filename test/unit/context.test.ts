import { describe, it, expect, beforeEach } from "vitest";
import {
  createAsyncContext,
  type AsyncContext,
} from "../../src/context/async-context";

describe("async-context", () => {
  let ctx: AsyncContext;

  beforeEach(() => {
    ctx = createAsyncContext();
  });

  it("returns undefined when no scope is active", () => {
    expect(ctx.getCurrentScopeId()).toBeUndefined();
  });

  it("returns the scope id inside runInScope", () => {
    let captured: string | undefined;
    ctx.runInScope("test-scope", () => {
      captured = ctx.getCurrentScopeId();
    });
    expect(captured).toBe("test-scope");
  });

  it("restores previous context after runInScope exits", () => {
    ctx.runInScope("test-scope", () => {});
    expect(ctx.getCurrentScopeId()).toBeUndefined();
  });

  it("propagates scope id through async operations", async () => {
    let capturedBefore: string | undefined;
    let capturedAfterAwait: string | undefined;

    await ctx.runInScope("async-test", async () => {
      capturedBefore = ctx.getCurrentScopeId();
      await Promise.resolve();
      capturedAfterAwait = ctx.getCurrentScopeId();
    });

    expect(capturedBefore).toBe("async-test");
    expect(capturedAfterAwait).toBe("async-test");
  });

  it("propagates scope id through multiple awaits", async () => {
    const results: (string | undefined)[] = [];

    await ctx.runInScope("multi-await", async () => {
      results.push(ctx.getCurrentScopeId());
      await Promise.resolve();
      results.push(ctx.getCurrentScopeId());
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      results.push(ctx.getCurrentScopeId());
    });

    expect(results).toEqual(["multi-await", "multi-await", "multi-await"]);
  });

  it("isolates scope ids between concurrent async operations", async () => {
    const captured: string[] = [];

    await Promise.all([
      ctx.runInScope("scope-a", async () => {
        await Promise.resolve();
        captured.push(ctx.getCurrentScopeId() ?? "none");
      }),
      ctx.runInScope("scope-b", async () => {
        await Promise.resolve();
        captured.push(ctx.getCurrentScopeId() ?? "none");
      }),
    ]);

    expect(captured).toContain("scope-a");
    expect(captured).toContain("scope-b");
    expect(captured).toHaveLength(2);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createScopeTrace } from "../../src/core/create-scope-trace";
import type { ScopeTrace } from "../../src/types/public";

describe("scope()", () => {
  let st: ScopeTrace;

  beforeEach(() => {
    st = createScopeTrace();
  });

  it("executes synchronous functions and returns the value", () => {
    const result = st.scope("sync-test", () => 42);
    expect(result).toBe(42);
  });

  it("executes async functions and returns the resolved value", async () => {
    const result = await st.scope("async-test", async () => "hello");
    expect(result).toBe("hello");
  });

  it("passes complex return values through unchanged", async () => {
    const data = { value: "test", count: 42 };
    const result = await st.scope("data-test", async () => data);
    expect(result).toBe(data);
  });

  it("propagates thrown errors from the function body", async () => {
    await expect(
      st.scope("error-test", async () => {
        throw new Error("scope error");
      }),
    ).rejects.toThrow("scope error");
  });

  it("sets a scope id inside the function body", async () => {
    let capturedId: string | undefined;

    await st.scope("propagation-test", async () => {
      capturedId = st.getCurrentScopeId();
    });

    expect(capturedId).toBeDefined();
    expect(typeof capturedId).toBe("string");
  });

  it("assigns unique scope ids to concurrent scopes", async () => {
    const ids: (string | undefined)[] = [];

    await Promise.all([
      st.scope("scope-1", async () => {
        await Promise.resolve();
        ids.push(st.getCurrentScopeId());
      }),
      st.scope("scope-2", async () => {
        await Promise.resolve();
        ids.push(st.getCurrentScopeId());
      }),
    ]);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeDefined();
    expect(ids[1]).toBeDefined();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("supports nested scopes with different ids", async () => {
    let outerId: string | undefined;
    let innerId: string | undefined;

    await st.scope("outer", async () => {
      outerId = st.getCurrentScopeId();
      await st.scope("inner", async () => {
        innerId = st.getCurrentScopeId();
      });
    });

    expect(outerId).toBeDefined();
    expect(innerId).toBeDefined();
    expect(innerId).not.toBe(outerId);
  });

  it("restores outer scope id after nested scope exits", async () => {
    let outerIdBefore: string | undefined;
    let outerIdAfter: string | undefined;

    await st.scope("outer", async () => {
      outerIdBefore = st.getCurrentScopeId();
      await st.scope("inner", async () => {});
      outerIdAfter = st.getCurrentScopeId();
    });

    expect(outerIdAfter).toBe(outerIdBefore);
  });

  it("scope id is undefined after top-level scope exits", async () => {
    await st.scope("top", async () => {});
    expect(st.getCurrentScopeId()).toBeUndefined();
  });

  it("reset() does not throw and isolates state", async () => {
    await st.scope("to-be-reset", async () => {});
    expect(() => st.reset()).not.toThrow();
    expect(() => st.reset()).not.toThrow();
  });

  it("two instances have independent scopes", async () => {
    const st2 = createScopeTrace();
    let id1: string | undefined;
    let id2: string | undefined;

    await st.scope("instance-1", async () => {
      id1 = st.getCurrentScopeId();
      // st2 should not see st's scope
      expect(st2.getCurrentScopeId()).toBeUndefined();
    });

    await st2.scope("instance-2", async () => {
      id2 = st2.getCurrentScopeId();
      expect(st.getCurrentScopeId()).toBeUndefined();
    });

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });
});

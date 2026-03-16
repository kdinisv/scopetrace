import { describe, it, expect, beforeEach } from "vitest";
import { createIdGenerator, type IdGenerator } from "../../src/registry/ids";

describe("createIdGenerator", () => {
  let ids: IdGenerator;

  beforeEach(() => {
    ids = createIdGenerator();
  });

  it("generates an id with prefix, instance hex, and counter", () => {
    const id = ids.generateId("scope");
    // format: prefix_hex8chars_counter6digits
    expect(id).toMatch(/^scope_[0-9a-f]{8}_000001$/);
  });

  it("generates unique ids on every call", () => {
    const result = Array.from({ length: 10 }, () => ids.generateId("x"));
    const unique = new Set(result);
    expect(unique.size).toBe(10);
  });

  it("increments counter on each call", () => {
    const id1 = ids.generateId("t");
    const id2 = ids.generateId("t");
    expect(id1).toMatch(/_000001$/);
    expect(id2).toMatch(/_000002$/);
  });

  it("separate instances have independent counters and different instance ids", () => {
    const ids2 = createIdGenerator();
    const a = ids.generateId("x");
    const b = ids2.generateId("x");
    // Both have counter 000001 but different instance hex
    expect(a.endsWith("_000001")).toBe(true);
    expect(b.endsWith("_000001")).toBe(true);
    expect(a).not.toBe(b);
  });
});

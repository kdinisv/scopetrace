import { describe, it, expect, beforeEach } from "vitest";
import { ScopeStore } from "../../src/context/scope-store";

describe("ScopeStore", () => {
  let store: ScopeStore;

  beforeEach(() => {
    store = new ScopeStore();
  });

  it("stores and retrieves a scope by id", () => {
    store.add({ id: "a", name: "alpha", createdAt: 1000 });
    expect(store.get("a")?.name).toBe("alpha");
  });

  it("returns undefined for an unknown id", () => {
    expect(store.get("unknown")).toBeUndefined();
  });

  it("stores metadata on a scope record", () => {
    store.add({
      id: "a",
      name: "meta-test",
      createdAt: 1234567890,
      meta: { userId: 42 },
    });
    expect(store.get("a")?.meta).toEqual({ userId: 42 });
    expect(store.get("a")?.createdAt).toBe(1234567890);
  });

  it("returns the scope name as ancestry path for a root scope", () => {
    store.add({ id: "root", name: "bootstrap", createdAt: 1000 });
    expect(store.getAncestryPath("root")).toBe("bootstrap");
  });

  it('builds "parent > child" ancestry path', () => {
    store.add({ id: "p", name: "outer", createdAt: 1000 });
    store.add({ id: "c", name: "inner", parentId: "p", createdAt: 1001 });
    expect(store.getAncestryPath("c")).toBe("outer > inner");
  });

  it("builds three-level ancestry path", () => {
    store.add({ id: "a", name: "root", createdAt: 1000 });
    store.add({ id: "b", name: "child", parentId: "a", createdAt: 1001 });
    store.add({ id: "c", name: "grandchild", parentId: "b", createdAt: 1002 });
    expect(store.getAncestryPath("c")).toBe("root > child > grandchild");
  });

  it("returns empty string for an unknown scope id in ancestry", () => {
    expect(store.getAncestryPath("nonexistent")).toBe("");
  });

  it("clears all scopes", () => {
    store.add({ id: "a", name: "alpha", createdAt: 1000 });
    store.add({ id: "b", name: "beta", createdAt: 1001 });
    store.clear();
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")).toBeUndefined();
  });

  it("deletes a single scope by id", () => {
    store.add({ id: "a", name: "alpha", createdAt: 1000 });
    store.add({ id: "b", name: "beta", createdAt: 1001 });
    expect(store.delete("a")).toBe(true);
    expect(store.get("a")).toBeUndefined();
    expect(store.get("b")?.name).toBe("beta");
  });

  it("returns false when deleting a non-existent scope", () => {
    expect(store.delete("unknown")).toBe(false);
  });

  it("tracks size correctly", () => {
    expect(store.size).toBe(0);
    store.add({ id: "a", name: "alpha", createdAt: 1000 });
    expect(store.size).toBe(1);
    store.add({ id: "b", name: "beta", createdAt: 1001 });
    expect(store.size).toBe(2);
    store.delete("a");
    expect(store.size).toBe(1);
    store.clear();
    expect(store.size).toBe(0);
  });
});

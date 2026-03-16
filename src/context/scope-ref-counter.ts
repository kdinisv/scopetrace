import type { ScopeStore } from "./scope-store";

export class ScopeRefCounter {
  private readonly counts = new Map<string, number>();

  constructor(private readonly store: ScopeStore) {}

  retain(scopeId: string): void {
    this.counts.set(scopeId, (this.counts.get(scopeId) ?? 0) + 1);
  }

  release(scopeId: string): void {
    const next = (this.counts.get(scopeId) ?? 0) - 1;

    if (next <= 0) {
      this.counts.delete(scopeId);
      this.store.delete(scopeId);
      return;
    }

    this.counts.set(scopeId, next);
  }

  retainChain(scopeId: string | undefined): void {
    if (scopeId === undefined) {
      return;
    }

    for (const id of this.store.getAncestryIds(scopeId)) {
      this.retain(id);
    }
  }

  releaseChain(scopeId: string | undefined): void {
    if (scopeId === undefined) {
      return;
    }

    for (const id of this.store.getAncestryIds(scopeId)) {
      this.release(id);
    }
  }

  clear(): void {
    this.counts.clear();
  }
}

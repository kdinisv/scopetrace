import type { ScopeRecord } from "../types/internal";

export class ScopeStore {
  private readonly scopes = new Map<string, ScopeRecord>();

  add(scope: ScopeRecord): void {
    this.scopes.set(scope.id, scope);
  }

  get(id: string): ScopeRecord | undefined {
    return this.scopes.get(id);
  }

  /**
   * Returns the ancestry path as "grandparent > parent > scope",
   * walking up through parentId links.
   */
  getAncestryPath(id: string): string {
    const parts: string[] = [];
    let current: ScopeRecord | undefined = this.scopes.get(id);
    while (current !== undefined) {
      parts.unshift(current.name);
      current =
        current.parentId !== undefined
          ? this.scopes.get(current.parentId)
          : undefined;
    }
    return parts.join(" > ");
  }

  delete(id: string): boolean {
    return this.scopes.delete(id);
  }

  get size(): number {
    return this.scopes.size;
  }

  clear(): void {
    this.scopes.clear();
  }
}

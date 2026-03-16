import type {
  RegisteredTrackedResource,
  RegisterTrackedResourceInput,
  TrackedResource,
} from "../types/internal";
import type { IgnoreRule } from "../types/public";

export type DisposeResult = "disposed" | "missing" | "unsupported";

export class ResourceRegistry {
  private readonly activeResources = new Map<
    string,
    RegisteredTrackedResource
  >();
  private readonly ignoreRules: IgnoreRule[] = [];
  private disposedCount = 0;
  private totalTrackedCount = 0;

  register(resource: RegisterTrackedResourceInput): TrackedResource {
    const record: RegisteredTrackedResource = {
      ...resource,
      status: "active",
    };

    this.activeResources.set(record.id, record);
    this.totalTrackedCount += 1;

    return this.toTrackedResource(record);
  }

  addIgnoreRule(rule: IgnoreRule): void {
    this.ignoreRules.push(rule);
  }

  getIgnoreRules(): readonly IgnoreRule[] {
    return this.ignoreRules;
  }

  getCounts(): { total: number; active: number; disposed: number } {
    this.syncActiveResources();

    return {
      total: this.totalTrackedCount,
      active: this.activeResources.size,
      disposed: this.disposedCount,
    };
  }

  listActive(): TrackedResource[] {
    this.syncActiveResources();
    return Array.from(this.activeResources.values(), (resource) =>
      this.toTrackedResource(resource),
    );
  }

  async dispose(id: string): Promise<DisposeResult> {
    const resource = this.activeResources.get(id);

    if (resource === undefined) {
      return "missing";
    }

    if (resource.isDisposed?.() === true) {
      this.markDisposed(id);
      return "disposed";
    }

    if (resource.dispose === undefined) {
      return "unsupported";
    }

    await resource.dispose();
    this.markDisposed(id);
    return "disposed";
  }

  markDisposed(id: string): boolean {
    const resource = this.activeResources.get(id);

    if (resource === undefined) {
      return false;
    }

    resource.status = "disposed";
    resource.disposedAt = Date.now();
    resource.onDispose?.();
    resource.onDispose = undefined;
    resource.dispose = undefined;
    resource.isDisposed = undefined;
    resource.resource = undefined;

    this.activeResources.delete(id);
    this.disposedCount += 1;

    return true;
  }

  matchesIgnoreRules(
    resource: TrackedResource,
    resolveScopePath: (scopeId: string) => string,
    extraRules: readonly IgnoreRule[] = [],
  ): boolean {
    const rules = [...this.ignoreRules, ...extraRules];
    const scopePath =
      resource.scopeId !== undefined
        ? resolveScopePath(resource.scopeId)
        : undefined;

    return rules.some((rule) => {
      if ("kind" in rule) {
        return rule.kind === resource.kind;
      }

      if ("label" in rule) {
        return rule.label === resource.label;
      }

      if ("scope" in rule) {
        return rule.scope === scopePath;
      }

      if ("scopeId" in rule) {
        return rule.scopeId === resource.scopeId;
      }

      return rule.predicate(resource);
    });
  }

  clear(): void {
    this.activeResources.clear();
    this.ignoreRules.length = 0;
    this.disposedCount = 0;
    this.totalTrackedCount = 0;
  }

  private syncActiveResources(): void {
    const toDispose: string[] = [];

    for (const [id, resource] of this.activeResources) {
      if (resource.isDisposed?.() === true) {
        toDispose.push(id);
      }
    }

    for (const id of toDispose) {
      this.markDisposed(id);
    }
  }

  private toTrackedResource(
    resource: RegisteredTrackedResource,
  ): TrackedResource {
    return {
      id: resource.id,
      kind: resource.kind,
      label: resource.label,
      scopeId: resource.scopeId,
      createdAt: resource.createdAt,
      disposedAt: resource.disposedAt,
      status: resource.status,
      expectedDispose: resource.expectedDispose,
      meta: resource.meta,
      stack: resource.stack,
    };
  }
}

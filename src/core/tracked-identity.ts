import { isObjectLike } from "./utils";

const TRACKED_RESOURCE_ID = Symbol.for("scopetrace.resourceId");

export class TrackedIdentity {
  private ids = new WeakMap<object, string>();

  remember(resource: unknown, id: string): void {
    if (!isObjectLike(resource)) {
      return;
    }

    this.ids.set(resource, id);

    try {
      Object.defineProperty(resource, TRACKED_RESOURCE_ID, {
        configurable: true,
        enumerable: false,
        value: id,
      });
    } catch {
      // Ignore non-extensible resources.
    }
  }

  forget(resource: unknown): void {
    if (!isObjectLike(resource)) {
      return;
    }

    this.ids.delete(resource);
  }

  get(resource: unknown): string | undefined {
    if (!isObjectLike(resource)) {
      return undefined;
    }

    return this.ids.get(resource) ?? this.getFromSymbol(resource);
  }

  reset(): void {
    this.ids = new WeakMap<object, string>();
  }

  private getFromSymbol(resource: object): string | undefined {
    const value = (resource as Record<PropertyKey, unknown>)[
      TRACKED_RESOURCE_ID
    ];
    return typeof value === "string" ? value : undefined;
  }
}

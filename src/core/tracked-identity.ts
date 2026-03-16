import { isObjectLike } from "./utils";

export class TrackedIdentity {
  private ids = new WeakMap<object, string>();

  remember(resource: unknown, id: string): void {
    if (!isObjectLike(resource)) {
      return;
    }

    this.ids.set(resource, id);
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

    return this.ids.get(resource);
  }

  reset(): void {
    this.ids = new WeakMap<object, string>();
  }
}

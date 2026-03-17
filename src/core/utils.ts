import { captureNormalizedStack } from "../stack/normalize-stack";

export function captureStack(
  captureStackOption: boolean | undefined,
): string | undefined {
  if (captureStackOption === false) {
    return undefined;
  }

  return captureNormalizedStack(1);
}

export function isObjectLike(value: unknown): value is object {
  return (
    (typeof value === "object" && value !== null) || typeof value === "function"
  );
}

export function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

export function isTimerDisposed(timer: NodeJS.Timeout): boolean {
  return Boolean(
    (timer as NodeJS.Timeout & { _destroyed?: boolean })._destroyed,
  );
}

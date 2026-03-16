export class ScopeTraceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScopeTraceError";
    Error.captureStackTrace?.(this, new.target);
  }
}

export class ScopeTraceDisposeError extends ScopeTraceError {
  constructor(message: string) {
    super(message);
    this.name = "ScopeTraceDisposeError";
  }
}

export class ScopeTraceAssertionError extends ScopeTraceError {
  constructor(message: string) {
    super(message);
    this.name = "ScopeTraceAssertionError";
  }
}

export class ScopeTraceUsageError extends ScopeTraceError {
  constructor(message: string) {
    super(message);
    this.name = "ScopeTraceUsageError";
  }
}

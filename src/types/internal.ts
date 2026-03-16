export type ResourceKind = "timeout" | "interval" | "server" | "disposable";

export type ResourceStatus = "active" | "disposed" | "ignored";

export type ScopeRecord = {
  id: string;
  name: string;
  parentId?: string;
  createdAt: number;
  meta?: Record<string, unknown>;
};

export type TrackedResource = {
  id: string;
  kind: ResourceKind;
  label?: string;
  scopeId?: string;
  createdAt: number;
  disposedAt?: number;
  status: ResourceStatus;
  expectedDispose?: string;
  meta?: Record<string, unknown>;
  stack?: string;
};

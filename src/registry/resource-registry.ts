import type { IgnoreRule } from "../types/public";

/**
 * Phase 1 stub — holds ignore rules only.
 * Full resource tracking added in Phase 2.
 */
export class ResourceRegistry {
  private readonly ignoreRules: IgnoreRule[] = [];

  addIgnoreRule(rule: IgnoreRule): void {
    this.ignoreRules.push(rule);
  }

  getIgnoreRules(): readonly IgnoreRule[] {
    return this.ignoreRules;
  }

  clear(): void {
    this.ignoreRules.length = 0;
  }
}

import { describe, expect, it } from "vitest";
import { isNewerVersion } from "../../src/cli/check-update";

describe("isNewerVersion", () => {
  it("detects newer major", () => {
    expect(isNewerVersion("1.0.0", "0.3.2")).toBe(true);
  });

  it("detects newer minor", () => {
    expect(isNewerVersion("0.4.0", "0.3.2")).toBe(true);
  });

  it("detects newer patch", () => {
    expect(isNewerVersion("0.3.3", "0.3.2")).toBe(true);
  });

  it("returns false for same version", () => {
    expect(isNewerVersion("0.3.2", "0.3.2")).toBe(false);
  });

  it("returns false for older version", () => {
    expect(isNewerVersion("0.3.1", "0.3.2")).toBe(false);
  });

  it("returns false when latest minor is lower", () => {
    expect(isNewerVersion("0.2.9", "0.3.0")).toBe(false);
  });
});

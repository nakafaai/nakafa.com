// @vitest-environment node

import { describe, expect, it } from "vitest";
import { isInternalContentAuthorized } from "@/lib/content/internal/authorization";

describe("internal content authorization", () => {
  it("accepts only the exact bearer token", () => {
    expect(isInternalContentAuthorized("Bearer secret", "secret")).toBe(true);
    expect(isInternalContentAuthorized("Bearer wrong", "secret")).toBe(false);
  });

  it("rejects missing, malformed, and empty authorization", () => {
    expect(isInternalContentAuthorized(null, "secret")).toBe(false);
    expect(isInternalContentAuthorized("Basic secret", "secret")).toBe(false);
    expect(isInternalContentAuthorized("Bearer ", "secret")).toBe(false);
  });
});

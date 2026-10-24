import { describe, expect, it } from "@effect/vitest";
import { isProtectedProduction } from "@repo/backend/content/deployment";

describe("protected production stage", () => {
  it("grants protected content only to the production stage", () => {
    expect(isProtectedProduction("production")).toBe(true);
    expect(isProtectedProduction("preview")).toBe(false);
    expect(isProtectedProduction("")).toBe(false);
    expect(isProtectedProduction(undefined)).toBe(false);
  });
});

import { describe, expect, it } from "@effect/vitest";
import { isProtectedProduction } from "@repo/backend/content/deployment";

describe("protected production stage", () => {
  it("grants protected content only to the production stage", () => {
    expect(isProtectedProduction({ stage: "prod" })).toBe(true);
    expect(isProtectedProduction({ stage: "staging" })).toBe(false);
    expect(isProtectedProduction({ stage: "" })).toBe(false);
    expect(isProtectedProduction({ stage: undefined })).toBe(false);
  });
});

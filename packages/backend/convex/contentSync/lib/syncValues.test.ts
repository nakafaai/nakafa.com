import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { describe, expect, it } from "vitest";

describe("contentSync/lib/syncValues", () => {
  it("matches stored rows against every next sync field", () => {
    const nextValues = {
      contentHash: "hash",
      description: undefined,
      questionCount: 2,
      title: "Title",
    };

    expect(
      hasSameSyncValues(nextValues, {
        contentHash: "hash",
        description: undefined,
        questionCount: 2,
        title: "Title",
      })
    ).toBe(true);
    expect(
      hasSameSyncValues(nextValues, {
        contentHash: "hash",
        description: undefined,
        questionCount: 2,
        title: "Stale title",
      })
    ).toBe(false);
    expect(hasSameSyncValues(nextValues, null)).toBe(false);
  });
});

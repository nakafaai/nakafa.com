import { describe, expect, it } from "@effect/vitest";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";

describe("auth/deletion/state", () => {
  it.each([
    [{}, false],
    [{ deletionPreparedAt: 1 }, true],
    [{ deletedAt: 1 }, true],
  ])("classifies account deletion state", (state, expected) => {
    expect(isAccountDeletionPending(state)).toBe(expected);
  });
});

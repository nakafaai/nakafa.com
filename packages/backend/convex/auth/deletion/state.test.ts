import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { describe, expect, it } from "vitest";

describe("auth/deletion/state", () => {
  it.each([
    [{}, false],
    [{ deletionPreparedAt: 1 }, true],
    [{ deletedAt: 1 }, true],
  ])("classifies account deletion state", (state, expected) => {
    expect(isAccountDeletionPending(state)).toBe(expected);
  });
});

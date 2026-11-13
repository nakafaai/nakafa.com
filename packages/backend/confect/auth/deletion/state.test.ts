import { describe, expect, it } from "@effect/vitest";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";

describe("auth/deletion/state", () => {
  it.each([
    [{}, false],
    [{ deletedAt: 1 }, true],
  ])("treats only a deleted account as quiesced", (state, expected) => {
    expect(isAccountDeletionPending(state)).toBe(expected);
  });
});

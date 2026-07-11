import {
  getLocalizedSourceKey,
  hasLocalizedSourceKey,
} from "@repo/backend/scripts/sync-content/contract/key";
import { describe, expect, it } from "vitest";

describe("localized source keys", () => {
  it("does not let one locale keep another locale's stale path alive", () => {
    const keys = new Set([
      getLocalizedSourceKey("id", "try-out/indonesia/tka/matematika"),
    ]);

    expect(
      hasLocalizedSourceKey(keys, {
        locale: "id",
        sourcePath: "try-out/indonesia/tka/matematika",
      })
    ).toBe(true);
    expect(
      hasLocalizedSourceKey(keys, {
        locale: "en",
        sourcePath: "try-out/indonesia/tka/matematika",
      })
    ).toBe(false);
  });
});

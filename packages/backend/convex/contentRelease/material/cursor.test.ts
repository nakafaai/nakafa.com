import {
  decodeMaterialApiCursor,
  encodeMaterialApiCursor,
} from "@repo/backend/convex/contentRelease/material/cursor";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/material/cursor", () => {
  it.each([
    {
      activeReleaseId: "release-one",
      contentKey: "material/lesson/test/item:one",
      locale: "en",
      prefix: "material/lesson/test",
    },
    {
      activeReleaseId: null,
      contentKey: "material/lesson/test/item-two",
      locale: "id",
      prefix: "",
    },
  ])("round trips one release-bound cursor", async (input) => {
    const encoded = await Effect.runPromise(encodeMaterialApiCursor(input));

    await expect(
      Effect.runPromise(decodeMaterialApiCursor(encoded))
    ).resolves.toEqual(input);
  });

  it("preserves an absent initial cursor", async () => {
    await expect(
      Effect.runPromise(decodeMaterialApiCursor(null))
    ).resolves.toBeNull();
  });

  it.each([
    "legacy/content-key",
    "material-v1:release",
    "material-v1:release:en:material%2Flesson%2Ftest",
    "material-v1:invalid release:en:material%2Flesson:material%2Flesson%2Ftest",
    "material-v1:release-one:de:material%2Flesson:material%2Flesson%2Ftest",
    "material-v1:release-one:en:material%ZZlesson:material%2Flesson%2Ftest",
    "material-v1:release-one:en:material%2Flesson:",
  ])("rejects invalid cursor %s", async (cursor) => {
    await expect(
      Effect.runPromise(decodeMaterialApiCursor(cursor).pipe(Effect.flip))
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });

  it("rejects an invalid cursor produced by a page", async () => {
    await expect(
      Effect.runPromise(
        encodeMaterialApiCursor({
          activeReleaseId: "release-one",
          contentKey: "Invalid Key",
          locale: "en",
          prefix: "material/lesson/test",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});

import {
  decodePartnerCursor,
  encodePartnerCursor,
} from "@repo/backend/convex/contentRelease/partner/cursor";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/partner/cursor", () => {
  it.each([
    {
      activeReleaseId: "release-one",
      contentKey: "articles/politics/item:one",
      family: "article" as const,
      locale: "en",
      prefix: "articles/politics",
    },
    {
      activeReleaseId: "release-two",
      contentKey: "material/lesson/test/item-two",
      family: "material" as const,
      locale: "id",
      prefix: "",
    },
  ])("round trips one release-bound cursor", async (input) => {
    const encoded = await Effect.runPromise(encodePartnerCursor(input));

    await expect(
      Effect.runPromise(decodePartnerCursor(encoded))
    ).resolves.toEqual(input);
  });

  it("preserves an absent initial cursor", async () => {
    await expect(
      Effect.runPromise(decodePartnerCursor(null))
    ).resolves.toBeNull();
  });

  it.each([
    "legacy/content-key",
    "material-v1:release:en:material%2Flesson:material%2Flesson%2Ftest",
    "content:article:release",
    "content:article:release:en:articles%2Fpolitics",
    "content:article::en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:other:release-one:en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:invalid release:en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:de:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:en:articles%ZZpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:en:articles%2Fpolitics:",
  ])("rejects invalid cursor %s", async (cursor) => {
    await expect(
      Effect.runPromise(decodePartnerCursor(cursor).pipe(Effect.flip))
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });

  it("rejects an invalid cursor produced by a page", async () => {
    await expect(
      Effect.runPromise(
        encodePartnerCursor({
          activeReleaseId: "release-one",
          contentKey: "Invalid Key",
          family: "article",
          locale: "en",
          prefix: "articles/politics",
        }).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
  });
});

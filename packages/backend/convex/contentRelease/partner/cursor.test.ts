import { describe, expect, it } from "@effect/vitest";
import {
  decodePartnerCursor,
  encodePartnerCursor,
} from "@repo/backend/convex/contentRelease/partner/cursor";
import { Effect } from "effect";

describe("contentRelease/partner/cursor", () => {
  it.live.each([
    {
      activeReleaseId: "release-one",
      contentKey: "articles/politics/item:one",
      family: "article" as const,
      appLocale: "en",
      prefix: "articles/politics",
    },
    {
      activeReleaseId: "release-two",
      contentKey: "material/lesson/test/item-two",
      family: "material" as const,
      appLocale: "id",
      prefix: "",
    },
  ])("round trips one release-bound cursor", (input) =>
    Effect.gen(function* () {
      const encoded = yield* encodePartnerCursor(input);

      expect(yield* decodePartnerCursor(encoded)).toEqual(input);
    })
  );

  it.live("preserves an absent initial cursor", () =>
    Effect.gen(function* () {
      expect(yield* decodePartnerCursor(null)).toBeNull();
    })
  );

  it.live.each([
    "legacy/content-key",
    "material-v1:release:en:material%2Flesson:material%2Flesson%2Ftest",
    "content:article:release",
    "content:article:release:en:articles%2Fpolitics",
    "content:article::en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:other:release-one:en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:invalid release:en:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:fr:articles%2Fpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:en:articles%ZZpolitics:articles%2Fpolitics%2Fitem",
    "content:article:release-one:en:articles%2Fpolitics:",
  ])("rejects invalid cursor %s", (cursor) =>
    Effect.gen(function* () {
      expect(
        yield* decodePartnerCursor(cursor).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );

  it.live("rejects an invalid cursor produced by a page", () =>
    Effect.gen(function* () {
      expect(
        yield* encodePartnerCursor({
          activeReleaseId: "release-one",
          contentKey: "Invalid Key",
          family: "article",
          appLocale: "en",
          prefix: "articles/politics",
        }).pipe(Effect.flip)
      ).toMatchObject({ code: "CONTENT_RELEASE_INTEGRITY" });
    })
  );
});

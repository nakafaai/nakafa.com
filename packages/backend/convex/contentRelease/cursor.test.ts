import { describe, expect, it } from "@effect/vitest";
import {
  decodePageCursor,
  encodePageCursor,
} from "@repo/backend/convex/contentRelease/cursor";
import { Effect } from "effect";

describe("contentRelease/cursor", () => {
  it.effect("round-trips stable native page cursors", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePageCursor(
          encodePageCursor("category", "blue", "category-position"),
          "category",
          "blue"
        )
      ).toBe("category-position");
      expect(
        yield* decodePageCursor(
          encodePageCursor("material", "green", "material-position"),
          "material",
          "green"
        )
      ).toBe("material-position");
      expect(yield* decodePageCursor(null, "category", "blue")).toBeNull();
    })
  );

  it.effect("rejects malformed and cross-query page cursors", () =>
    Effect.gen(function* () {
      expect(
        yield* decodePageCursor("publication-page:{", "category", "blue").pipe(
          Effect.flip
        )
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
      expect(
        yield* decodePageCursor(
          encodePageCursor("material", "blue", "material-position"),
          "category",
          "blue"
        ).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ReleaseError",
        code: "CONTENT_RELEASE_INTEGRITY",
      });
    })
  );
});

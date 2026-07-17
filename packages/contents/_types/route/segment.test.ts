import {
  PublicRoutePathSchema,
  PublicRouteSegmentSchema,
  PublicRouteSlugMapSchema,
} from "@repo/contents/_types/route/segment";
import { locales } from "@repo/utilities/locales";
import { Either, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("public route segments", () => {
  it("rejects invalid branded public segments and paths", () => {
    const invalidSegment = Schema.decodeUnknownEither(PublicRouteSegmentSchema)(
      "Not A Segment"
    );
    const invalidPath = Schema.decodeUnknownEither(PublicRoutePathSchema)(
      "materi//matematika"
    );

    expect(Either.isLeft(invalidSegment)).toBe(true);
    expect(Either.isLeft(invalidPath)).toBe(true);
    if (Either.isLeft(invalidSegment)) {
      expect(String(invalidSegment.left)).toContain(
        "Invalid public route segment."
      );
    }
    if (Either.isLeft(invalidPath)) {
      expect(String(invalidPath.left)).toContain("Invalid public route path.");
    }
  });

  it("rejects slug maps missing a supported locale", () => {
    const incompleteSlugs = Object.fromEntries(
      locales.slice(1).map((locale) => [locale, "valid-slug"])
    );
    const result = Schema.decodeUnknownEither(PublicRouteSlugMapSchema)(
      incompleteSlugs
    );

    expect(Either.isLeft(result)).toBe(true);
  });
});

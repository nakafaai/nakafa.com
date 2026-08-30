// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  getTryoutTrackCatalogArtwork,
  resolveTryoutExamArtwork,
} from "@/lib/tryout/artwork";

describe("try-out artwork", () => {
  it.live.each(["en", "id", "de"] as const)(
    "uses English-default exam artwork for %s",
    (appLocale) =>
      Effect.gen(function* () {
        for (const examKey of ["snbt", "tka"] as const) {
          const imagePath = `/open-graph/tryout/indonesia/en-${examKey}.png`;

          expect(
            yield* resolveTryoutExamArtwork({
              countryKey: "indonesia",
              examKey,
              appLocale,
              publicPath: `try-out/indonesia/${examKey}`,
            })
          ).toEqual({
            cardImageSrc: imagePath,
            socialImageSrc: imagePath,
          });
        }
      })
  );

  it.live("keeps stable source keys separate from localized slugs", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "snbt",
          appLocale: "de",
          publicPath: "try-out/indonesien/snbt",
        })
      ).toEqual({
        cardImageSrc: "/open-graph/tryout/indonesia/en-snbt.png",
        socialImageSrc: "/open-graph/tryout/indonesia/en-snbt.png",
      });
    })
  );

  it.live("keeps unknown exams on generated social artwork", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "future-exam",
          appLocale: "en",
          publicPath: "try-out/indonesia/future-exam",
        })
      ).toEqual({
        socialImageSrc: "/en/og/try-out/indonesia/future-exam/image.png",
      });
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "germany",
          examKey: "snbt",
          appLocale: "en",
          publicPath: "try-out/germany/snbt",
        })
      ).toEqual({
        socialImageSrc: "/en/og/try-out/germany/snbt/image.png",
      });
    })
  );

  it("scopes 2027 artwork to SNBT Indonesia", () => {
    expect(
      getTryoutTrackCatalogArtwork("de", {
        countryKey: "indonesia",
        examKey: "snbt",
        trackKey: "2027",
        trackKind: "year",
      })
    ).toBe("/open-graph/tryout/indonesia/en-2027.png");
    expect(
      getTryoutTrackCatalogArtwork("en", {
        countryKey: "indonesia",
        examKey: "tka",
        trackKey: "2027",
        trackKind: "year",
      })
    ).toBeUndefined();
  });

  it("uses canonical TKA track keys instead of localized slugs", () => {
    expect(
      getTryoutTrackCatalogArtwork("de", {
        countryKey: "indonesia",
        examKey: "tka",
        trackKey: "mathematics",
        trackKind: "subject",
      })
    ).toBe("/open-graph/subject/de-mathematics.png");
    expect(
      getTryoutTrackCatalogArtwork("id", {
        countryKey: "indonesia",
        examKey: "tka",
        trackKey: "matematika",
        trackKind: "subject",
      })
    ).toBeUndefined();
  });

  it.live.each([
    { appLocale: "en", countryKey: "Indonesia", examKey: "snbt" },
    { appLocale: "en", countryKey: "indonesia", examKey: "TKA" },
  ])(
    "rejects invalid signed identity $countryKey/$examKey/$appLocale",
    (input) =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          resolveTryoutExamArtwork({
            ...input,
            publicPath: "try-out/indonesia/tka",
          })
        );

        expect(error).toMatchObject({
          _tag: "InvalidTryoutExamArtworkIdentityError",
          message: "Invalid try-out exam artwork identity",
        });
      })
  );

  it.live.each([
    "try-out",
    "try-out/indonesien",
    "try-out/indonesien/snbt/2027",
  ])("rejects non-exam public path %s", (publicPath) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "snbt",
          appLocale: "de",
          publicPath,
        })
      );

      expect(error).toMatchObject({
        _tag: "InvalidTryoutExamArtworkIdentityError",
        message: "Invalid try-out exam artwork identity",
      });
    })
  );
});

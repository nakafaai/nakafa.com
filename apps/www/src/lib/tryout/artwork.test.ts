// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  getTryoutCountryCatalogArtwork,
  getTryoutSectionArtwork,
  getTryoutTrackCatalogArtwork,
  resolveTryoutExamArtwork,
} from "@/lib/tryout/artwork";

describe("try-out artwork", () => {
  it.each(["en", "id", "de"] as const)(
    "uses English-default country artwork for %s",
    (appLocale) => {
      expect(
        getTryoutCountryCatalogArtwork(appLocale, {
          countryKey: "indonesia",
        })
      ).toBe("/open-graph/tryout/indonesia/en-index.png");
      expect(
        getTryoutCountryCatalogArtwork(appLocale, {
          countryKey: "germany",
        })
      ).toBe("/open-graph/tryout/germany/en-index.png");
      expect(
        getTryoutCountryCatalogArtwork(appLocale, {
          countryKey: "future-country",
        })
      ).toBeUndefined();
    }
  );
  it.effect.each(["en", "id", "de"] as const)(
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

  it.effect("keeps stable source keys separate from localized slugs", () =>
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

  it.effect("gives an exam's group the artwork of its exam", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "snbt",
          appLocale: "de",
          publicPath: "try-out/indonesien/snbt/2027",
        })
      ).toEqual({
        cardImageSrc: "/open-graph/tryout/indonesia/en-snbt.png",
        socialImageSrc: "/open-graph/tryout/indonesia/en-snbt.png",
      });
    })
  );

  it.effect("answers the home social image for an exam without artwork", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "future-exam",
          appLocale: "en",
          publicPath: "try-out/indonesia/future-exam",
        })
      ).toEqual({
        socialImageSrc: "/en/og/image.png",
      });
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "germany",
          examKey: "snbt",
          appLocale: "en",
          publicPath: "try-out/germany/snbt",
        })
      ).toEqual({
        socialImageSrc: "/en/og/image.png",
      });
    })
  );

  it("scopes 2027 artwork to SNBT Indonesia", () => {
    expect(
      getTryoutTrackCatalogArtwork("de", {
        countryKey: "indonesia",
        examKey: "snbt",
        trackKey: "2027",
      })
    ).toBe("/open-graph/tryout/indonesia/en-2027.png");
    expect(
      getTryoutTrackCatalogArtwork("en", {
        countryKey: "indonesia",
        examKey: "tka",
        trackKey: "2027",
      })
    ).toBeUndefined();
  });

  it.each(["en", "id", "de"] as const)(
    "resolves both TKA language subjects in %s",
    (locale) => {
      for (const trackKey of ["english-language", "indonesian-language"]) {
        expect(
          getTryoutTrackCatalogArtwork(locale, {
            countryKey: "indonesia",
            examKey: "tka",
            trackKey,
          })
        ).toBe(`/open-graph/tryout/indonesia/tka/${locale}-${trackKey}.png`);
        expect(
          getTryoutTrackCatalogArtwork(locale, {
            countryKey: "indonesia",
            examKey: "snbt",
            trackKey,
          })
        ).toBeUndefined();
      }
    }
  );

  it.each(["en", "id", "de"] as const)(
    "resolves both TKA Mathematics subjects from their canonical keys in %s",
    (locale) => {
      for (const trackKey of [
        "advanced-mathematics",
        "compulsory-mathematics",
      ]) {
        expect(
          getTryoutTrackCatalogArtwork(locale, {
            countryKey: "indonesia",
            examKey: "tka",
            trackKey,
          })
        ).toBe(`/open-graph/tryout/indonesia/tka/${locale}-${trackKey}.png`);
      }
      for (const trackKey of [
        "mathematics",
        "matematika-wajib",
        "pflichtmathematik",
      ]) {
        expect(
          getTryoutTrackCatalogArtwork(locale, {
            countryKey: "indonesia",
            examKey: "tka",
            trackKey,
          })
        ).toBeUndefined();
      }
    }
  );

  it.each(["en", "id", "de"] as const)(
    "shares the Mathematics subject design with Germany's Darmstadt Mathematics, and only there, in %s",
    (locale) => {
      expect(
        getTryoutTrackCatalogArtwork(locale, {
          countryKey: "germany",
          examKey: "entrance-examination",
          trackKey: "tu-darmstadt-mathematics",
        })
      ).toBe(`/open-graph/subject/${locale}-mathematics.png`);
      expect(
        getTryoutTrackCatalogArtwork(locale, {
          countryKey: "germany",
          examKey: "assessment-examination",
          trackKey: "tu-darmstadt-mathematics",
        })
      ).toBeUndefined();
    }
  );

  it.each(["en", "id", "de"] as const)(
    "resolves the reviewed artwork of the three SNBT sections that have one in %s",
    (locale) => {
      for (const sectionKey of [
        "general-reasoning",
        "mathematical-reasoning",
        "quantitative-knowledge",
      ]) {
        expect(
          getTryoutSectionArtwork(locale, {
            countryKey: "indonesia",
            examKey: "snbt",
            sectionKey,
          })
        ).toBe(`/open-graph/tryout/indonesia/snbt/${locale}-${sectionKey}.png`);
        expect(
          getTryoutSectionArtwork(locale, {
            countryKey: "indonesia",
            examKey: "tka",
            sectionKey,
          })
        ).toBeUndefined();
      }
      expect(
        getTryoutSectionArtwork(locale, {
          countryKey: "indonesia",
          examKey: "snbt",
          sectionKey: "literacy-in-english",
        })
      ).toBeUndefined();
    }
  );

  it.effect.each([
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

  it.effect.each([
    "try-out",
    "try-out/indonesien",
    "try-out/indonesien/snbt/2027/utbk",
  ])("rejects a public path that is no exam or group %s", (publicPath) =>
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

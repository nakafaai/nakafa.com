// @vitest-environment node

import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { resolveTryoutExamArtwork } from "@/lib/tryout/artwork";

const reviewedTryoutExamArtworkFixtures = [
  {
    countryKey: "indonesia",
    examKey: "snbt",
    imagePath: "/open-graph/tryout/indonesia/en-snbt.png",
    appLocale: "en",
  },
  {
    countryKey: "indonesia",
    examKey: "tka",
    imagePath: "/open-graph/tryout/indonesia/en-tka.png",
    appLocale: "en",
  },
  {
    countryKey: "indonesia",
    examKey: "snbt",
    imagePath: "/open-graph/tryout/indonesia/id-snbt.png",
    appLocale: "id",
  },
  {
    countryKey: "indonesia",
    examKey: "tka",
    imagePath: "/open-graph/tryout/indonesia/id-tka.png",
    appLocale: "id",
  },
];

describe("try-out exam artwork", () => {
  it.live("resolves every reviewed exam artwork to an existing asset", () =>
    Effect.gen(function* () {
      for (const {
        countryKey,
        examKey,
        imagePath,
        appLocale,
      } of reviewedTryoutExamArtworkFixtures) {
        const artwork = yield* resolveTryoutExamArtwork({
          countryKey,
          examKey,
          appLocale,
          publicPath: `try-out/${countryKey}/${examKey}`,
        });

        expect(artwork).toEqual({
          cardImageSrc: imagePath,
          socialImageSrc: imagePath,
        });
        yield* Effect.promise(() =>
          expect(
            access(join(process.cwd(), "public", imagePath.slice(1)))
          ).resolves.toBeUndefined()
        );
      }
    })
  );

  it.live(
    "keeps future exams on card gradients and generated social images",
    () =>
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
      })
  );

  it.live("keeps German cards on gradients and social metadata localized", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "tka",
          appLocale: "de",
          publicPath: "try-out/indonesien/tka",
        })
      ).toEqual({
        socialImageSrc: "/de/og/try-out/indonesien/tka/image.png",
      });
    })
  );

  it.live("keeps stable source keys separate from localized route slugs", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamArtwork({
          countryKey: "indonesia",
          examKey: "snbt",
          appLocale: "de",
          publicPath: "try-out/indonesien/snbt",
        })
      ).toEqual({
        socialImageSrc: "/de/og/try-out/indonesien/snbt/image.png",
      });
    })
  );

  it.live(
    "keeps generated images for the same exam key outside Indonesia",
    () =>
      Effect.gen(function* () {
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

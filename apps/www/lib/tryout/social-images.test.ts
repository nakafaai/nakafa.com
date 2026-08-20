// @vitest-environment node

import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { resolveTryoutExamSocialImage } from "@/lib/tryout/social-images";

const reviewedTryoutSocialImageFixtures = [
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

describe("try-out social images", () => {
  it.live("resolves every reviewed exam artwork to an existing asset", () =>
    Effect.gen(function* () {
      for (const {
        countryKey,
        examKey,
        imagePath,
        appLocale,
      } of reviewedTryoutSocialImageFixtures) {
        const resolvedPath = yield* resolveTryoutExamSocialImage({
          countryKey,
          examKey,
          appLocale,
          publicPath: `try-out/${countryKey}/${examKey}`,
        });

        expect(resolvedPath).toBe(imagePath);
        yield* Effect.promise(() =>
          expect(
            access(join(process.cwd(), "public", resolvedPath.slice(1)))
          ).resolves.toBeUndefined()
        );
      }
    })
  );

  it.live("keeps generated images for future valid exams", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamSocialImage({
          countryKey: "indonesia",
          examKey: "future-exam",
          appLocale: "en",
          publicPath: "try-out/indonesia/future-exam",
        })
      ).toBe("/en/og/try-out/indonesia/future-exam/image.png");
    })
  );

  it.live("keeps generated images for German signed routes", () =>
    Effect.gen(function* () {
      expect(
        yield* resolveTryoutExamSocialImage({
          countryKey: "indonesia",
          examKey: "tka",
          appLocale: "de",
          publicPath: "try-out/indonesia/tka",
        })
      ).toBe("/de/og/try-out/indonesia/tka/image.png");
    })
  );

  it.live(
    "keeps generated images for the same exam key outside Indonesia",
    () =>
      Effect.gen(function* () {
        expect(
          yield* resolveTryoutExamSocialImage({
            countryKey: "germany",
            examKey: "snbt",
            appLocale: "en",
            publicPath: "try-out/germany/snbt",
          })
        ).toBe("/en/og/try-out/germany/snbt/image.png");
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
          resolveTryoutExamSocialImage({
            ...input,
            publicPath: "try-out/indonesia/tka",
          })
        );

        expect(error).toMatchObject({
          _tag: "InvalidTryoutSocialImageIdentityError",
          message: "Invalid try-out social image identity",
        });
      })
  );

  it.live(
    "rejects a valid identity whose public path belongs to another exam",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          resolveTryoutExamSocialImage({
            countryKey: "indonesia",
            examKey: "tka",
            appLocale: "id",
            publicPath: "try-out/indonesia/snbt",
          })
        );

        expect(error).toMatchObject({
          _tag: "TryoutSocialImageIdentityMismatchError",
          actualPublicPath: "try-out/indonesia/snbt",
          expectedPublicPath: "try-out/indonesia/tka",
          message:
            "Try-out social image identity does not match its public path",
        });
      })
  );
});

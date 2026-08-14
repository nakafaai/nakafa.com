// @vitest-environment node

import { access } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
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
  it("resolves every reviewed exam artwork to an existing asset", async () => {
    for (const {
      countryKey,
      examKey,
      imagePath,
      appLocale,
    } of reviewedTryoutSocialImageFixtures) {
      const resolvedPath = await Effect.runPromise(
        resolveTryoutExamSocialImage({
          countryKey,
          examKey,
          appLocale,
          publicPath: `try-out/${countryKey}/${examKey}`,
        })
      );

      expect(resolvedPath).toBe(imagePath);
      await expect(
        access(join(process.cwd(), "public", resolvedPath.slice(1)))
      ).resolves.toBeUndefined();
    }
  });

  it("keeps generated images for future valid exams", async () => {
    expect(
      await Effect.runPromise(
        resolveTryoutExamSocialImage({
          countryKey: "indonesia",
          examKey: "future-exam",
          appLocale: "en",
          publicPath: "try-out/indonesia/future-exam",
        })
      )
    ).toBe("/en/og/try-out/indonesia/future-exam/image.png");
  });

  it("keeps generated images for the same exam key outside Indonesia", async () => {
    expect(
      await Effect.runPromise(
        resolveTryoutExamSocialImage({
          countryKey: "germany",
          examKey: "snbt",
          appLocale: "en",
          publicPath: "try-out/germany/snbt",
        })
      )
    ).toBe("/en/og/try-out/germany/snbt/image.png");
  });

  it.each([
    { appLocale: "en", countryKey: "Indonesia", examKey: "snbt" },
    { appLocale: "en", countryKey: "indonesia", examKey: "TKA" },
    { appLocale: "de", countryKey: "indonesia", examKey: "tka" },
  ])(
    "rejects invalid signed identity $countryKey/$examKey/$appLocale",
    async (input) => {
      const error = await Effect.runPromise(
        Effect.flip(
          resolveTryoutExamSocialImage({
            ...input,
            publicPath: "try-out/indonesia/tka",
          })
        )
      );

      expect(error).toMatchObject({
        _tag: "InvalidTryoutSocialImageIdentityError",
        message: "Invalid try-out social image identity",
      });
    }
  );

  it("rejects a valid identity whose public path belongs to another exam", async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        resolveTryoutExamSocialImage({
          countryKey: "indonesia",
          examKey: "tka",
          appLocale: "id",
          publicPath: "try-out/indonesia/snbt",
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "TryoutSocialImageIdentityMismatchError",
      actualPublicPath: "try-out/indonesia/snbt",
      expectedPublicPath: "try-out/indonesia/tka",
      message: "Try-out social image identity does not match its public path",
    });
  });
});

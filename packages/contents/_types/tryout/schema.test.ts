import {
  defineTryoutExamSource,
  TryoutExamSourceSchema,
} from "@repo/contents/_types/tryout/schema";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

const validTryoutSource = {
  countryKey: "indonesia",
  countryRouteSlugs: { en: "indonesia", id: "indonesia" },
  countryTranslations: {
    en: { title: "Indonesia" },
    id: { title: "Indonesia" },
  },
  examKey: "snbt",
  examRouteSlugs: { en: "snbt", id: "snbt" },
  examTranslations: {
    en: { title: "SNBT" },
    id: { title: "SNBT" },
  },
  scoringStrategy: "irt",
  sets: [
    {
      key: "set-1",
      order: 1,
      routeSlugs: { en: "set-1", id: "set-1" },
      sections: [
        {
          key: "general-reasoning",
          order: 1,
          questionCount: 20,
          questionSourcePath:
            "question-bank/tryout/indonesia/snbt/general-reasoning/set-1",
          routeSlugs: { en: "general-reasoning", id: "penalaran-umum" },
          translations: {
            en: { title: "General Reasoning" },
            id: { title: "Penalaran Umum" },
          },
        },
      ],
      translations: {
        en: { title: "Set 1" },
        id: { title: "Set 1" },
      },
    },
  ],
  sourceRevision: "2026-07-05",
} as const;

describe("tryout/schema", () => {
  it("decodes authored try-out exam sources", () => {
    expect(defineTryoutExamSource(validTryoutSource)).toMatchObject({
      countryKey: "indonesia",
      examKey: "snbt",
      scoringStrategy: "irt",
    });
  });

  it("rejects invalid keys and question-bank source paths", () => {
    const invalidKey = Schema.decodeUnknownEither(TryoutExamSourceSchema)({
      ...validTryoutSource,
      examKey: "SNBT",
    });
    const invalidSourcePath = Schema.decodeUnknownEither(
      TryoutExamSourceSchema
    )({
      ...validTryoutSource,
      sets: [
        {
          ...validTryoutSource.sets[0],
          sections: [
            {
              ...validTryoutSource.sets[0].sections[0],
              questionSourcePath:
                "tryout/indonesia/snbt/general-reasoning/set-1",
            },
          ],
        },
      ],
    });

    expect(Either.isLeft(invalidKey)).toBe(true);
    expect(Either.isLeft(invalidSourcePath)).toBe(true);

    if (Either.isLeft(invalidKey)) {
      expect(
        ParseResult.TreeFormatter.formatErrorSync(invalidKey.left)
      ).toContain("Invalid try-out key.");
    }
    if (Either.isLeft(invalidSourcePath)) {
      expect(
        ParseResult.TreeFormatter.formatErrorSync(invalidSourcePath.left)
      ).toContain("Invalid try-out question source path.");
    }
  });
});

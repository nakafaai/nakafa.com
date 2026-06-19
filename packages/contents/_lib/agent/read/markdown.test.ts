import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { readNakafaContentRefFixture } from "@repo/contents/_lib/agent/fixture";
import {
  decodeNakafaAgentMarkdown,
  getNakafaAgentMarkdown,
} from "@repo/contents/_lib/agent/read/markdown";
import { DateOnlySchema } from "@repo/contents/_shared/date";
import { Effect, Option, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";

const ARTICLE_CONTENT_REF =
  "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values";
const EXERCISE_CONTENT_REF =
  "https://nakafa.com/en/practice/snbt/general-knowledge/tryout-2026/set-2";
const FIXTURE_DATE = Schema.decodeSync(DateOnlySchema)("2026-01-01");

vi.mock("@repo/contents/_lib/metadata", async () => {
  const { Effect } = await import("effect");

  return {
    getContentMetadataWithRaw: (_locale: string, route: string) => {
      if (route === "articles/politics/missing") {
        return Effect.fail(new Error("Missing content."));
      }

      return Effect.succeed({
        metadata: {
          authors: [{ name: "Nakafa" }],
          date: "2026-01-01",
          description: "Article description",
          title: "Article",
        },
        raw: "## Article body",
      });
    },
  };
});

vi.mock("@repo/contents/_lib/agent/exercise/read", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentExercise: (contentId: string) => {
      if (!contentId.startsWith("https://nakafa.com/")) {
        return Effect.succeed(Option.none());
      }

      if (contentId.includes("set-404")) {
        return Effect.succeed(Option.none());
      }

      return Effect.succeed(
        Option.some({
          count: 1,
          exercises: [
            {
              answer: {
                raw: "Answer body",
                title: "Answer",
              },
              choices: [
                { correct: true, label: "A" },
                { correct: false, label: "B" },
              ],
              number: 1,
              question: {
                raw: "Question body",
                title: "Question",
              },
            },
          ],
          route:
            "material/practice/assessment/snbt/general-knowledge/try-out-2026/set-2",
        })
      );
    },
  };
});

vi.mock("@repo/contents/_lib/quran", async () => {
  const { Effect } = await import("effect");

  return {
    getSurah: (surah: number) => {
      if (surah !== 1) {
        return Effect.fail(new Error("Missing surah."));
      }

      return Effect.succeed({
        number: 1,
        numberOfVerses: 1,
      });
    },
  };
});

vi.mock("@repo/contents/_lib/agent/quran/read", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentQuranReference: () =>
      Effect.succeed(
        Option.some({
          name: "Al-Fatihah",
          revelation: "Mecca",
          translation: "The Opening",
          verses: [
            {
              arabic: "Arabic verse",
              number: 1,
              translation: "In the name of Allah.",
              transliteration: "Bismillah.",
            },
          ],
        })
      ),
  };
});

describe("Nakafa agent markdown", () => {
  it("retrieves markdown for MDX, exercise, and Quran content", async () => {
    const mdxContent = await Effect.runPromise(
      getNakafaAgentMarkdown(ARTICLE_CONTENT_REF)
    );
    const exerciseContent = await Effect.runPromise(
      getNakafaAgentMarkdown(EXERCISE_CONTENT_REF)
    );
    const quranContent = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/1")
    );
    const missingContent = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/articles/politics/missing")
    );
    const invalidContent = await Effect.runPromise(
      getNakafaAgentMarkdown("https://example.com/en/quran/1")
    );
    const missingExercise = await Effect.runPromise(
      getNakafaAgentMarkdown(
        "https://nakafa.com/en/practice/snbt/general-knowledge/tryout-2026/set-404"
      )
    );
    const missingSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/999")
    );
    const malformedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran")
    );
    const partialSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/1foo")
    );
    const nestedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/1/extra")
    );
    const zeroPaddedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/01")
    );
    const alphabeticSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/abc")
    );

    expect(Option.getOrUndefined(mdxContent)?.text).not.toContain(
      "Source URL:"
    );
    expect(Option.getOrUndefined(mdxContent)?.text).not.toContain(
      "Markdown URL:"
    );
    expect(Option.getOrUndefined(exerciseContent)?.text).toContain(
      "### Choices"
    );
    expect(Option.getOrUndefined(quranContent)?.text).toContain("## Verses");
    expect(Option.isNone(missingContent)).toBe(true);
    expect(Option.isNone(invalidContent)).toBe(true);
    expect(Option.isNone(missingExercise)).toBe(true);
    expect(Option.isNone(missingSurah)).toBe(true);
    expect(Option.isNone(malformedSurah)).toBe(true);
    expect(Option.isNone(partialSurah)).toBe(true);
    expect(Option.isNone(nestedSurah)).toBe(true);
    expect(Option.isNone(zeroPaddedSurah)).toBe(true);
    expect(Option.isNone(alphabeticSurah)).toBe(true);
  });

  it("returns none when a projected practice route has no exercise payload", async () => {
    const missingExercise = await Effect.runPromise(
      getNakafaAgentMarkdown(EXERCISE_CONTENT_REF, {
        readExercise: () => Effect.succeed(Option.none()),
      })
    );

    expect(Option.isNone(missingExercise)).toBe(true);
  });

  it("uses subject metadata when description metadata is absent", async () => {
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown(
        "https://nakafa.com/en/articles/learning/variable",
        {
          loadContent: () =>
            Effect.succeed({
              metadata: {
                authors: [{ name: "Nakafa" }],
                date: FIXTURE_DATE,
                subject: "Fallback Subject",
                title: "Subject Fallback",
              },
              raw: "## Subject body",
            }),
        }
      )
    );

    if (Option.isNone(content)) {
      throw new Error("Expected subject markdown to exist.");
    }

    expect(content.value.description).toBe("Fallback Subject");
  });

  it("uses an empty markdown description when metadata has no description or subject", async () => {
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown(
        "https://nakafa.com/en/articles/politics/no-description",
        {
          loadContent: () =>
            Effect.succeed({
              metadata: {
                authors: [{ name: "Nakafa" }],
                date: FIXTURE_DATE,
                title: "No Description",
              },
              raw: "## Body",
            }),
        }
      )
    );

    if (Option.isNone(content)) {
      throw new Error("Expected article markdown to exist.");
    }

    expect(content.value.description).toBe("");
  });

  it("returns none when a Quran reference cannot be built for an existing Surah", async () => {
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/1", {
        readQuran: () => Effect.succeed(Option.none()),
      })
    );

    expect(Option.isNone(content)).toBe(true);
  });

  it("fails with a typed read error when the markdown schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(
        decodeNakafaAgentMarkdown({
          ...readNakafaContentRefFixture(
            "en",
            "articles/politics/dynastic-politics-asian-values",
            "articles"
          ),
          description: 1,
          text: "## Body",
          title: "Invalid Markdown",
        }),
        {
          onFailure: (failure) => failure,
          onSuccess: () => null,
        }
      )
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
  });
});

import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import {
  decodeNakafaAgentMarkdown,
  getNakafaAgentMarkdown,
} from "@repo/contents/_lib/agent/read/markdown";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { Effect, Option } from "effect";
import { describe, expect, it } from "vitest";

const ARTICLE_CONTENT_ID =
  "en/articles/politics/dynastic-politics-asian-values";
const EXERCISE_CONTENT_ID =
  "en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2";

describe("Nakafa agent markdown", () => {
  it("retrieves markdown for MDX, exercise, and Quran content", async () => {
    const mdxContent = await Effect.runPromise(
      getNakafaAgentMarkdown(ARTICLE_CONTENT_ID)
    );
    const exerciseContent = await Effect.runPromise(
      getNakafaAgentMarkdown(EXERCISE_CONTENT_ID)
    );
    const quranContent = await Effect.runPromise(
      getNakafaAgentMarkdown("https://nakafa.com/en/quran/1")
    );
    const missingContent = await Effect.runPromise(
      getNakafaAgentMarkdown("en/articles/missing")
    );
    const invalidContent = await Effect.runPromise(
      getNakafaAgentMarkdown("https://example.com/en/quran/1")
    );
    const missingExercise = await Effect.runPromise(
      getNakafaAgentMarkdown("en/exercises/high-school/snbt/missing/set-1")
    );
    const missingSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/999")
    );
    const malformedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran")
    );
    const partialSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/1foo")
    );
    const nestedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/1/extra")
    );
    const zeroPaddedSurah = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/01")
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
  });

  it("uses subject metadata when description metadata is absent", async () => {
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown(
        "en/subject/university/bachelor/ai-ds/ai-programming/variable",
        {
          loadContent: () =>
            Effect.succeed({
              metadata: {
                authors: [{ name: "Nakafa" }],
                date: "01/01/2026",
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
      getNakafaAgentMarkdown("en/articles/no-description", {
        loadContent: () =>
          Effect.succeed({
            metadata: {
              authors: [{ name: "Nakafa" }],
              date: "01/01/2026",
              title: "No Description",
            },
            raw: "## Body",
          }),
      })
    );

    if (Option.isNone(content)) {
      throw new Error("Expected article markdown to exist.");
    }

    expect(content.value.description).toBe("");
  });

  it("returns none when a Quran reference cannot be built for an existing Surah", async () => {
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/1", {
        readQuran: () => Effect.succeed(Option.none()),
      })
    );

    expect(Option.isNone(content)).toBe(true);
  });

  it("fails with a typed read error when the markdown schema rejects output", async () => {
    const error = await Effect.runPromise(
      Effect.match(
        decodeNakafaAgentMarkdown({
          ...buildNakafaContentRef(
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

import { getNakafaAgentMarkdown } from "@repo/contents/_lib/agent/read/markdown";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

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
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/metadata", () => ({
      getContentMetadataWithRaw: () =>
        Effect.succeed({
          metadata: {
            authors: [{ name: "Nakafa" }],
            date: "01/01/2026",
            subject: "Fallback Subject",
            title: "Subject Fallback",
          },
          raw: "## Subject body",
        }),
    }));

    const { getNakafaAgentMarkdown } = await import(
      "@repo/contents/_lib/agent/read/markdown"
    );
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown(
        "en/subject/university/bachelor/ai-ds/ai-programming/variable"
      )
    );

    if (Option.isNone(content)) {
      throw new Error("Expected subject markdown to exist.");
    }

    expect(content.value.description).toBe("Fallback Subject");
    vi.doUnmock("@repo/contents/_lib/metadata");
    vi.resetModules();
  });

  it("uses an empty markdown description when metadata has no description or subject", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/metadata", () => ({
      getContentMetadataWithRaw: () =>
        Effect.succeed({
          metadata: {
            authors: [{ name: "Nakafa" }],
            date: "01/01/2026",
            title: "No Description",
          },
          raw: "## Body",
        }),
    }));

    const { getNakafaAgentMarkdown } = await import(
      "@repo/contents/_lib/agent/read/markdown"
    );
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown("en/articles/no-description")
    );

    if (Option.isNone(content)) {
      throw new Error("Expected article markdown to exist.");
    }

    expect(content.value.description).toBe("");
    vi.doUnmock("@repo/contents/_lib/metadata");
    vi.resetModules();
  });

  it("returns none when a Quran reference cannot be built for an existing Surah", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/quran/read", () => ({
      getNakafaAgentQuranReference: () => Effect.succeed(Option.none()),
    }));

    const { getNakafaAgentMarkdown } = await import(
      "@repo/contents/_lib/agent/read/markdown"
    );
    const content = await Effect.runPromise(
      getNakafaAgentMarkdown("en/quran/1")
    );

    expect(Option.isNone(content)).toBe(true);
    vi.doUnmock("@repo/contents/_lib/agent/quran/read");
    vi.resetModules();
  });

  it("fails with a typed read error when the markdown schema rejects output", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/schema/read", async () => {
      const actual = await vi.importActual<
        typeof import("@repo/contents/_lib/agent/schema/read")
      >("@repo/contents/_lib/agent/schema/read");
      const { Schema } = await import("effect");

      return {
        ...actual,
        NakafaAgentMarkdownSchema: Schema.Struct({
          impossible: Schema.String,
        }),
      };
    });

    const { NakafaAgentDataReadError } = await import(
      "@repo/contents/_lib/agent/errors"
    );
    const { getNakafaAgentMarkdown } = await import(
      "@repo/contents/_lib/agent/read/markdown"
    );
    const error = await Effect.runPromise(
      Effect.match(getNakafaAgentMarkdown(ARTICLE_CONTENT_ID), {
        onFailure: (failure) => failure,
        onSuccess: () => null,
      })
    );

    expect(error).toBeInstanceOf(NakafaAgentDataReadError);
    vi.doUnmock("@repo/contents/_lib/agent/schema/read");
    vi.resetModules();
  });
});

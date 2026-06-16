import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Nakafa, verifyNakafaContent } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const ARTICLE_CONTENT_REF =
  "https://nakafa.com/en/articles/politics/dynastic-politics-asian-values";
const EXERCISE_CONTENT_REF =
  "https://nakafa.com/en/material/practice/assessment/snbt/general-knowledge/try-out-2026/set-2";

vi.mock("@repo/contents/_lib/agent/taxonomy/read", async () => {
  const { Effect } = await import("effect");

  return {
    getNakafaAgentTaxonomy: () =>
      Effect.succeed({
        sections: ["articles"],
      }),
  };
});

vi.mock("@repo/contents/_lib/agent/read/markdown", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentMarkdown: (contentRef: string) => {
      if (contentRef.includes("/missing") || contentRef.includes("set-404")) {
        return Effect.succeed(Option.none());
      }

      return Effect.succeed(Option.some({ contentRef }));
    },
  };
});

vi.mock("@repo/contents/_lib/agent/exercise/read", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentExercise: (contentRef: string) => {
      if (contentRef.includes("set-404")) {
        return Effect.succeed(Option.none());
      }

      return Effect.succeed(Option.some({ contentRef }));
    },
  };
});

vi.mock("@repo/contents/_lib/agent/quran/read", async () => {
  const { Effect, Option } = await import("effect");

  return {
    getNakafaAgentQuranReference: () =>
      Effect.succeed(Option.some({ name: "Al-Fatihah" })),
  };
});

vi.mock("@repo/contents/_lib/quran", async () => {
  const { Effect } = await import("effect");

  return {
    getSurah: () => Effect.succeed({ number: 1, numberOfVerses: 1 }),
  };
});

describe("Nakafa service", () => {
  it("exposes the shared read, exercise, Quran, taxonomy, and verify contract", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const read = yield* Nakafa.read(ARTICLE_CONTENT_REF);
        const exercise = yield* Nakafa.exercise(EXERCISE_CONTENT_REF);
        const quran = yield* Nakafa.quran({
          from_verse: 1,
          locale: "en",
          surah: 1,
          to_verse: 1,
        });
        const taxonomy = yield* Nakafa.taxonomy("en");
        const validPage = yield* Nakafa.verify(ARTICLE_CONTENT_REF);
        const validExerciseSet = yield* Nakafa.verify(EXERCISE_CONTENT_REF);
        const validExercise = yield* Nakafa.verify(`${EXERCISE_CONTENT_REF}/1`);
        const validQuran = yield* Nakafa.verify(
          "https://nakafa.com/en/quran/1"
        );
        const invalidExercise = yield* Nakafa.verify(
          "https://nakafa.com/en/material/practice/assessment/snbt/general-knowledge/try-out-2026/set-404"
        );
        const invalidPage = yield* Nakafa.verify(
          "https://nakafa.com/en/articles/politics/missing"
        );

        return {
          exercise,
          invalidPage,
          quran,
          read,
          taxonomy,
          invalidExercise,
          validExercise,
          validExerciseSet,
          validPage,
          validQuran,
        };
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(Option.isSome(result.read)).toBe(true);
    expect(Option.isSome(result.exercise)).toBe(true);
    expect(Option.isSome(result.quran)).toBe(true);
    expect(result.taxonomy.sections).toContain("articles");
    expect(result.validPage).toBe(true);
    expect(result.validExerciseSet).toBe(true);
    expect(result.validExercise).toBe(true);
    expect(result.validQuran).toBe(true);
    expect(result.invalidExercise).toBe(false);
    expect(result.invalidPage).toBe(false);
  });

  it("rejects malformed Quran and external verification references", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const nestedQuran = yield* Nakafa.verify(
          "https://nakafa.com/en/quran/1/extra"
        );
        const paddedQuran = yield* Nakafa.verify(
          "https://nakafa.com/en/quran/01"
        );
        const alphabeticQuran = yield* Nakafa.verify(
          "https://nakafa.com/en/quran/abc"
        );
        const external = yield* Nakafa.verify("https://example.com/en/quran/1");

        return { alphabeticQuran, external, nestedQuran, paddedQuran };
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(result).toStrictEqual({
      alphabeticQuran: false,
      external: false,
      nestedQuran: false,
      paddedQuran: false,
    });
  });

  it("returns false when exercise verification cannot read the set", async () => {
    const verified = await Effect.runPromise(
      verifyNakafaContent(EXERCISE_CONTENT_REF, () =>
        Effect.fail(
          new NakafaAgentDataReadError({
            cause: "broken",
            message: "Unable to build Nakafa agent markdown.",
          })
        )
      )
    );

    expect(verified).toBe(false);
  });
});

import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

const ARTICLE_CONTENT_ID =
  "en/articles/politics/dynastic-politics-asian-values";
const EXERCISE_CONTENT_ID =
  "en/exercises/high-school/snbt/general-knowledge/try-out/2026/set-2";

describe("Nakafa service", () => {
  it("exposes the shared search, read, exercise, Quran, taxonomy, and verify contract", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const search = yield* Nakafa.search({
          limit: 1,
          locale: "en",
          query: "dynastic",
          section: "articles",
        });
        const read = yield* Nakafa.read(ARTICLE_CONTENT_ID);
        const exercise = yield* Nakafa.exercise(EXERCISE_CONTENT_ID);
        const quran = yield* Nakafa.quran({
          from_verse: 1,
          locale: "en",
          surah: 1,
          to_verse: 1,
        });
        const taxonomy = yield* Nakafa.taxonomy("en");
        const validPage = yield* Nakafa.verify(ARTICLE_CONTENT_ID);
        const validExerciseSet = yield* Nakafa.verify(EXERCISE_CONTENT_ID);
        const validExercise = yield* Nakafa.verify(`${EXERCISE_CONTENT_ID}/1`);
        const validQuran = yield* Nakafa.verify(
          "https://nakafa.com/en/quran/1"
        );
        const invalidExercise = yield* Nakafa.verify(
          "en/exercises/high-school/snbt/missing/set-1"
        );
        const invalidPage = yield* Nakafa.verify("en/articles/missing");

        return {
          exercise,
          invalidPage,
          quran,
          read,
          search,
          taxonomy,
          invalidExercise,
          validExercise,
          validExerciseSet,
          validPage,
          validQuran,
        };
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(result.search.items).toHaveLength(1);
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
        const nestedQuran = yield* Nakafa.verify("en/quran/1/extra");
        const paddedQuran = yield* Nakafa.verify("en/quran/01");
        const external = yield* Nakafa.verify("https://example.com/en/quran/1");

        return { external, nestedQuran, paddedQuran };
      }).pipe(Effect.provide(Nakafa.Default))
    );

    expect(result).toStrictEqual({
      external: false,
      nestedQuran: false,
      paddedQuran: false,
    });
  });

  it("returns false when exercise verification cannot read the set", async () => {
    vi.resetModules();
    vi.doMock("@repo/contents/_lib/agent/exercises", () => ({
      getNakafaAgentExercise: () => Effect.fail(new Error("broken")),
    }));

    const { Nakafa } = await import("@repo/contents/_lib/agent/service");
    const verified = await Effect.runPromise(
      Nakafa.verify(EXERCISE_CONTENT_ID).pipe(Effect.provide(Nakafa.Default))
    );

    expect(verified).toBe(false);
    vi.doUnmock("@repo/contents/_lib/agent/exercises");
    vi.resetModules();
  });
});

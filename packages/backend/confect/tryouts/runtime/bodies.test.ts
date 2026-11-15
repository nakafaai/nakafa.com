import { assert, describe, expect, it } from "@effect/vitest";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { readSectionBodies } from "@repo/backend/confect/tryouts/runtime/bodies";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Array as Arr, Effect, Schema } from "effect";

describe("tryouts/runtime/readSectionBodies", () => {
  it.effect(
    "reads each question once in every language of its section, with the key and each version's explanation in a review",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld({ languages: ["ms", "en"] });
        const { attemptId } = yield* world.start();
        const content = yield* world.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("tryoutAttemptPlacements")
              .index(
                "by_tryoutAttemptId_and_sectionKey_and_questionOrder",
                (query) =>
                  query
                    .eq("tryoutAttemptId", attemptId)
                    .eq("sectionKey", "section-a")
              )
              .collect()
              .pipe(
                Effect.orDie,
                Effect.flatMap((placements) =>
                  readSectionBodies({
                    access: { answers: true, preview: false },
                    appLocale: "en",
                    placements,
                  })
                )
              )
          )
        );
        expect(
          Arr.map(content, ({ versions }) =>
            Arr.map(versions, ({ language }) => language)
          )
        ).toEqual([
          ["ms", "en"],
          ["ms", "en"],
        ]);
        const [first] = content;
        assert(first);
        const [malay, english] = yield* Effect.forEach(
          first.versions,
          ({ body }) => Schema.decodeEffect(TryoutQuestionBodyText)(body)
        );
        assert(malay && english);
        const encodeText = Schema.encodeEffect(
          Schema.fromJsonString(Schema.Unknown)
        );
        expect(yield* encodeText(malay.prompt)).toContain("(ms)");
        expect(yield* encodeText(english.prompt)).toContain("(en)");
        expect(english.key).toEqual(malay.key);
        expect(english.explanation).toBeDefined();
      })
  );
});

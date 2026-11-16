import { describe, expect, it } from "@effect/vitest";
import { ContentLanguageSchema } from "@nakafa/aksara-contracts/locale";
import {
  readWorkingLanguage,
  rememberWorkingLanguage,
} from "@repo/backend/confect/tryouts/language";
import { TRYOUT_NOW, tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Option, Schema } from "effect";

const language = Schema.decodeSync(ContentLanguageSchema);
const spm = { countryKey: "malaysia", examKey: "spm" };
const snbt = { countryKey: "indonesia", examKey: "snbt" };

describe("tryouts/language", () => {
  it.effect(
    "keeps one working language per exam beside the learner's other preferences",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        yield* Effect.promise(() =>
          world.t.mutation((ctx) =>
            ctx.db.insert("learningPreferences", {
              preferredTryoutCountryKey: "malaysia",
              updatedAt: TRYOUT_NOW,
              userId: world.userId,
            })
          )
        );
        expect(
          yield* world.run(readWorkingLanguage(world.userId, spm))
        ).toEqual(Option.none());
        yield* world.run(
          rememberWorkingLanguage({
            exam: spm,
            language: language("en"),
            now: TRYOUT_NOW,
            userId: world.userId,
          })
        );
        yield* world.run(
          rememberWorkingLanguage({
            exam: snbt,
            language: language("id"),
            now: TRYOUT_NOW,
            userId: world.userId,
          })
        );
        yield* world.run(
          rememberWorkingLanguage({
            exam: spm,
            language: language("ms"),
            now: TRYOUT_NOW,
            userId: world.userId,
          })
        );
        expect(
          yield* world.run(readWorkingLanguage(world.userId, spm))
        ).toEqual(Option.some("ms"));
        expect(
          yield* Effect.promise(() =>
            world.t.query((ctx) => ctx.db.query("learningPreferences").unique())
          )
        ).toMatchObject({
          preferredTryoutCountryKey: "malaysia",
          questionLanguages: [
            { ...snbt, language: "id" },
            { ...spm, language: "ms" },
          ],
        });
      })
  );
});

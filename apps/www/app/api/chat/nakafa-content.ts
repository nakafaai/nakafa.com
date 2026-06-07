import { parseNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import { Nakafa } from "@repo/contents/_lib/agent/service";
import { Effect, Option } from "effect";
import {
  readExercise,
  readExerciseMarkdown,
  verifyExercise,
} from "@/app/api/chat/nakafa-content/exercise";
import {
  getMdxRuntimePage,
  readMdxMarkdown,
} from "@/app/api/chat/nakafa-content/markdown";

/** Convex-backed Nakafa content adapter for Nina. */
export const nakafaContent = Nakafa.make({
  read: (input) =>
    Effect.gen(function* () {
      const ref = parseNakafaContentRef(input);

      if (Option.isNone(ref)) {
        return Option.none();
      }

      if (ref.value.section === "quran") {
        return yield* Nakafa.read(input).pipe(Effect.provide(Nakafa.Default));
      }

      if (ref.value.section === "exercises") {
        return yield* readExerciseMarkdown(ref.value);
      }

      return yield* readMdxMarkdown(ref.value);
    }),
  exercise: (input, exerciseNumber) =>
    Effect.gen(function* () {
      const ref = parseNakafaContentRef(input);

      if (Option.isNone(ref) || ref.value.section !== "exercises") {
        return Option.none();
      }

      return yield* readExercise(ref.value, exerciseNumber);
    }),
  quran: (input) => Nakafa.quran(input).pipe(Effect.provide(Nakafa.Default)),
  taxonomy: (locale) =>
    Nakafa.taxonomy(locale).pipe(Effect.provide(Nakafa.Default)),
  verify: (input) =>
    Effect.gen(function* () {
      const ref = parseNakafaContentRef(input);

      if (Option.isNone(ref)) {
        return false;
      }

      if (ref.value.section === "quran") {
        return yield* Nakafa.verify(input).pipe(Effect.provide(Nakafa.Default));
      }

      if (ref.value.section === "exercises") {
        return yield* verifyExercise(ref.value);
      }

      const page = yield* getMdxRuntimePage(ref.value);
      return page !== null;
    }).pipe(Effect.catchAll(() => Effect.succeed(false))),
});

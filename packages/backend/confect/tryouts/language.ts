import type { ContentLanguage } from "@nakafa/aksara-contracts/locale";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { captureProductEvent } from "@repo/backend/confect/analytics/capture";
import {
  toTryoutRuntimeError,
  tryoutRuntimeError,
} from "@repo/backend/confect/tryouts/runtime/error";
import { readOwnedAttemptById } from "@repo/backend/confect/tryouts/runtime/lookup";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Array as Arr, Effect, Option } from "effect";

/** The exam a working language belongs to: its country and exam keys, as an attempt keeps them. */
type Exam = Pick<Docs["tryoutAttempts"], "countryKey" | "examKey">;

/** Whether one remembered entry names the exam. */
const isExam = (exam: Exam) => (entry: Exam) =>
  entry.countryKey === exam.countryKey && entry.examKey === exam.examKey;

/** Reads the learner's preference row, none before their first choice of anything. */
const readPreference = Effect.fn("tryouts.language.readPreference")(function* (
  userId: Id<"users">
) {
  return yield* (yield* DatabaseReader)
    .table("learningPreferences")
    .get("by_userId", userId)
    .pipe(
      Effect.asSome,
      Effect.catchTag("GetByIndexFailure", () => Effect.succeedNone),
      Effect.mapError(toTryoutRuntimeError)
    );
});

/**
 * Reads the language the learner last chose for an exam's questions, its working language, none before
 * their first choice in that exam.
 */
export const readWorkingLanguage = Effect.fn("tryouts.language.readWorking")(
  function* (userId: Id<"users">, exam: Exam) {
    const preference = yield* readPreference(userId);
    return Option.map(
      Option.flatMap(preference, ({ questionLanguages }) =>
        Arr.findFirst(questionLanguages ?? [], isExam(exam))
      ),
      ({ language }) => language
    );
  }
);

/**
 * Remembers an explicit choice of question language as the learner's working language for the exam,
 * so the next section of the exam, in any subject, opens on it. A choice that changes nothing writes
 * nothing, since every reader of the row runs again on a write.
 */
export const rememberWorkingLanguage = Effect.fn(
  "tryouts.language.rememberWorking"
)(function* (input: {
  readonly exam: Exam;
  readonly language: ContentLanguage;
  readonly now: number;
  readonly userId: Id<"users">;
}) {
  const writer = yield* DatabaseWriter;
  const entry = {
    countryKey: input.exam.countryKey,
    examKey: input.exam.examKey,
    language: input.language,
  };
  const preference = yield* readPreference(input.userId);
  if (Option.isNone(preference)) {
    yield* writer
      .table("learningPreferences")
      .insert({
        questionLanguages: [entry],
        updatedAt: input.now,
        userId: input.userId,
      })
      .pipe(Effect.mapError(toTryoutRuntimeError));
    return;
  }
  const remembered = preference.value.questionLanguages ?? [];
  const current = Arr.findFirst(remembered, isExam(input.exam));
  if (Option.isSome(current) && current.value.language === input.language) {
    return;
  }
  yield* writer
    .table("learningPreferences")
    .patch(preference.value._id, {
      questionLanguages: [
        ...Arr.filter(remembered, (other) => !isExam(input.exam)(other)),
        entry,
      ],
      updatedAt: input.now,
    })
    .pipe(Effect.mapError(toTryoutRuntimeError));
});

/** Fails unless the section's questions are written in the language. */
export const requireSectionLanguage = Effect.fn(
  "tryouts.language.requireSection"
)(function* (languages: readonly ContentLanguage[], language: ContentLanguage) {
  if (!Arr.contains(languages, language)) {
    return yield* tryoutRuntimeError(
      "TRYOUT_QUESTION_LANGUAGE_UNAVAILABLE",
      `The section's questions are not written in ${language}.`
    );
  }
});

/**
 * Decides the language a section starts in. A language the learner confirmed on the section page is
 * the choice, remembered as their working language for the exam. Without one, as when a set's own page
 * starts its entry section, the section opens on the working language when its questions are written
 * in it, else on its first language.
 */
export const chooseStartLanguage = Effect.fn("tryouts.language.chooseStart")(
  function* (input: {
    readonly attempt: Pick<
      Docs["tryoutAttempts"],
      "countryKey" | "examKey" | "userId"
    >;
    readonly chosen: ContentLanguage | undefined;
    readonly languages: readonly [ContentLanguage, ...ContentLanguage[]];
    readonly now: number;
  }) {
    const { attempt, chosen, languages } = input;
    if (chosen !== undefined) {
      yield* requireSectionLanguage(languages, chosen);
      yield* rememberWorkingLanguage({
        exam: attempt,
        language: chosen,
        now: input.now,
        userId: attempt.userId,
      });
      return chosen;
    }
    const working = yield* readWorkingLanguage(attempt.userId, attempt);
    return Option.getOrElse(
      Option.filter(working, (language) => Arr.contains(languages, language)),
      () => Arr.headNonEmpty(languages)
    );
  }
);

/**
 * Counts one look at a question in the other language of its section, for the authors: a question many
 * learners look up is a wording or translation to review. The look itself stays in the browser, so this
 * writes no row of the attempt, and a question of another learner counts nothing.
 */
export const countQuestionLook = Effect.fn("tryouts.language.countLook")(
  function* (input: {
    readonly from: ContentLanguage;
    readonly now: number;
    readonly placementId: Id<"tryoutAttemptPlacements">;
    readonly to: ContentLanguage;
    readonly userId: Id<"users">;
  }) {
    const placement = yield* (yield* DatabaseReader)
      .table("tryoutAttemptPlacements")
      .get(input.placementId)
      .pipe(
        Effect.asSome,
        Effect.catchTag("GetByIdFailure", () => Effect.succeedNone),
        Effect.mapError(toTryoutRuntimeError)
      );
    if (Option.isNone(placement)) {
      return;
    }
    const attempt = yield* readOwnedAttemptById(
      placement.value.tryoutAttemptId,
      input.userId
    );
    if (!attempt) {
      return;
    }
    yield* captureProductEvent({
      event: {
        name: "tryout question looked at in other language",
        properties: {
          country_key: attempt.countryKey,
          exam_key: attempt.examKey,
          from: input.from,
          item_family: placement.value.family,
          to: input.to,
        },
      },
      timestamp: input.now,
    });
  }
);

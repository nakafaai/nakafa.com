import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import type { InteractionKey } from "@nakafa/aksara-contracts/assessment/key";
import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  AnswersDoNotFit,
  KeyDoesNotFit,
  RevisionStale,
} from "@repo/backend/confect/exams/errors";
import { keyFits } from "@repo/backend/confect/exams/key";
import {
  encodeAnswers,
  encodeKey,
  isChoiceAnswers,
} from "@repo/backend/confect/exams/question";
import { type Array as Arr, Clock, Effect } from "effect";

/**
 * Saves the answers and the key of one question at the revision the editor saw. A
 * revision that is no longer current is refused as `RevisionStale` and writes nothing,
 * and a key that does not fit the answers is refused as `KeyDoesNotFit`. Otherwise both
 * are written as their JSON text, and the revision rises by one.
 */
export const answerQuestion = Effect.fn("exams.question.answer")(function* (
  question: ExamQuestionsDoc,
  edit: {
    readonly answers: Arr.NonEmptyReadonlyArray<Interaction>;
    readonly key: Arr.NonEmptyReadonlyArray<InteractionKey> | null;
    readonly revision: number;
  }
) {
  if (question.revision !== edit.revision) {
    return yield* new RevisionStale({ current: question.revision });
  }
  if (!isChoiceAnswers(edit.answers)) {
    return yield* new AnswersDoNotFit();
  }
  if (edit.key !== null && !keyFits(edit.answers, edit.key)) {
    return yield* new KeyDoesNotFit();
  }
  const at = yield* Clock.currentTimeMillis;
  const answers = yield* encodeAnswers(edit.answers);
  const key = edit.key === null ? null : yield* encodeKey(edit.key);
  yield* (yield* DatabaseWriter)
    .table("examQuestions")
    .patch(question._id, {
      answers,
      key,
      revision: question.revision + 1,
      updatedAt: at,
    })
    .pipe(Effect.orDie);
});

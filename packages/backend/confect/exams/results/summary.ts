import type { ExamQuestionsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { questionView } from "@repo/backend/confect/exams/question";
import {
  optionIdsOf,
  pairIdsOf,
} from "@repo/backend/confect/exams/results/stats";
import { Effect } from "effect";

/**
 * One question of the exam, numbered from one, with the option IDs of its choice in order, the statements
 * and answers of its match in order, and the points that a correct answer to it earns.
 */
export const questionSummary = Effect.fn("exams.results.summary.question")(
  function* (questionId: ExamQuestionsDoc["_id"], number: number) {
    const row = yield* (yield* DatabaseReader)
      .table("examQuestions")
      .get(questionId)
      .pipe(Effect.orDie);
    const view = yield* questionView(row);
    return {
      id: questionId,
      number,
      optionIds: optionIdsOf(view.answers),
      ...pairIdsOf(view.answers),
      points: view.points,
    };
  }
);

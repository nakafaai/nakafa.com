import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { MAX_EXAM_QUESTIONS } from "@repo/backend/confect/exams/exam";
import { Effect } from "effect";

/**
 * The scored rows of one student in one sitting: at most one for each question of the exam, so the
 * read is bounded by the exam's size. A student's score, answers, and pending count are sums over them.
 */
export const attemptResults = Effect.fn("exams.results.rows.attempt")(
  function* (
    sittingId: ExamSittingsDoc["_id"],
    personId: TenantPeopleDoc["_id"]
  ) {
    return yield* (yield* DatabaseReader)
      .table("examResults")
      .index("by_sittingId_and_personId", (query) =>
        query.eq("sitting", sittingId).eq("person", personId)
      )
      .take(MAX_EXAM_QUESTIONS)
      .pipe(Effect.orDie);
  }
);

/**
 * The scored rows of one question in one sitting, one for each attempt that scored it. The read takes
 * `limit` rows, so a caller that asks for one more row learns whether the question has more.
 */
export const questionResults = Effect.fn("exams.results.rows.question")(
  function* (
    sittingId: ExamSittingsDoc["_id"],
    questionId: ExamQuestionsDoc["_id"],
    limit: number
  ) {
    return yield* (yield* DatabaseReader)
      .table("examResults")
      .index("by_sittingId_and_questionId", (query) =>
        query.eq("sitting", sittingId).eq("question", questionId)
      )
      .take(limit)
      .pipe(Effect.orDie);
  }
);

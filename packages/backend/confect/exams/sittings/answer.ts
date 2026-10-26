import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import type { Version } from "@repo/backend/confect/assessment/gate/rules";
import { questionAnswers } from "@repo/backend/confect/exams/question";
import {
  ResponseDoesNotFit,
  StaleAnswer,
} from "@repo/backend/confect/exams/sittings/errors";
import { fitsQuestion } from "@repo/backend/confect/exams/sittings/fit";
import { sittingGate } from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import type { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * The response as the question takes it: the caller's response when it fits the question's one
 * interaction (`fitsQuestion`), and `ResponseDoesNotFit` for any other.
 */
const fittingResponse = Effect.fn("exams.sittings.answer.fit")(function* (
  question: ExamQuestionsDoc,
  response: ExamResponse
) {
  const interactions = yield* questionAnswers(question.answers);
  if (!fitsQuestion(interactions, response)) {
    return yield* new ResponseDoesNotFit();
  }
  return response;
});

/**
 * Saves the caller's response to one question of its sitting, replacing the response that
 * was saved before. The gate admits the write to the device that owns an open attempt, and
 * refuses a version that is not newer than the saved one. The question must belong to the
 * sitting's exam, and a student's answer is not journaled, because the answers are the
 * record of the student (ADR 0013, ADR 0016).
 */
export const answer = Effect.fn("exams.sittings.answer")(function* (args: {
  deviceId: string;
  questionId: ExamQuestionsDoc["_id"];
  response: ExamResponse;
  sittingId: ExamSittingsDoc["_id"];
  version: Version;
}) {
  const member = yield* Member;
  yield* sittingGate
    .answer({
      device: Option.some(args.deviceId),
      owner: member.person._id,
      placement: {
        person: member.person,
        questionId: args.questionId,
        sittingId: args.sittingId,
        tenantId: member.tenant._id,
      },
      value: (live) => fittingResponse(live.question, args.response),
      version: args.version,
    })
    .pipe(
      Effect.catchTags({
        AttemptRefused: (refusal) => Effect.fail(toSittingError(refusal)),
        Stale: () => Effect.fail(new StaleAnswer()),
      })
    );
  return null;
});

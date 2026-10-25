import type {
  ExamQuestionsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { setAssessmentFlag } from "@repo/backend/confect/assessment/flags";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import {
  placementOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * Flags or unflags one question of the caller's paper for review. The gate admits the change
 * to the device that owns an open attempt, under the flag rule, and the shared flags table
 * records it, so a reload shows the same flags. Try-outs write the same table through their
 * own gate (`tryouts/gate.ts`).
 */
export const flag = Effect.fn("exams.sittings.flag")(function* (args: {
  deviceId: string;
  flagged: boolean;
  questionId: ExamQuestionsDoc["_id"];
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const { live } = yield* sittingGate
    .admit(
      rules.flag,
      Option.some(member.person._id),
      Option.some(args.deviceId),
      placementOf({
        person: member.person,
        questionId: args.questionId,
        sittingId: args.sittingId,
        tenantId: member.tenant._id,
      })
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  yield* setAssessmentFlag({
    attempt: live.attempt._id,
    flagged: args.flagged,
    kind: "sitting",
    question: live.question._id,
  });
  return null;
});

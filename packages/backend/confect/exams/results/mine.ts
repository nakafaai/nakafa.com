import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { answersOf } from "@repo/backend/confect/exams/results/answers";
import {
  attemptOf,
  sittingOf,
} from "@repo/backend/confect/exams/sittings/attempt";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * The student's own result in one sitting, once the teacher releases it: the points that the attempt
 * earned, and each question of the exam in its order with the options that the student chose and the
 * verdict. A student sees nothing before the release, and nothing for an attempt that is not submitted.
 * A student who holds no attempt gets `null`.
 */
export const mine = Effect.fn("exams.results.mine")(function* (args: {
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const sitting = yield* sittingOf(args.sittingId, member.tenant._id);
  const held = yield* attemptOf(sitting._id, member.person._id);
  if (
    Option.isNone(held) ||
    held.value.state !== "submitted" ||
    sitting.resultsReleasedAt === undefined
  ) {
    return null;
  }
  return yield* answersOf(sitting, member.person._id);
});

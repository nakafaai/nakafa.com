import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  attemptOf,
  heldView,
  sittingOf,
} from "@repo/backend/confect/exams/sittings/attempt";
import { mayEnter } from "@repo/backend/confect/exams/sittings/eligibility";
import { NotInSitting } from "@repo/backend/confect/exams/sittings/errors";
import { LIVE_STATES } from "@repo/backend/confect/exams/sittings/mine";
import { sittingView } from "@repo/backend/confect/exams/sittings/view";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Effect, Option } from "effect";

/**
 * One sitting as its student sees it: the sitting, and the attempt the student holds in it.
 * A student who holds an attempt sees it in every state, also after the sitting closes, so a
 * reload shows how the attempt ended. A student without an attempt sees a sitting they may
 * still enter, scheduled or open. Any other caller gets `NotInSitting`, which names no part
 * of the sitting, as an entry refuses it.
 */
export const studentSitting = Effect.fn("exams.sittings.student")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const member = yield* Member;
  const sitting = yield* sittingOf(sittingId, member.tenant._id);
  const held = yield* attemptOf(sitting._id, member.person._id);
  if (Option.isNone(held)) {
    if (!Arr.contains(LIVE_STATES, sitting.state)) {
      return yield* new NotInSitting();
    }
    if (!(yield* mayEnter(sitting, member))) {
      return yield* new NotInSitting();
    }
  }
  const exam = yield* (yield* DatabaseReader)
    .table("exams")
    .get(sitting.examId)
    .pipe(Effect.orDie);
  return {
    attempt: heldView(held),
    sitting: yield* sittingView(sitting, exam),
  };
});

import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  boundAttempt,
  requireOpen,
} from "@repo/backend/confect/exams/sittings/attempt";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Clock, Effect } from "effect";

/**
 * The student's Finish: the caller's open attempt is submitted now, and its pending close is
 * cancelled, so the submission is the student's own. A second Finish changes nothing and
 * answers the same. The journal records the submission under the student's Person (ADR 0013,
 * ADR 0016).
 */
export const finish = Effect.fn("exams.sittings.finish")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
}) {
  const member = yield* Member;
  const { attempt, sitting } = yield* boundAttempt(
    args.sittingId,
    args.deviceId
  );
  if (attempt.state === "submitted") {
    return null;
  }
  const now = yield* Clock.currentTimeMillis;
  yield* requireOpen(attempt, now);
  if (attempt.closeJob !== undefined) {
    yield* cancelPending(attempt.closeJob);
  }
  yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .patch(attempt._id, { state: "submitted", submittedAt: now })
    .pipe(Effect.orDie);
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    attempt: attempt._id,
    type: "sitting.finish",
  });
  return null;
});

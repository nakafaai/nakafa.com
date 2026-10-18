import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { ownAttempt } from "@repo/backend/confect/exams/sittings/attempt";
import { deviceBinding } from "@repo/backend/confect/exams/sittings/device";
import { sittingLocked } from "@repo/backend/confect/exams/sittings/eligibility";
import {
  AttemptClosed,
  DeviceRetired,
  SecondDevice,
  SittingLocked,
} from "@repo/backend/confect/exams/sittings/errors";
import type { SignalKind } from "@repo/backend/confect/exams/sittings/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Array as Arr, Clock, Effect } from "effect";

/**
 * Records one integrity signal of the caller's attempt as an event (ADR 0013). A signal
 * never locks an attempt, so the proctor decides. The sitting must not be locked, the
 * device must own the attempt, and the signal is recorded only while the attempt is in
 * progress or locked.
 */
export const signal = Effect.fn("exams.sittings.signal")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  deviceId: string;
  kind: typeof SignalKind.Type;
}) {
  const member = yield* Member;
  const attempt = yield* ownAttempt(
    args.attemptId,
    member.tenant._id,
    member.person._id
  );
  const sitting = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(attempt.sitting)
    .pipe(Effect.orDie);
  if (yield* sittingLocked(sitting)) {
    return yield* new SittingLocked();
  }
  if (!Arr.contains(["inProgress", "locked"], attempt.state)) {
    return yield* new AttemptClosed();
  }
  const binding = deviceBinding(attempt, args.deviceId);
  if (binding === "retired") {
    return yield* new DeviceRetired();
  }
  if (binding !== "bound") {
    return yield* new SecondDevice();
  }
  const now = yield* Clock.currentTimeMillis;
  yield* (yield* DatabaseWriter)
    .table("examSignals")
    .insert({
      at: now,
      attempt: attempt._id,
      kind: args.kind,
      tenantId: attempt.tenantId,
    })
    .pipe(Effect.orDie);
  return null;
});

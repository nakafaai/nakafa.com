import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { rules } from "@repo/backend/confect/assessment/gate/rules";
import {
  sectionOf,
  sittingGate,
} from "@repo/backend/confect/exams/sittings/gate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import type { SignalKind } from "@repo/backend/confect/exams/sittings/schema";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * Records one integrity signal of the caller's attempt as an event (ADR 0013). A signal
 * never locks an attempt, so the proctor decides. The gate admits the signal to an open
 * attempt, whether it is in progress or locked, on the device that owns it.
 */
export const signal = Effect.fn("exams.sittings.signal")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  deviceId: string;
  kind: typeof SignalKind.Type;
}) {
  const member = yield* Member;
  const { live, now } = yield* sittingGate
    .admit(
      rules.signal,
      Option.some(member.person._id),
      Option.some(args.deviceId),
      sectionOf({
        attemptId: args.attemptId,
        person: member.person,
        tenantId: member.tenant._id,
      })
    )
    .pipe(
      Effect.catchTag("AttemptRefused", (refusal) =>
        Effect.fail(toSittingError(refusal))
      )
    );
  yield* (yield* DatabaseWriter)
    .table("examSignals")
    .insert({
      at: now,
      attempt: live.attempt._id,
      kind: args.kind,
      tenantId: live.attempt.tenantId,
    })
    .pipe(Effect.orDie);
  return null;
});

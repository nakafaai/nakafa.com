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
import { Effect, Number as Num, Option } from "effect";

/**
 * Records one integrity signal of the caller's attempt as an event (ADR 0013). A signal
 * never locks an attempt, so the proctor decides. The gate admits the signal to an open
 * attempt, whether it is in progress or locked, on the device that owns it. A signal is
 * recorded at the server's time, except a disconnect, which the device can only send once
 * it reaches the server again: it is recorded at `since`, when the device lost its
 * connection, kept within the attempt, never before it started and never after now.
 */
export const signal = Effect.fn("exams.sittings.signal")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  deviceId: string;
  kind: typeof SignalKind.Type;
  since?: number;
}) {
  const member = yield* Member;
  const { live, now } = yield* sittingGate
    .admit(
      rules.signal,
      member.person._id,
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
      at:
        args.kind === "disconnect" && args.since !== undefined
          ? Num.clamp(args.since, {
              maximum: now,
              minimum: live.attempt.startedAt,
            })
          : now,
      attempt: live.attempt._id,
      kind: args.kind,
      tenantId: live.attempt.tenantId,
    })
    .pipe(Effect.orDie);
  return null;
});

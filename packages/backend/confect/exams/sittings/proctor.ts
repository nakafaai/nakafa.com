import type { ExamAttemptsDoc } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { freezeExam } from "@repo/backend/confect/exams/freeze";
import { Sitting } from "@repo/backend/confect/exams/sittings/access";
import { attemptIn } from "@repo/backend/confect/exams/sittings/attempt";
import { sittingAuthority } from "@repo/backend/confect/exams/sittings/authority";
import { RetiredDevicesFull } from "@repo/backend/confect/exams/sittings/errors";
import {
  type Minutes,
  RETIRED_DEVICE_LIMIT,
  type ReasonCode,
} from "@repo/backend/confect/exams/sittings/schema";
import { decideProctorAction } from "@repo/backend/confect/exams/sittings/state";
import {
  cancelPending,
  scheduleAttemptClose,
  scheduleSubmit,
} from "@repo/backend/confect/exams/sittings/timers";
import {
  drawToken,
  sealToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { Array as Arr, Clock, Duration, Effect } from "effect";

/** One minute in milliseconds, so added minutes move a deadline by whole minutes. */
const MINUTE_MS = 60_000;

/** Writes a new state to the attempt, when the state changes. */
const setState = Effect.fn("exams.sittings.proctor.state")(function* (
  attempt: ExamAttemptsDoc,
  state: ExamAttemptsDoc["state"]
) {
  if (attempt.state !== state) {
    yield* (yield* DatabaseWriter)
      .table("examAttempts")
      .patch(attempt._id, { state })
      .pipe(Effect.orDie);
  }
});

/** Lock: an attempt in progress becomes locked, and a locked one stays locked (ADR 0013). */
export const lock = Effect.fn("exams.sittings.lock")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  reason: typeof ReasonCode.Type;
}) {
  const sitting = yield* Sitting;
  const member = yield* Member;
  const attempt = yield* attemptIn(sitting, args.attemptId, "sitting.proctor");
  const now = yield* Clock.currentTimeMillis;
  const next = yield* decideProctorAction(
    "lock",
    attempt.state,
    now < attempt.deadline
  );
  yield* setState(attempt, next.state);
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    attempt: attempt._id,
    reason: args.reason,
    type: "sitting.lock",
  });
  return null;
});

/**
 * Unlock: a locked attempt returns to progress before its deadline. After it, the attempt
 * closes, and the server submits it once the submission window has passed.
 */
export const unlock = Effect.fn("exams.sittings.unlock")(function* (args: {
  attemptId: ExamAttemptsDoc["_id"];
  reason: typeof ReasonCode.Type;
}) {
  const sitting = yield* Sitting;
  const member = yield* Member;
  const attempt = yield* attemptIn(sitting, args.attemptId, "sitting.proctor");
  const now = yield* Clock.currentTimeMillis;
  const next = yield* decideProctorAction(
    "unlock",
    attempt.state,
    now < attempt.deadline
  );
  if (next.state === "closing") {
    yield* scheduleSubmit(attempt._id, attempt.deadline);
  }
  yield* setState(attempt, next.state);
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    attempt: attempt._id,
    reason: args.reason,
    type: "sitting.unlock",
  });
  return null;
});

/**
 * Add minutes: moves the deadline of one attempt by whole minutes, before its deadline,
 * and schedules its close at the new deadline. The sitting's own closing time does not
 * move (round 2, decision 2).
 */
export const addMinutes = Effect.fn("exams.sittings.addMinutes")(
  function* (args: {
    attemptId: ExamAttemptsDoc["_id"];
    minutes: typeof Minutes.Type;
    reason: typeof ReasonCode.Type;
  }) {
    const sitting = yield* Sitting;
    const member = yield* Member;
    const attempt = yield* attemptIn(
      sitting,
      args.attemptId,
      "sitting.proctor"
    );
    const now = yield* Clock.currentTimeMillis;
    yield* decideProctorAction(
      "addMinutes",
      attempt.state,
      now < attempt.deadline
    );
    if (attempt.closeJob !== undefined) {
      yield* cancelPending(attempt.closeJob);
    }
    const deadline = attempt.deadline + args.minutes * MINUTE_MS;
    const closeJob = yield* scheduleAttemptClose(attempt._id, deadline);
    yield* (yield* DatabaseWriter)
      .table("examAttempts")
      .patch(attempt._id, { closeJob, deadline })
      .pipe(Effect.orDie);
    yield* sittingAuthority.record(personActor(member.person), sitting, {
      attempt: attempt._id,
      minutes: args.minutes,
      reason: args.reason,
      type: "sitting.addMinutes",
    });
    return null;
  }
);

/**
 * Allow a second device: the device that owns the attempt is retired, so it writes
 * nothing more, and the next device that enters binds the attempt. Any state of the
 * attempt allows it (ADR 0013).
 */
export const allowDevice = Effect.fn("exams.sittings.allowDevice")(
  function* (args: { attemptId: ExamAttemptsDoc["_id"] }) {
    const sitting = yield* Sitting;
    const member = yield* Member;
    const attempt = yield* attemptIn(
      sitting,
      args.attemptId,
      "sitting.proctor"
    );
    if (attempt.deviceId !== null) {
      if (attempt.retiredDeviceIds.length >= RETIRED_DEVICE_LIMIT) {
        return yield* new RetiredDevicesFull();
      }
      yield* (yield* DatabaseWriter)
        .table("examAttempts")
        .patch(attempt._id, {
          deviceId: null,
          retiredDeviceIds: Arr.append(
            attempt.retiredDeviceIds,
            attempt.deviceId
          ),
        })
        .pipe(Effect.orDie);
    }
    yield* sittingAuthority.record(personActor(member.person), sitting, {
      attempt: attempt._id,
      type: "sitting.allowDevice",
    });
    return null;
  }
);

/**
 * Change the token: a new token replaces the old one, which stops working at once.
 * Students who are inside keep working. The token is returned here, to the proctor only.
 */
export const changeToken = Effect.fn("exams.sittings.changeToken")(
  function* () {
    const sitting = yield* Sitting;
    const member = yield* Member;
    const token = yield* drawToken().pipe(Effect.orDie);
    const keys = yield* readTenantKeys(sitting.tenantId).pipe(Effect.orDie);
    const hash = yield* tokenHash(keys, sitting._id, token).pipe(Effect.orDie);
    const sealed = yield* sealToken(keys, sitting._id, token).pipe(
      Effect.orDie
    );
    const now = yield* Clock.currentTimeMillis;
    yield* (yield* DatabaseWriter)
      .table("examSittings")
      .patch(sitting._id, {
        tokenHash: hash,
        tokenIssuedAt: now,
        tokenSealed: sealed,
      })
      .pipe(Effect.orDie);
    yield* sittingAuthority.record(personActor(member.person), sitting, {
      type: "sitting.changeToken",
    });
    return { token };
  }
);

/**
 * Close the sitting: each of its jobs that is still pending is cancelled, the exam freezes, since
 * a finished sitting fixes the paper its students sat (ADR 0031), and a run closes every open
 * attempt at once, one page at a time, with each deadline set to now (ADR 0013).
 */
export const close = Effect.fn("exams.sittings.close")(function* () {
  const sitting = yield* Sitting;
  const member = yield* Member;
  const scheduler = yield* Scheduler;
  yield* Effect.forEach(sitting.jobs, (job) => cancelPending(job));
  yield* (yield* DatabaseWriter)
    .table("examSittings")
    .patch(sitting._id, { state: "closed" })
    .pipe(Effect.orDie);
  yield* freezeExam(sitting.exam);
  yield* scheduler.runAfter(
    Duration.zero,
    refs.internal.exams.sittings.timers.closeDue,
    { atDeadline: "now", sittingId: sitting._id }
  );
  yield* sittingAuthority.record(personActor(member.person), sitting, {
    type: "sitting.close",
  });
  return null;
});

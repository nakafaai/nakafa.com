import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { withExam } from "@repo/backend/confect/exams/sittings/authority";
import { deviceBinding } from "@repo/backend/confect/exams/sittings/device";
import { sittingLocked } from "@repo/backend/confect/exams/sittings/eligibility";
import {
  AttemptClosed,
  DeviceRetired,
  NotInSitting,
  SecondDevice,
  SittingLocked,
} from "@repo/backend/confect/exams/sittings/errors";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { Effect, Option } from "effect";

/**
 * The sitting that a caller names. A missing sitting and another school's sitting are both
 * `NotInSitting`, so the reply names no part of the sitting.
 */
export const sittingOf = Effect.fn("exams.sittings.attempt.sitting")(function* (
  sittingId: ExamSittingsDoc["_id"],
  tenantId: ExamSittingsDoc["tenantId"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(sittingId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const row = Option.filter(found, (sitting) => sitting.tenantId === tenantId);
  if (Option.isNone(row)) {
    return yield* new NotInSitting();
  }
  return row.value;
});

/** The attempt that this Person holds in the sitting, if any. */
export const attemptOf = Effect.fn("exams.sittings.attempt.of")(function* (
  sittingId: ExamSittingsDoc["_id"],
  personId: TenantPeopleDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("examAttempts")
    .index("by_sittingId_and_personId", (query) =>
      query.eq("sitting", sittingId).eq("person", personId)
    )
    .first()
    .pipe(Effect.orDie);
});

/**
 * The attempt that a proctor's action acts on. It must belong to the sitting that the
 * action names, so an attempt of another sitting is refused as a resource.
 */
export const attemptIn = Effect.fn("exams.sittings.attempt.in")(function* (
  sitting: ExamSittingsDoc,
  attemptId: ExamAttemptsDoc["_id"],
  action: string
) {
  const found = yield* (yield* DatabaseReader)
    .table("examAttempts")
    .get(attemptId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const row = Option.filter(
    found,
    (attempt) => attempt.sitting === sitting._id
  );
  if (Option.isNone(row)) {
    return yield* new AccessDenied({ action, reason: "resource" });
  }
  return row.value;
});

/**
 * The attempt of a signal, when the caller holds it. Another student's attempt and an
 * attempt of another school are both `NotInSitting`, so the reply names no attempt.
 */
export const ownAttempt = Effect.fn("exams.sittings.attempt.own")(function* (
  attemptId: ExamAttemptsDoc["_id"],
  tenantId: ExamAttemptsDoc["tenantId"],
  personId: TenantPeopleDoc["_id"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("examAttempts")
    .get(attemptId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  const row = Option.filter(
    found,
    (attempt) => attempt.tenantId === tenantId && attempt.person === personId
  );
  if (Option.isNone(row)) {
    return yield* new NotInSitting();
  }
  return row.value;
});

/**
 * The caller's attempt in one sitting, after the checks that every student write and read
 * shares, in this order: the sitting is the caller's, its school and unit are not locked,
 * and the device owns the attempt. A retired device and any other device are refused, so
 * only the bound device reads its paper or writes an answer (ADR 0013). The sitting it returns
 * carries its exam, which these reads use, so the exam is read once.
 */
export const boundAttempt = Effect.fn("exams.sittings.attempt.bound")(
  function* (sittingId: ExamSittingsDoc["_id"], deviceId: string) {
    const member = yield* Member;
    const sitting = yield* sittingOf(sittingId, member.tenant._id);
    const held = yield* attemptOf(sitting._id, member.person._id);
    if (Option.isNone(held)) {
      return yield* new NotInSitting();
    }
    if (yield* sittingLocked(sitting)) {
      return yield* new SittingLocked();
    }
    const binding = deviceBinding(held.value, deviceId);
    if (binding === "retired") {
      return yield* new DeviceRetired();
    }
    if (binding !== "bound") {
      return yield* new SecondDevice();
    }
    return { attempt: held.value, sitting: yield* withExam(sitting) };
  }
);

/**
 * Refuses a student's paper, answer, or finish once the attempt is not open to it: it must
 * be in progress and before its deadline, as an entry checks it (ADR 0013).
 */
export const requireOpen = Effect.fn("exams.sittings.attempt.open")(function* (
  attempt: Pick<ExamAttemptsDoc, "deadline" | "state">,
  now: number
) {
  if (attempt.state !== "inProgress" || now >= attempt.deadline) {
    return yield* new AttemptClosed();
  }
});

/** An attempt as its student's screen reads it, or `null` when the student holds none. */
export const heldView = (held: Option.Option<ExamAttemptsDoc>) =>
  Option.match(held, {
    onNone: () => null,
    onSome: (attempt) => ({
      deadline: attempt.deadline,
      id: attempt._id,
      startedAt: attempt.startedAt,
      state: attempt.state,
    }),
  });

/** The caller's own attempt in a sitting, as the student's screen reads it, or `null` when there is none. */
export const heldAttempt = Effect.fn("exams.sittings.attempt.held")(function* (
  sittingId: ExamSittingsDoc["_id"]
) {
  const member = yield* Member;
  return heldView(yield* attemptOf(sittingId, member.person._id));
});

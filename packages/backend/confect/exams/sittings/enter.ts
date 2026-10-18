import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import { deviceBinding } from "@repo/backend/confect/exams/sittings/device";
import { mayEnter } from "@repo/backend/confect/exams/sittings/eligibility";
import {
  AttemptClosed,
  DeviceRetired,
  NotInSitting,
  SecondDevice,
  SittingClosed,
  SittingNotOpen,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  countFailedTry,
  deviceMayTry,
  sittingMayFail,
} from "@repo/backend/confect/exams/sittings/rate";
import {
  normalizeToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { matchesSecret } from "@repo/utilities/digest";
import { Clock, Effect, Option } from "effect";

type EnterReply = typeof EnterOutcome.Type;

/** A refusal of the token or of the tries. */
const refused = (reason: "TokenRefused" | "TooManyTries"): EnterReply => ({
  outcome: "refused",
  reason,
});

/** An admission to an attempt, with its deadline and state. */
const admitted = (
  attempt: Pick<ExamAttemptsDoc, "_id" | "deadline" | "state">
): EnterReply => ({
  attempt: attempt._id,
  deadline: attempt.deadline,
  outcome: "admitted",
  state: attempt.state,
});

/** The sitting of the entry. A missing sitting and another school's sitting are both `NotInSitting`. */
const sittingOf = Effect.fn("exams.sittings.enter.sitting")(function* (
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
const attemptOf = Effect.fn("exams.sittings.enter.attempt")(function* (
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
 * Whether the sitting or the attempt is open to this entry. A new entry needs an open
 * sitting that has not reached its closing time. An attempt that the student holds needs
 * to be in progress or locked, before its own deadline.
 */
const checkOpen = Effect.fn("exams.sittings.enter.open")(function* (
  sitting: ExamSittingsDoc,
  attempt: Option.Option<ExamAttemptsDoc>,
  now: number
) {
  if (Option.isSome(attempt)) {
    const held = attempt.value;
    const open =
      (held.state === "inProgress" || held.state === "locked") &&
      now < held.deadline;
    if (!open) {
      return yield* new AttemptClosed();
    }
    return;
  }
  if (sitting.state === "scheduled") {
    return yield* new SittingNotOpen();
  }
  if (sitting.state === "closed" || now >= sitting.closesAt) {
    return yield* new SittingClosed();
  }
});

/** Starts the Person's attempt with this device, which then owns it. */
const startAttempt = Effect.fn("exams.sittings.enter.start")(function* (
  sitting: ExamSittingsDoc,
  person: TenantPeopleDoc,
  deviceId: string,
  now: number
) {
  const id = yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .insert({
      deadline: sitting.closesAt,
      deviceId,
      person: person._id,
      retiredDeviceIds: [],
      sitting: sitting._id,
      startedAt: now,
      state: "inProgress",
      tenantId: sitting.tenantId,
    })
    .pipe(Effect.orDie);
  return admitted({
    _id: id,
    deadline: sitting.closesAt,
    state: "inProgress",
  });
});

/**
 * Admits a device to the Person's existing attempt. A device that owns it enters again.
 * An unbound attempt, after a proctor allowed another device, binds to this one. A
 * retired device and any other device are refused.
 */
const bindAttempt = Effect.fn("exams.sittings.enter.bind")(function* (
  attempt: ExamAttemptsDoc,
  deviceId: string
) {
  const binding = deviceBinding(attempt, deviceId);
  if (binding === "retired") {
    return yield* new DeviceRetired();
  }
  if (binding === "other") {
    return yield* new SecondDevice();
  }
  if (binding === "unbound") {
    yield* (yield* DatabaseWriter)
      .table("examAttempts")
      .patch(attempt._id, { deviceId })
      .pipe(Effect.orDie);
  }
  return admitted(attempt);
});

/**
 * Admits a student to a sitting with its token, from one device (ADR 0013, round 2
 * decisions 1, 4, 11). The order is fixed: the student must be in the sitting, the
 * sitting or the attempt must be open, the device and the sitting must have a try left,
 * and the token must match. A token that does not match counts as a failed try.
 */
export const enter = Effect.fn("exams.sittings.enter")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
  token: string;
}) {
  const member = yield* Member;
  const sitting = yield* sittingOf(args.sittingId, member.tenant._id);
  if (!(yield* mayEnter(sitting, member))) {
    return yield* new NotInSitting();
  }
  const attempt = yield* attemptOf(sitting._id, member.person._id);
  const now = yield* Clock.currentTimeMillis;
  yield* checkOpen(sitting, attempt, now);
  if (!(yield* deviceMayTry(args.deviceId))) {
    return refused("TooManyTries");
  }
  if (!(yield* sittingMayFail(sitting._id))) {
    return refused("TooManyTries");
  }
  const keys = yield* readTenantKeys(member.tenant._id).pipe(Effect.orDie);
  const hash = yield* tokenHash(
    keys,
    sitting._id,
    normalizeToken(args.token)
  ).pipe(Effect.orDie);
  if (!(yield* matchesSecret(hash, sitting.tokenHash).pipe(Effect.orDie))) {
    yield* countFailedTry(sitting._id);
    return refused("TokenRefused");
  }
  if (Option.isNone(attempt)) {
    return yield* startAttempt(sitting, member.person, args.deviceId, now);
  }
  return yield* bindAttempt(attempt.value, args.deviceId);
});

import type {
  ExamAttemptsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  attemptOf,
  sittingOf,
} from "@repo/backend/confect/exams/sittings/attempt";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import { deviceBinding } from "@repo/backend/confect/exams/sittings/device";
import {
  mayEnter,
  sittingLocked,
} from "@repo/backend/confect/exams/sittings/eligibility";
import {
  AttemptClosed,
  DeviceRetired,
  NotInSitting,
  SecondDevice,
  SittingClosed,
  SittingLocked,
  SittingNotOpen,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  countFailedTry,
  deviceMayTry,
  personMayFail,
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

/**
 * An admission to an attempt, with its deadline, its state, and the server's clock at the admission.
 * The screen counts down on that clock, so a device whose own clock is wrong still shows the time left.
 */
const admitted = (
  attempt: Pick<ExamAttemptsDoc, "_id" | "deadline" | "state">,
  serverNow: number
): EnterReply => ({
  attempt: attempt._id,
  deadline: attempt.deadline,
  outcome: "admitted",
  serverNow,
  state: attempt.state,
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

/** Starts the Person's attempt with this device, which then owns it. Entering starts the attempt. */
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
  return admitted(
    {
      _id: id,
      deadline: sitting.closesAt,
      state: "inProgress",
    },
    now
  );
});

/**
 * Binds an attempt that no device holds to this device, once the token has matched. Any
 * other device is refused. The device that owns the attempt was admitted, and a retired
 * device refused, before the token was checked, so neither reaches this function.
 */
const bindAttempt = Effect.fn("exams.sittings.enter.bind")(function* (
  attempt: ExamAttemptsDoc,
  deviceId: string,
  now: number
) {
  if (deviceBinding(attempt, deviceId) === "other") {
    return yield* new SecondDevice();
  }
  yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .patch(attempt._id, { deviceId })
    .pipe(Effect.orDie);
  return admitted(attempt, now);
});

/**
 * Admits a student to a sitting with its token, from one device (ADR 0013). The order is
 * fixed: the student must be in the sitting, the school and the unit must not be locked,
 * and the sitting or the attempt must be open. A device that already owns the attempt is
 * admitted here, before any try is counted or any token is checked, so a student who is
 * inside keeps working after the token changes. Every other entry needs a try left for its
 * device and for the person, and then a token that matches. A token that does not match
 * counts as a failed try of the person.
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
  if (yield* sittingLocked(sitting)) {
    return yield* new SittingLocked();
  }
  const attempt = yield* attemptOf(sitting._id, member.person._id);
  const now = yield* Clock.currentTimeMillis;
  yield* checkOpen(sitting, attempt, now);
  // The device that owns the attempt enters without the token, and a device a proctor
  // retired is refused before the token is checked, so its resume counts no failed try.
  if (Option.isSome(attempt)) {
    const binding = deviceBinding(attempt.value, args.deviceId);
    if (binding === "bound") {
      return admitted(attempt.value, now);
    }
    if (binding === "retired") {
      return yield* new DeviceRetired();
    }
  }
  if (!(yield* deviceMayTry(args.deviceId))) {
    return refused("TooManyTries");
  }
  if (!(yield* personMayFail(sitting._id, member.person._id))) {
    return refused("TooManyTries");
  }
  const keys = yield* readTenantKeys(member.tenant._id).pipe(Effect.orDie);
  const hash = yield* tokenHash(
    keys,
    sitting._id,
    normalizeToken(args.token)
  ).pipe(Effect.orDie);
  if (!(yield* matchesSecret(hash, sitting.tokenHash).pipe(Effect.orDie))) {
    yield* countFailedTry(sitting._id, member.person._id);
    return refused("TokenRefused");
  }
  if (Option.isNone(attempt)) {
    return yield* startAttempt(sitting, member.person, args.deviceId, now);
  }
  return yield* bindAttempt(attempt.value, args.deviceId, now);
});

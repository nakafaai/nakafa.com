import type { ExamSittingsDoc } from "@repo/backend/confect/_generated/docs";
import {
  type DatabaseReader,
  DatabaseWriter,
  type MutationCtx,
} from "@repo/backend/confect/_generated/services";
import {
  type Entrance,
  makeEntry,
} from "@repo/backend/confect/assessment/gate/enter";
import {
  TokenRefused,
  TooManyTries,
} from "@repo/backend/confect/assessment/gate/refusal";
import { attemptOf } from "@repo/backend/confect/exams/sittings/attempt";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import {
  mayEnter,
  sittingLocked,
} from "@repo/backend/confect/exams/sittings/eligibility";
import {
  type HeldAttempt,
  heldOf,
  readSitting,
} from "@repo/backend/confect/exams/sittings/held";
import {
  countFailedTry,
  deviceMayTry,
  personMayFail,
} from "@repo/backend/confect/exams/sittings/rate";
import { toSittingError } from "@repo/backend/confect/exams/sittings/refusal";
import {
  normalizeToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { matchesSecret } from "@repo/utilities/digest";
import { Effect, Option } from "effect";

/** The reply of an admitted entry, which the entry's gate builds from the attempt it started, bound, or resumed. */
type EnterReply = typeof EnterOutcome.Type;

/** The admitted reply of an entry, which names the attempt, its deadline, and the server's clock. */
const admitted = (
  attempt: Pick<HeldAttempt, "_id" | "deadline" | "state">,
  serverNow: number
): EnterReply => ({
  attempt: attempt._id,
  deadline: attempt.deadline,
  outcome: "admitted",
  serverNow,
  state: attempt.state,
});

/** The target of an entry: the student's Member and the sitting they want to enter. */
interface EntryTarget<M = Member["Service"]> {
  readonly member: M;
  readonly sittingId: ExamSittingsDoc["_id"];
}

/** The entrance of a student to a sitting: the sitting, when it is theirs to enter, and their attempt in it. */
const entrance = Effect.fn("exams.sittings.gate.entrance")(function* (
  target: EntryTarget
) {
  const sitting = yield* readSitting(
    target.sittingId,
    target.member.tenant._id
  );
  if (
    Option.isNone(sitting) ||
    !(yield* mayEnter(sitting.value, target.member))
  ) {
    return Option.none<Entrance<ExamSittingsDoc, HeldAttempt>>();
  }
  const held = yield* attemptOf(sitting.value._id, target.member.person._id);
  return Option.some({
    held: Option.map(held, heldOf),
    locked: yield* sittingLocked(sitting.value),
    sitting: sitting.value,
    window: { closesAt: sitting.value.closesAt, state: sitting.value.state },
  });
});

/**
 * Checks a sitting token for one device and one person: five tries a minute for the
 * device and five failed tries a minute for the person in this sitting, both checked
 * before the token. A token that does not match counts one failed try.
 */
const verifyToken = Effect.fn("exams.sittings.gate.token")(function* (
  target: EntryTarget,
  sitting: ExamSittingsDoc,
  device: string,
  token: string
) {
  if (!(yield* deviceMayTry(device))) {
    return yield* new TooManyTries();
  }
  const personId = target.member.person._id;
  if (!(yield* personMayFail(sitting._id, personId))) {
    return yield* new TooManyTries();
  }
  const keys = yield* readTenantKeys(target.member.tenant._id).pipe(
    Effect.orDie
  );
  const hash = yield* tokenHash(keys, sitting._id, normalizeToken(token)).pipe(
    Effect.orDie
  );
  if (!(yield* matchesSecret(hash, sitting.tokenHash).pipe(Effect.orDie))) {
    yield* countFailedTry(sitting._id, personId);
    return yield* new TokenRefused();
  }
});

/** Starts the student's attempt with this device, which then owns it. */
const startAttempt = Effect.fn("exams.sittings.gate.start")(function* (
  target: EntryTarget,
  sitting: ExamSittingsDoc,
  device: string,
  now: number
) {
  const id = yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .insert({
      deadline: sitting.closesAt,
      deviceId: device,
      person: target.member.person._id,
      retiredDeviceIds: [],
      sitting: sitting._id,
      startedAt: now,
      state: "inProgress",
      tenantId: sitting.tenantId,
    })
    .pipe(Effect.orDie);
  return admitted(
    { _id: id, deadline: sitting.closesAt, state: "inProgress" },
    now
  );
});

/** Binds an attempt that no device holds to this device, which then owns it. */
const bindAttempt = Effect.fn("exams.sittings.gate.bind")(function* (
  held: HeldAttempt,
  device: string,
  now: number
) {
  yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .patch(held._id, { deviceId: device })
    .pipe(Effect.orDie);
  return admitted(held, now);
});

/**
 * The sitting's entry gate: a student enters a sitting once, with its token, from one
 * device. The device that owns the attempt re-enters without a token, and a retired
 * device is refused before any try is counted (ADR 0013).
 */
const sittingEntry = makeEntry<
  EntryTarget,
  HeldAttempt,
  ExamSittingsDoc,
  EnterReply,
  never,
  DatabaseReader | DatabaseWriter | MutationCtx
>({
  bind: bindAttempt,
  entrance,
  resume: (held: HeldAttempt, now: number) =>
    Effect.succeed(admitted(held, now)),
  start: startAttempt,
  verify: verifyToken,
});

/** A refusal of the token or of the tries, which the reply carries as a value. */
const refused = (reason: "TokenRefused" | "TooManyTries"): EnterReply => ({
  outcome: "refused",
  reason,
});

/**
 * Admits a student to a sitting with its token, from one device (ADR 0013). The entry gate
 * decides the order: the student must be in the sitting, its school and unit must not be
 * locked, the sitting or the attempt must be open, and a retired device is refused before
 * any token is checked. A token that does not match, or too many tries, is a refused reply,
 * and the failed try it counts stays in the database. A device other than the bound one is
 * refused once its token verifies.
 */
export const enter = Effect.fn("exams.sittings.enter")(function* (args: {
  deviceId: string;
  sittingId: ExamSittingsDoc["_id"];
  token: string;
}) {
  const member = yield* Member;
  return yield* sittingEntry
    .enter({
      device: args.deviceId,
      target: { member, sittingId: args.sittingId },
      token: args.token,
    })
    .pipe(
      Effect.catchTags({
        AttemptRefused: (refusal) => Effect.fail(toSittingError(refusal)),
        TokenRefused: () => Effect.succeed(refused("TokenRefused")),
        TooManyTries: () => Effect.succeed(refused("TooManyTries")),
      })
    );
});

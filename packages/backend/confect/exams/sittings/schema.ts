import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Id } from "@repo/backend/confect/_generated/id";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { Sealed } from "@repo/backend/confect/vault/schema";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/** The most characters a room's name may hold, counted as Unicode code points. */
const ROOM_NAME_MAX_LENGTH = 80;

/** The most devices an attempt retires, so `retiredDeviceIds` stays small (ADR 0013). */
export const RETIRED_DEVICE_LIMIT = 10;

/** The most minutes that one added-minutes action gives an attempt (ADR 0013). */
const ADD_MINUTES_MAX = 120;

/** A room's name: one line with no space at either end, at most 80 characters. */
export const RoomName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1),
  Schema.isMaxCodePoints(ROOM_NAME_MAX_LENGTH)
);

/**
 * The group a sitting runs for: one unit of the school, or one cohort of a unit
 * (ADR 0013). A cohort names its unit through the cohort row, so the caller gives
 * only the cohort.
 */
export const SittingGroup = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("unit"), unitId: Id("tenantUnits") }),
  Schema.Struct({
    cohortId: Id("tenantCohorts"),
    kind: Schema.Literal("cohort"),
  }),
]);

/**
 * The reason that a proctor gives for a lock, an unlock, or added minutes. It is one of
 * these codes and never free text, because the journal holds codes (ADR 0016, ADR 0013).
 */
export const ReasonCode = Schema.Literals([
  "power-outage",
  "device-problem",
  "network-problem",
  "health",
  "rule-break",
  "other",
]);

/** Minutes that a proctor adds to one attempt: a whole number from one to 120 (ADR 0013). */
export const Minutes = Schema.Int.check(
  Schema.isBetween({ maximum: ADD_MINUTES_MAX, minimum: 1 })
);

/** A device, as the web names it: the UUID that the browser keeps for one sitting. */
export const DeviceId = Schema.String.check(
  Schema.isPattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
  )
);

/**
 * The state of a sitting. The server opens it at its scheduled time and closes it at
 * its scheduled time or when a proctor closes it (ADR 0013).
 */
export const SittingState = Schema.Literals(["scheduled", "open", "closed"]);

/** The ID of one scheduled job, which the scheduler returns and cancels. */
const JobId = Id("_scheduled_functions");

/**
 * One proctored sitting: one run of an exam for one unit or one cohort, in one room,
 * with one token. The row names its unit in every case, so a unit grant covers it. A
 * unit sitting holds `null` as its cohort, so the group's indexes need no join. The token
 * is kept as a keyed hash that checks it, and sealed under the school key so a proctor
 * can read it again (ADR 0013, ADR 0030).
 */
export const examSittingValidator = Schema.Struct({
  closesAt: Schema.Finite,
  cohortId: Schema.NullOr(Id("tenantCohorts")),
  examId: Id("exams"),
  jobs: Schema.Array(JobId),
  opensAt: Schema.Finite,
  resultsReleasedAt: Schema.optionalKey(Schema.Finite),
  resultsReleasedBy: Schema.optionalKey(Id("tenantPeople")),
  room: RoomName,
  /** The Person who scheduled the sitting, when a Person did; a room a system scheduled has none. */
  scheduledBy: Schema.optionalKey(Id("tenantPeople")),
  state: SittingState,
  tenantId: Id("tenants"),
  tokenHash: Schema.String,
  tokenIssuedAt: Schema.Finite,
  tokenSealed: Sealed,
  unitId: Id("tenantUnits"),
});

/**
 * One student's response to one question of an attempt: the option IDs that the student
 * chose. An answer replaces the row of its question, so each question holds one row
 * (ADR 0013).
 */
export const examAnswerValidator = Schema.Struct({
  answeredAt: Schema.Finite,
  attempt: Id("examAttempts"),
  question: Id("examQuestions"),
  response: Schema.Array(LocalIdSchema),
  tenantId: Id("tenants"),
  /** The version the learner's client numbered this answer with; a stale write never replaces it (ADR 0013). */
  version: Version,
});

/**
 * The state of one student's attempt in a sitting (ADR 0013). Entering the sitting starts
 * the attempt in progress, and `submitted` closes the attempt for good.
 */
export const AttemptState = Schema.Literals([
  "inProgress",
  "locked",
  "closing",
  "submitted",
]);

/**
 * One student's attempt in a sitting. It starts with the sitting's close as its
 * deadline, and it is bound to the device that first enters it. `deviceId` is `null`
 * while a proctor has allowed another device and none has entered yet. `retiredDeviceIds`
 * lists the devices that a proctor has retired, which may no longer write (ADR 0013).
 */
export const examAttemptValidator = Schema.Struct({
  closeJob: Schema.optionalKey(JobId),
  deadline: Schema.Finite,
  deviceId: Schema.NullOr(DeviceId),
  person: Id("tenantPeople"),
  retiredDeviceIds: Schema.Array(DeviceId).check(
    Schema.isMaxLength(RETIRED_DEVICE_LIMIT)
  ),
  sitting: Id("examSittings"),
  startedAt: Schema.Finite,
  state: AttemptState,
  submittedAt: Schema.optionalKey(Schema.Finite),
  tenantId: Id("tenants"),
});

/**
 * The integrity signals that an attempt records (ADR 0013). A signal flags something
 * for a proctor to read, and it never locks an attempt by itself.
 */
export const SignalKind = Schema.Literals([
  "exit",
  "blur",
  "fullscreenExit",
  "copy",
  "paste",
  "secondTab",
  "disconnect",
  "return",
]);

/**
 * One integrity signal of an attempt, with the time it was recorded. No camera, face,
 * voice, or emotion data is stored (K14).
 */
export const examSignalValidator = Schema.Struct({
  at: Schema.Finite,
  attempt: Id("examAttempts"),
  kind: SignalKind,
  tenantId: Id("tenants"),
});

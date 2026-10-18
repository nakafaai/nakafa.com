import { Id } from "@repo/backend/confect/_generated/id";
import { isSingleLine } from "@repo/utilities/line";
import { Schema } from "effect";

/**
 * The group a sitting runs for: one unit of the school, or one cohort of a unit's
 * period (ADR 0013). A sitting holds exactly one of the two.
 */
const SittingGroup = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("unit"), unitId: Id("tenantUnits") }),
  Schema.Struct({
    cohortId: Id("tenantCohorts"),
    kind: Schema.Literal("cohort"),
  }),
]);

/** The room a sitting is held in: one line with no space at either end. */
const RoomName = Schema.String.check(
  Schema.isTrimmed(),
  isSingleLine,
  Schema.isMinLength(1)
);

/**
 * The state of a sitting. The server opens it and closes it at its scheduled times,
 * and a proctor can close it earlier (ADR 0013).
 */
const SittingState = Schema.Literals(["scheduled", "open", "closed"]);

/**
 * One proctored sitting: one run of an exam for one group in one room, with one
 * token. The token is kept only as a keyed hash of the school key (ADR 0013, ADR 0030).
 */
export const examSittingValidator = Schema.Struct({
  closesAt: Schema.Finite,
  examId: Id("exams"),
  group: SittingGroup,
  opensAt: Schema.Finite,
  room: RoomName,
  state: SittingState,
  tenantId: Id("tenants"),
  tokenHash: Schema.String,
  tokenIssuedAt: Schema.Finite,
});

/**
 * The state of one student's attempt in a sitting (ADR 0013). `ready` comes before
 * the student starts, and `submitted` closes the attempt for good.
 */
const AttemptState = Schema.Literals([
  "ready",
  "inProgress",
  "locked",
  "closing",
  "submitted",
]);

/**
 * One student's attempt in a sitting. Its device is the client-generated UUID that the
 * web keeps for the sitting, and it is set when the student first enters (ADR 0013).
 */
export const examAttemptValidator = Schema.Struct({
  deadline: Schema.Finite,
  deviceId: Schema.optionalKey(Schema.String),
  person: Id("tenantPeople"),
  sitting: Id("examSittings"),
  startedAt: Schema.optionalKey(Schema.Finite),
  state: AttemptState,
  submittedAt: Schema.optionalKey(Schema.Finite),
  tenantId: Id("tenants"),
});

/**
 * The integrity signals that an attempt records (ADR 0013). A signal flags something
 * for a proctor to read, and it never locks an attempt by itself.
 */
const SignalKind = Schema.Literals([
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

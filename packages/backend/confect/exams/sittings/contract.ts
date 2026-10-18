import { Id } from "@repo/backend/confect/_generated/id";
import {
  AttemptState,
  RoomName,
  SignalKind,
  SittingState,
} from "@repo/backend/confect/exams/sittings/schema";
import { PersonName } from "@repo/backend/confect/tenancy/schema";
import { MascotCode } from "@repo/mascot/code";
import { Schema } from "effect";

/**
 * The wire contracts of the sitting functions. A spec imports them, so this module holds
 * declarations only: no database read, no write, and no scheduler.
 */

/**
 * The reply to an entry that the server answers: admitted to an attempt, or refused for
 * its token or its tries. A refusal is a value, not an error, so the failed try that it
 * counts stays in the database when the reply is sent (ADR 0013).
 */
export const EnterOutcome = Schema.Union([
  Schema.Struct({
    attempt: Id("examAttempts"),
    deadline: Schema.Finite,
    outcome: Schema.Literal("admitted"),
    state: AttemptState,
  }),
  Schema.Struct({
    outcome: Schema.Literal("refused"),
    reason: Schema.Literals(["TokenRefused", "TooManyTries"]),
  }),
]);

/**
 * One sitting as a dashboard and a student's list show it. The view holds no token, no
 * token hash, and no scheduled job, so a read never returns them (ADR 0013).
 */
export const SittingView = Schema.Struct({
  closesAt: Schema.Finite,
  cohortId: Schema.NullOr(Id("tenantCohorts")),
  examId: Id("exams"),
  id: Id("examSittings"),
  opensAt: Schema.Finite,
  room: RoomName,
  state: SittingState,
  unitId: Id("tenantUnits"),
});

/** One attempt on the dashboard: its student, its state and deadline, and whether the student is away. */
const DashboardAttempt = Schema.Struct({
  away: Schema.Boolean,
  deadline: Schema.Finite,
  id: Id("examAttempts"),
  latestSignal: Schema.NullOr(
    Schema.Struct({ at: Schema.Finite, kind: SignalKind })
  ),
  mascot: Schema.NullOr(MascotCode),
  name: PersonName,
  state: AttemptState,
});

/** One page of a sitting's attempts, with the sitting itself. */
export const DashboardView = Schema.Struct({
  attempts: Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: Schema.mutable(Schema.Array(DashboardAttempt)),
  }),
  sitting: SittingView,
});

/** What scheduling returns: the sitting, and its token, which only the proctor sees. */
export const ScheduleResult = Schema.Struct({
  id: Id("examSittings"),
  token: Schema.String,
});

/** The new token that a proctor gets when it is changed, which only the proctor sees. */
export const TokenResult = Schema.Struct({ token: Schema.String });

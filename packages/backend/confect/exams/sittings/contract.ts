import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { Id } from "@repo/backend/confect/_generated/id";
import { entries } from "@repo/backend/confect/access/catalog";
import { Kind } from "@repo/backend/confect/access/kind";
import { ExamTitle } from "@repo/backend/confect/exams/exam";
import {
  AttemptState,
  RoomName,
  SignalKind,
  SittingState,
} from "@repo/backend/confect/exams/sittings/schema";
import { TimeZone } from "@repo/backend/confect/tenancy/locale";
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
    /** The server's clock when it admitted the device, so the screen can count down on server time. */
    serverNow: Schema.Finite,
    state: AttemptState,
  }),
  Schema.Struct({
    outcome: Schema.Literal("refused"),
    reason: Schema.Literals(["TokenRefused", "TooManyTries"]),
  }),
]);

/** The sitting actions that a caller may take, which the server computes for each sitting. */
export const SittingAction = Kind.actions(entries, "sitting");

/**
 * One sitting as a dashboard and a student's list show it: its own fields, the title of its
 * exam, and the time zone of its unit, which the sitting's times are read in.
 */
export const SittingView = Schema.Struct({
  closesAt: Schema.Finite,
  cohortId: Schema.NullOr(Id("tenantCohorts")),
  examId: Id("exams"),
  examTitle: ExamTitle,
  id: Id("examSittings"),
  opensAt: Schema.Finite,
  room: RoomName,
  state: SittingState,
  timeZone: TimeZone,
  unitId: Id("tenantUnits"),
});

/**
 * One attempt on the dashboard: its student, its state and deadline, whether the student is away, and
 * the time of the student's start or latest signal. The latest answer is read per seat, through
 * `lastAnswer`, so the page re-runs for signals only.
 */
const DashboardAttempt = Schema.Struct({
  away: Schema.Boolean,
  deadline: Schema.Finite,
  id: Id("examAttempts"),
  lastActiveAt: Schema.Finite,
  latestSignal: Schema.NullOr(
    Schema.Struct({ at: Schema.Finite, kind: SignalKind })
  ),
  mascot: Schema.NullOr(MascotCode),
  name: PersonName,
  state: AttemptState,
});

/**
 * One page of a sitting's attempts, with the sitting itself. `can` lists the sitting actions
 * that the caller may take, `canViewResults` tells whether the caller may read the sitting's
 * results, and `token` is the sitting's token, which only a proctor sees (`null` for a caller
 * who may only view the sitting).
 */
export const DashboardView = Schema.Struct({
  attempts: Schema.Struct({
    continueCursor: Schema.String,
    isDone: Schema.Boolean,
    page: Schema.mutable(Schema.Array(DashboardAttempt)),
  }),
  can: Schema.Array(SittingAction),
  canViewResults: Schema.Boolean,
  sitting: SittingView,
  token: Schema.NullOr(Schema.String),
});

/** What scheduling returns: the sitting, and its token, which only the proctor sees. */
export const ScheduleResult = Schema.Struct({
  id: Id("examSittings"),
  token: Schema.String,
});

/** The new token that a proctor gets when it is changed, which only the proctor sees. */
export const TokenResult = Schema.Struct({ token: Schema.String });

/** The student's own attempt in a sitting, as the student's screen follows it, or `null` before entry. */
export const HeldAttempt = Schema.Struct({
  deadline: Schema.Finite,
  id: Id("examAttempts"),
  startedAt: Schema.Finite,
  state: AttemptState,
});

/**
 * One sitting as its student sees it: the sitting, and the attempt the student holds in it,
 * whatever the attempt's state, so a reload after a close or a finish still shows how the
 * attempt ended. A student who holds no attempt yet gets `null`.
 */
export const StudentSittingView = Schema.Struct({
  attempt: Schema.NullOr(HeldAttempt),
  sitting: SittingView,
});

/**
 * One sitting in a student's list: the sitting as `SittingView` shows it, the student's own attempt and its
 * state in it (both `null` before entry), and whether the teacher has released its results. A closed sitting
 * stays in the list while the student's attempt in it is closing or submitted, so the results stay reachable.
 */
export const StudentSittingRow = Schema.Struct({
  ...SittingView.fields,
  attempt: Schema.NullOr(AttemptState),
  attemptId: Schema.NullOr(Id("examAttempts")),
  resultsReleased: Schema.Boolean,
});

/** One integrity signal of an attempt, as a proctor reads it, newest first in its pages. */
export const SignalView = Schema.Struct({
  at: Schema.Finite,
  kind: SignalKind,
});

/**
 * One question of a student's paper: its number in the exam, its interactions without any answer
 * key, and the response that the student saved, or `null` when none is saved yet. Its prompt is
 * read on its own, by `PromptView`, so the paper stays small.
 */
const PaperQuestion = Schema.Struct({
  id: Id("examQuestions"),
  interactions: Schema.NonEmptyArray(InteractionSchema),
  number: Schema.Int.check(Schema.isGreaterThan(0)),
  response: Schema.NullOr(Schema.Array(LocalIdSchema)),
});

/** The questions of a student's paper, in the order of the exam. */
export const PaperView = Schema.Struct({
  questions: Schema.Array(PaperQuestion),
});

/**
 * One question's prompt as the document stands now, which is the editor's stored text with every
 * edit after its snapshot applied (ADR 0028).
 */
export const PromptView = Schema.Struct({
  prompt: Schema.String,
});

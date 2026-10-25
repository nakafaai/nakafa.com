import type {
  ExamAttemptsDoc,
  ExamQuestionsDoc,
  ExamSittingsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  DatabaseReader,
  DatabaseWriter,
  type MutationCtx,
  type Scheduler,
} from "@repo/backend/confect/_generated/services";
import examAnswers from "@repo/backend/confect/_generated/tables/examAnswers";
import examAttempts from "@repo/backend/confect/_generated/tables/examAttempts";
import examQuestions from "@repo/backend/confect/_generated/tables/examQuestions";
import tenantPeople from "@repo/backend/confect/_generated/tables/tenantPeople";
import { make } from "@repo/backend/confect/assessment/gate/admit";
import {
  type Entrance,
  makeEntry,
} from "@repo/backend/confect/assessment/gate/enter";
import {
  TokenRefused,
  TooManyTries,
} from "@repo/backend/confect/assessment/gate/refusal";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import {
  Binding,
  type Candidate,
} from "@repo/backend/confect/assessment/gate/store";
import { recordResults } from "@repo/backend/confect/exams/results/record";
import type { SittingWithExam } from "@repo/backend/confect/exams/sittings/access";
import { attemptOf } from "@repo/backend/confect/exams/sittings/attempt";
import {
  sittingAuthority,
  withExam,
} from "@repo/backend/confect/exams/sittings/authority";
import type { EnterOutcome } from "@repo/backend/confect/exams/sittings/contract";
import {
  mayEnter,
  sittingLocked,
} from "@repo/backend/confect/exams/sittings/eligibility";
import {
  NotInSitting,
  QuestionNotInExam,
  SittingLocked,
} from "@repo/backend/confect/exams/sittings/errors";
import {
  countFailedTry,
  deviceMayTry,
  personMayFail,
} from "@repo/backend/confect/exams/sittings/rate";
import { AttemptState } from "@repo/backend/confect/exams/sittings/schema";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import {
  normalizeToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { readTenantKeys } from "@repo/backend/confect/vault/keys";
import { matchesSecret } from "@repo/utilities/digest";
import { Array as Arr, Effect, Option, Schema } from "effect";

/** The reply of an admitted entry, which the entry's gate builds from the attempt it started, bound, or resumed. */
export type EnterReply = typeof EnterOutcome.Type;

/** The attempt of a sitting as the gate reads it: its ID, its device binding, deadline and state. */
const HeldAttempt = Schema.Struct({
  _id: Id("examAttempts"),
  binding: Binding,
  deadline: Schema.Finite,
  state: AttemptState,
});
type HeldAttempt = typeof HeldAttempt.Type;

/** The question that a learner answers or flags, in the sitting the attempt belongs to. */
const AnswerTarget = Schema.Struct({
  person: tenantPeople.Doc,
  questionId: Id("examQuestions"),
  sittingId: Id("examSittings"),
  tenantId: Id("tenants"),
});
type AnswerTarget = typeof AnswerTarget.Type;

/** The attempt that a finish, a signal, or a paper read belongs to, which the caller holds. */
const SectionTarget = Schema.Struct({
  attemptId: Id("examAttempts"),
  person: tenantPeople.Doc,
  tenantId: Id("tenants"),
});
type SectionTarget = typeof SectionTarget.Type;

/** The checked context of an answer or a flag: the attempt, its question, and the saved answer of that question. */
const Answering = Schema.Struct({
  attempt: examAttempts.Doc,
  question: examQuestions.Doc,
  stored: Schema.Option(examAnswers.Doc),
  version: Schema.Option(Version),
});
type Answering = typeof Answering.Type;

/** The checked context of a finish, a signal, or a paper read: the attempt, its sitting with the exam, and the student's Person. */
interface Sectioned<Sitting = SittingWithExam> {
  readonly attempt: ExamAttemptsDoc;
  readonly person: TenantPeopleDoc;
  readonly sitting: Sitting;
}

/** The device binding of an attempt: the device that owns it, or none while a proctor allows another. */
const bindingOf = (
  attempt: Pick<ExamAttemptsDoc, "deviceId" | "retiredDeviceIds">
): Binding =>
  attempt.deviceId === null
    ? { kind: "unbound", retired: attempt.retiredDeviceIds }
    : {
        device: attempt.deviceId,
        kind: "bound",
        retired: attempt.retiredDeviceIds,
      };

/** The attempt as the gate reads it, with its ID. */
const heldOf = (row: ExamAttemptsDoc): HeldAttempt => ({
  _id: row._id,
  binding: bindingOf(row),
  deadline: row.deadline,
  state: row.state,
});

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

/** The sitting of the tenant, or none: another school's sitting is none. */
const readSitting = Effect.fn("exams.sittings.gate.sitting")(function* (
  sittingId: ExamSittingsDoc["_id"],
  tenantId: ExamSittingsDoc["tenantId"]
) {
  const found = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(sittingId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
  return Option.filter(found, (sitting) => sitting.tenantId === tenantId);
});

/** An attempt by its ID, or none. */
const readAttempt = Effect.fn("exams.sittings.gate.attempt")(function* (
  attemptId: ExamAttemptsDoc["_id"]
) {
  return yield* (yield* DatabaseReader)
    .table("examAttempts")
    .get(attemptId)
    .pipe(Effect.catchTag("DocumentDecodeError", Effect.die), Effect.option);
});

/** The question row and the answer saved for it in this attempt, with the version of that answer. */
const loadAnswering = Effect.fn("exams.sittings.gate.answering")(function* (
  attempt: ExamAttemptsDoc,
  questionId: ExamQuestionsDoc["_id"]
) {
  const reader = yield* DatabaseReader;
  const question = yield* reader
    .table("examQuestions")
    .get(questionId)
    .pipe(Effect.orDie);
  const stored = yield* reader
    .table("examAnswers")
    .index("by_attemptId_and_questionId", (query) =>
      query.eq("attempt", attempt._id).eq("question", questionId)
    )
    .first()
    .pipe(Effect.orDie);
  return {
    attempt,
    question,
    stored,
    version: Option.map(stored, (answer) => answer.version),
  } satisfies Answering;
});

/** A question is answered only when the exam of its sitting holds it. */
const verifyQuestion = (
  sitting: SittingWithExam,
  questionId: ExamQuestionsDoc["_id"]
) =>
  Arr.contains(sitting.exam.questions, questionId)
    ? Effect.void
    : Effect.fail(new QuestionNotInExam());

/**
 * The target of an answer or a flag: the caller's own attempt in the sitting. A locked
 * place refuses it before any attempt rule, as the sitting's lock always did.
 */
export const placementOf = Effect.fn("exams.sittings.gate.placement")(
  function* (target: AnswerTarget) {
    const sitting = yield* readSitting(target.sittingId, target.tenantId);
    if (Option.isNone(sitting)) {
      return Option.none<
        Candidate<Answering, QuestionNotInExam | SittingLocked, never>
      >();
    }
    const held = yield* attemptOf(sitting.value._id, target.person._id);
    if (Option.isNone(held)) {
      return Option.none<
        Candidate<Answering, QuestionNotInExam | SittingLocked, never>
      >();
    }
    if (yield* sittingLocked(sitting.value)) {
      return yield* new SittingLocked();
    }
    const withSitting = yield* withExam(sitting.value);
    return Option.some({
      attempt: heldOf(held.value),
      owner: held.value.person,
      section: Effect.succeedSome({
        deadline: held.value.deadline,
        live: loadAnswering(held.value, target.questionId),
        verify: verifyQuestion(withSitting, target.questionId),
      }),
    });
  }
);

/**
 * The target of a finish, a signal, or a paper read: an attempt of the caller's own, in
 * a school that is not locked. Another student's attempt is none, so it never reads a
 * lock or a sitting that the caller does not hold.
 */
export const sectionOf = Effect.fn("exams.sittings.gate.section")(function* (
  target: SectionTarget
) {
  const found = yield* readAttempt(target.attemptId);
  const row = Option.filter(
    found,
    (attempt) =>
      attempt.tenantId === target.tenantId &&
      attempt.person === target.person._id
  );
  if (Option.isNone(row)) {
    return Option.none<Candidate<Sectioned, SittingLocked, never>>();
  }
  const sitting = yield* (yield* DatabaseReader)
    .table("examSittings")
    .get(row.value.sitting)
    .pipe(Effect.orDie);
  if (yield* sittingLocked(sitting)) {
    return yield* new SittingLocked();
  }
  const withSitting = yield* withExam(sitting);
  return Option.some({
    attempt: heldOf(row.value),
    owner: row.value.person,
    section: Effect.succeedSome({
      deadline: row.value.deadline,
      live: Effect.succeed({
        attempt: row.value,
        person: target.person,
        sitting: withSitting,
      }),
      verify: Effect.void,
    }),
  });
});

/**
 * The section of the caller's own attempt in a sitting. A student who holds no attempt in
 * it is not in the sitting, so the lookup refuses with `NotInSitting` before the gate runs.
 */
export const heldSection = Effect.fn("exams.sittings.gate.held")(function* (
  sittingId: ExamSittingsDoc["_id"],
  member: Member["Service"]
) {
  const held = yield* attemptOf(sittingId, member.person._id);
  if (Option.isNone(held)) {
    return yield* new NotInSitting();
  }
  return {
    attemptId: held.value._id,
    person: member.person,
    tenantId: member.tenant._id,
  } satisfies SectionTarget;
});

/** Saves one answer, replacing the row of its question, with the version that the gate admitted. */
const storeAnswer = Effect.fn("exams.sittings.gate.answer.store")(function* (
  live: Answering,
  response: readonly string[],
  now: number,
  version: Version
) {
  const writer = yield* DatabaseWriter;
  if (Option.isSome(live.stored)) {
    yield* writer
      .table("examAnswers")
      .patch(live.stored.value._id, { answeredAt: now, response, version })
      .pipe(Effect.orDie);
    return;
  }
  yield* writer
    .table("examAnswers")
    .insert({
      answeredAt: now,
      attempt: live.attempt._id,
      question: live.question._id,
      response,
      tenantId: live.attempt.tenantId,
      version,
    })
    .pipe(Effect.orDie);
});

/** Ends the attempt as submitted: its pending close is cancelled, and the journal records the Person's finish. */
const storeFinish = Effect.fn("exams.sittings.gate.finish.store")(function* (
  live: Sectioned,
  now: number
) {
  const { attempt, person, sitting } = live;
  if (attempt.closeJob !== undefined) {
    yield* cancelPending(attempt.closeJob);
  }
  yield* (yield* DatabaseWriter)
    .table("examAttempts")
    .patch(attempt._id, { state: "submitted", submittedAt: now })
    .pipe(Effect.orDie);
  yield* recordResults(attempt, sitting);
  yield* sittingAuthority.record(personActor(person), sitting, {
    attempt: attempt._id,
    type: "sitting.finish",
  });
});

/**
 * The sitting's write gate: every answer, flag, finish, and signal of a student passes
 * through its one guard sequence (ADR 0013). The store's failures are the sitting's
 * own refusals, and the gate's own refusals are mapped to the sitting's errors at the
 * functions that call it.
 */
export const sittingGate = make<
  AnswerTarget,
  SectionTarget,
  Answering,
  Sectioned,
  readonly string[],
  QuestionNotInExam | SittingLocked,
  DatabaseReader | DatabaseWriter | Scheduler
>({
  answer: storeAnswer,
  finish: (live, _reason, now) => storeFinish(live, now),
  placement: placementOf,
  section: sectionOf,
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
export const sittingEntry = makeEntry<
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

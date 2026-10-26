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
  type Scheduler,
} from "@repo/backend/confect/_generated/services";
import examAnswers from "@repo/backend/confect/_generated/tables/examAnswers";
import examAttempts from "@repo/backend/confect/_generated/tables/examAttempts";
import examQuestions from "@repo/backend/confect/_generated/tables/examQuestions";
import tenantPeople from "@repo/backend/confect/_generated/tables/tenantPeople";
import { make } from "@repo/backend/confect/assessment/gate/admit";
import { Version } from "@repo/backend/confect/assessment/gate/rules";
import type { Candidate } from "@repo/backend/confect/assessment/gate/store";
import { recordResults } from "@repo/backend/confect/exams/results/record";
import type { SittingWithExam } from "@repo/backend/confect/exams/sittings/access";
import { attemptOf } from "@repo/backend/confect/exams/sittings/attempt";
import {
  sittingAuthority,
  withExam,
} from "@repo/backend/confect/exams/sittings/authority";
import { sittingLocked } from "@repo/backend/confect/exams/sittings/eligibility";
import {
  NotInSitting,
  QuestionNotInExam,
  SittingLocked,
} from "@repo/backend/confect/exams/sittings/errors";
import { heldOf, readSitting } from "@repo/backend/confect/exams/sittings/held";
import { cancelPending } from "@repo/backend/confect/exams/sittings/timers";
import type { Member } from "@repo/backend/confect/middleware/member.spec";
import { personActor } from "@repo/backend/confect/tenancy/actor";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { ExamResponse } from "@repo/backend/confect/exams/sittings/response";

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
  response: ExamResponse,
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
  ExamResponse,
  QuestionNotInExam | SittingLocked,
  DatabaseReader | DatabaseWriter | Scheduler
>({
  answer: storeAnswer,
  finish: (live, _reason, now) => storeFinish(live, now),
  placement: placementOf,
  section: sectionOf,
});

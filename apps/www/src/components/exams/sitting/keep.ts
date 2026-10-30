import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { ExamResponse } from "@repo/backend/confect/exams/sittings/response";
import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import { isFinalRefusal } from "@/components/exams/sitting/entry";

/**
 * The browser's kept state of a sitting attempt, which holds the answers until the server holds them. Flags are
 * the server's, so the browser keeps none.
 * An entry leaves the browser in one of two ways. The student's finish drops it once the server confirms the
 * finish, and the student's home drops the entries of the attempts that its list shows as submitted, because
 * the list comes from the server. An entry for an attempt that no list shows as submitted stays until the
 * browser clears its storage. Dropping it sooner could lose answers that the server has not confirmed, and
 * the storage cannot list its keys to find the entries of the sittings that a list no longer shows.
 */

/**
 * One answer that the browser keeps until the server confirms it: the response the student chose or typed, the version
 * the answer was numbered with, and the device time it was chosen at, which names the answer when the server
 * confirms it.
 */
const KeptAnswer = Schema.Struct({
  answeredAt: Schema.Finite,
  response: ExamResponse,
  version: Version,
});
type KeptAnswer = typeof KeptAnswer.Type;

/**
 * What the browser keeps for one attempt: the answers that the server has not confirmed, by question.
 */
export const KeptAttempt = Schema.Struct({
  answers: Schema.Record(Schema.String, KeptAnswer),
});
export type KeptAttempt = typeof KeptAttempt.Type;

/** What the browser keeps for an attempt that it keeps nothing for. */
const NOTHING_KEPT: KeptAttempt = { answers: {} };

/** The stored text of one attempt's kept state, which decodes back to the same value. */
const KeptJson = Schema.fromJsonString(KeptAttempt);

/** The key of the one entry that keeps an attempt, which names its sitting and the attempt. */
const keyOf = (sittingId: string, attemptId: string) =>
  `nakafa-sitting-kept:${sittingId}:${attemptId}`;

/** Keeps one answer for a question, in place of the answer kept for it before. */
export function keepAnswerIn(
  kept: KeptAttempt,
  questionId: string,
  answer: KeptAnswer
): KeptAttempt {
  return { ...kept, answers: { ...kept.answers, [questionId]: answer } };
}

/**
 * Drops the answer kept for a question once the server confirms the answer sent at `answeredAt`. An
 * answer chosen after that one stays kept, because the server has not confirmed it yet.
 */
export function confirmAnswerIn(
  kept: KeptAttempt,
  questionId: string,
  answeredAt: number
): KeptAttempt {
  return Option.match(Rec.get(questionId)(kept.answers), {
    onNone: () => kept,
    onSome: (stored) =>
      stored.answeredAt === answeredAt
        ? { ...kept, answers: Rec.remove(kept.answers, questionId) }
        : kept,
  });
}

/**
 * The kept answers of one paper, in the paper's question order. Only a question that the paper holds gets its
 * kept answer back, so an answer kept for another paper is never sent.
 */
export function keptAnswersFor<Question extends string>(
  kept: KeptAttempt,
  questionIds: readonly Question[]
) {
  return Arr.getSomes(
    Arr.map(questionIds, (questionId) =>
      Option.map(Rec.get(questionId)(kept.answers), (answer) => ({
        answer,
        questionId,
      }))
    )
  );
}

/**
 * Reads what the browser keeps for an attempt. A browser that keeps nothing, or an entry that no longer
 * decodes, reads as nothing kept, and the next write replaces the entry.
 */
export const readKept = Effect.fn("exams.sitting.keep.read")(function* (
  sittingId: string,
  attemptId: string
) {
  const store = yield* KeyValueStore.KeyValueStore;
  const stored = yield* store.get(keyOf(sittingId, attemptId));
  return Option.getOrElse(
    Option.flatMap(Option.fromNullishOr(stored), (text) =>
      Schema.decodeOption(KeptJson)(text)
    ),
    () => NOTHING_KEPT
  );
});

/**
 * The response that the browser keeps for one question, which the server has not confirmed yet. A field the
 * student types in opens with it, so the keys typed before a reload or a closed tab show again while the
 * kept answer is sent again.
 */
export const readKeptResponse = Effect.fn("exams.sitting.keep.response")(
  function* (sittingId: string, attemptId: string, questionId: string) {
    const kept = yield* readKept(sittingId, attemptId);
    return Option.map(
      Rec.get(questionId)(kept.answers),
      (answer) => answer.response
    );
  }
);

/** Writes what the browser keeps for an attempt after one change, read and written in turn. */
const change = Effect.fn("exams.sitting.keep.change")(function* (
  sittingId: string,
  attemptId: string,
  update: (kept: KeptAttempt) => KeptAttempt
) {
  const kept = yield* readKept(sittingId, attemptId);
  const store = yield* KeyValueStore.KeyValueStore;
  const text = yield* Schema.encodeEffect(KeptJson)(update(kept)).pipe(
    Effect.orDie
  );
  yield* store.set(keyOf(sittingId, attemptId), text);
});

/** Keeps an answer before it is sent, so a reload or a closed tab sends it again. */
export const keepAnswer = Effect.fn("exams.sitting.keep.answer")(
  (
    sittingId: string,
    attemptId: string,
    questionId: string,
    answer: KeptAnswer
  ) =>
    change(sittingId, attemptId, (kept) =>
      keepAnswerIn(kept, questionId, answer)
    )
);

/** Drops an answer once the server has confirmed it, or refused it for good. */
export const confirmAnswer = Effect.fn("exams.sitting.keep.confirm")(
  (
    sittingId: string,
    attemptId: string,
    questionId: string,
    answeredAt: number
  ) =>
    change(sittingId, attemptId, (kept) =>
      confirmAnswerIn(kept, questionId, answeredAt)
    )
);

/** Drops everything the browser keeps for an attempt, once the attempt is submitted. */
export const forgetAttempt = Effect.fn("exams.sitting.keep.forget")(function* (
  sittingId: string,
  attemptId: string
) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.remove(keyOf(sittingId, attemptId));
});

/**
 * The sitting and the attempt of each row of a student's list that shows its attempt as submitted, which
 * name the kept state that the browser may drop. A row with no attempt, or with one still open, names none.
 */
export function submittedKeysOf<Sitting, Attempt>(
  rows: readonly {
    readonly attempt: string | null;
    readonly attemptId: Attempt | null;
    readonly id: Sitting;
  }[]
) {
  return Arr.getSomes(
    Arr.map(rows, (row) =>
      row.attempt === "submitted" && row.attemptId !== null
        ? Option.some({ attemptId: row.attemptId, sittingId: row.id })
        : Option.none()
    )
  );
}

/**
 * Settles the answer that the browser keeps once its send ends, and resolves to the failure that the student
 * is told about, or to none when the server took the answer. A success runs `confirm`, and so does a final
 * refusal, such as a stale version, because the server will not take that answer later either. A refusal for
 * a lock, and any other failure, keeps the answer for the next visit to the paper to send again.
 */
export const settleSent = Effect.fn("exams.sitting.keep.settle")(function* <
  E,
  R,
>(sent: Effect.Effect<unknown, E>, confirm: Effect.Effect<void, never, R>) {
  const result = yield* Effect.result(sent);
  if (Result.isSuccess(result)) {
    yield* confirm;
    return Option.none<E>();
  }
  if (isFinalRefusal(result.failure)) {
    yield* confirm;
  }
  return Option.some(result.failure);
});

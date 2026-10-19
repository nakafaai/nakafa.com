import { LocalIdSchema } from "@nakafa/aksara-contracts/assessment/identity";
import { Array as Arr, Effect, Option, Record as Rec, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";

/**
 * One answer that the browser keeps until the server confirms it: the response the student chose, and the
 * device time it was chosen at, which names the answer when the server confirms it.
 */
const KeptAnswer = Schema.Struct({
  answeredAt: Schema.Finite,
  response: Schema.Array(LocalIdSchema),
});
type KeptAnswer = typeof KeptAnswer.Type;

/**
 * What the browser keeps for one attempt: the answers that the server has not confirmed, by question, and
 * the questions that the student flagged for review. Nothing here reaches the server.
 */
export const KeptAttempt = Schema.Struct({
  answers: Schema.Record(Schema.String, KeptAnswer),
  flagged: Schema.Array(Schema.String),
});
export type KeptAttempt = typeof KeptAttempt.Type;

/** What the browser keeps for an attempt that it keeps nothing for. */
const NOTHING_KEPT: KeptAttempt = { answers: {}, flagged: [] };

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

/** Marks a question flagged or unflagged, with each flagged question listed once. */
export function flagIn(
  kept: KeptAttempt,
  questionId: string,
  flagged: boolean
): KeptAttempt {
  const others = Arr.filter(kept.flagged, (id) => id !== questionId);
  return {
    ...kept,
    flagged: flagged ? Arr.append(others, questionId) : others,
  };
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
export const keepAnswer = (
  sittingId: string,
  attemptId: string,
  questionId: string,
  answer: KeptAnswer
) =>
  change(sittingId, attemptId, (kept) =>
    keepAnswerIn(kept, questionId, answer)
  );

/** Drops an answer once the server has confirmed it, or refused it for good. */
export const confirmAnswer = (
  sittingId: string,
  attemptId: string,
  questionId: string,
  answeredAt: number
) =>
  change(sittingId, attemptId, (kept) =>
    confirmAnswerIn(kept, questionId, answeredAt)
  );

/** Keeps whether a question is flagged for review. */
export const keepFlag = (
  sittingId: string,
  attemptId: string,
  questionId: string,
  flagged: boolean
) => change(sittingId, attemptId, (kept) => flagIn(kept, questionId, flagged));

/** Drops everything the browser keeps for an attempt, once the attempt is submitted. */
export const forgetAttempt = Effect.fn("exams.sitting.keep.forget")(function* (
  sittingId: string,
  attemptId: string
) {
  const store = yield* KeyValueStore.KeyValueStore;
  yield* store.remove(keyOf(sittingId, attemptId));
});

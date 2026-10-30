import { Version } from "@repo/backend/confect/assessment/gate/rules";
import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { KeyValueStore } from "effect/persistence";

/**
 * The answers that a player keeps in the browser until the server holds them, the School sitting's and the
 * try-out's alike. An answer is kept before it is sent, and dropped once the server confirms it or refuses it
 * for good. A reload, a closed tab, or a connection that was down or still signing in when the answer was
 * chosen therefore loses nothing: the player sends every kept answer again once its questions show. Flags are
 * the server's, so the browser keeps none.
 *
 * `response` describes the response of one answer. Each answer keeps it with the version it was numbered
 * with and the device time it was chosen at, which names the answer when the server confirms it. The store
 * gives the operations on one entry of the browser's storage, named by its key.
 */
export function keptAnswers<A, I>(response: Schema.Codec<A, I>) {
  const KeptAnswer = Schema.Struct({
    answeredAt: Schema.Finite,
    response,
    version: Version,
  });
  const KeptJson = Schema.fromJsonString(
    Schema.Struct({ answers: Schema.Record(Schema.String, KeptAnswer) })
  );
  type Kept = typeof KeptJson.Type;
  const nothing: Kept = { answers: {} };
  const decode = Schema.decodeOption(KeptJson);
  const encode = Schema.encodeEffect(KeptJson);

  return (key: string) => {
    /**
     * Reads what the entry keeps. A browser that keeps nothing, or an entry that no longer decodes, reads as
     * nothing kept, and the next write replaces the entry.
     */
    const read = Effect.fn("player.keep.read")(function* () {
      const store = yield* KeyValueStore.KeyValueStore;
      const stored = yield* store.get(key);
      return Option.getOrElse(
        Option.flatMap(Option.fromNullishOr(stored), decode),
        () => nothing
      );
    });

    /** Writes the entry after one change, read and written in turn. */
    const change = Effect.fn("player.keep.change")(function* (
      update: (kept: Kept) => Kept
    ) {
      const kept = yield* read();
      const store = yield* KeyValueStore.KeyValueStore;
      const text = yield* encode(update(kept)).pipe(Effect.orDie);
      yield* store.set(key, text);
    });

    return {
      /**
       * The kept answers of the given questions, in their order. Only a question that the caller shows gets
       * its kept answer back, so an answer kept for another paper or section is never sent.
       */
      answersFor: Effect.fn("player.keep.answersFor")(function* <
        Question extends string,
      >(questionIds: readonly Question[]) {
        const kept = yield* read();
        return Arr.getSomes(
          Arr.map(questionIds, (questionId) =>
            Option.map(Rec.get(questionId)(kept.answers), (answer) => ({
              answer,
              questionId,
            }))
          )
        );
      }),
      /**
       * Drops the answer of a question once the server confirms the one chosen at `answeredAt`, or refuses
       * it for good. An answer chosen after that one stays, because the server has not confirmed it yet.
       */
      confirm: Effect.fn("player.keep.confirm")(
        (questionId: string, answeredAt: number) =>
          change((kept) =>
            Option.match(Rec.get(questionId)(kept.answers), {
              onNone: () => kept,
              onSome: (stored) =>
                stored.answeredAt === answeredAt
                  ? { answers: Rec.remove(kept.answers, questionId) }
                  : kept,
            })
          )
      ),
      /** Drops everything the entry keeps. */
      forget: Effect.fn("player.keep.forget")(function* () {
        const store = yield* KeyValueStore.KeyValueStore;
        yield* store.remove(key);
      }),
      /** Keeps an answer before it is sent, in place of the answer kept for its question before. */
      keep: Effect.fn("player.keep.keep")(
        (questionId: string, answer: typeof KeptAnswer.Type) =>
          change((kept) => ({
            answers: { ...kept.answers, [questionId]: answer },
          }))
      ),
      read,
      /**
       * The response kept for one question, which the server has not confirmed yet. A field the student
       * types in opens with it, so the keys typed before a reload or a closed tab show again.
       */
      responseOf: Effect.fn("player.keep.responseOf")(function* (
        questionId: string
      ) {
        const kept = yield* read();
        return Option.map(
          Rec.get(questionId)(kept.answers),
          (answer) => answer.response
        );
      }),
    };
  };
}

/**
 * Settles a kept answer once its send ends, and resolves to the failure that the student is told about, or to
 * none when the server took the answer. A success runs `confirm`, and so does a refusal that `isFinal` names,
 * such as a stale version, because the server will not take that answer later either. Any other failure keeps
 * the answer for the next visit to send again.
 */
export const settleSent = Effect.fn("player.keep.settle")(function* <E, R>(
  sent: Effect.Effect<unknown, E>,
  confirm: Effect.Effect<void, never, R>,
  isFinal: (failure: E) => boolean
) {
  const result = yield* Effect.result(sent);
  if (Result.isSuccess(result)) {
    yield* confirm;
    return Option.none<E>();
  }
  if (isFinal(result.failure)) {
    yield* confirm;
  }
  return Option.some(result.failure);
});

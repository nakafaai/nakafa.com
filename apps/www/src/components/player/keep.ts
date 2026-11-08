import { Version } from "@repo/backend/confect/assessment/gate/rules";
import { type ToastCopy, toast } from "@repo/design-system/lib/toast/notify";
import {
  Array as Arr,
  Clock,
  Effect,
  Option,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { KeyValueStore } from "effect/persistence";
import { reportClientException } from "@/lib/analytics/client";

/**
 * How a player reads one failed send of a kept answer.
 * - `quiet`: the server already holds the answer or a newer one, so the kept answer goes and the learner hears
 *   nothing.
 * - `final`: the server will never take it, so the kept answer goes and the learner is told why.
 * - `held`: a refusal that lifts, such as a lock, so the answer stays for the next pass and the learner is told
 *   why.
 * - `failed`: the failure names no refusal, as when the call never reached the server, so the answer stays, the
 *   failure is reported, and the learner is told that the answer did not save.
 */
export const KeptRefusal = Schema.Literals([
  "failed",
  "final",
  "held",
  "quiet",
]);
type KeptRefusal = typeof KeptRefusal.Type;

/** The refusals after which the server will never take the kept answer, so the browser drops it. */
const DROPPED = Schema.is(Schema.Literals(["final", "quiet"]));

/** Reports a browser that refuses its storage. The answer still goes to the server, which decides. */
const reportStorage = (error: KeyValueStore.KeyValueStoreError) =>
  reportClientException(error, { source: "components/player/keep" });

/**
 * The answers that a player keeps in the browser until the server holds them, the School sitting's and the
 * try-out's alike. An answer is kept before it is sent, and dropped once the server confirms it or refuses it
 * for good. A reload, a closed tab, or a connection that was down or still signing in when the answer was
 * chosen therefore loses nothing: the player sends every kept answer again once its questions show. Flags are
 * the server's, so the browser keeps none.
 *
 * `response` describes the response of one answer. Each answer keeps it with the version it was numbered
 * with and the device time it was chosen at, which names the answer when the server confirms it. The store
 * gives the operations on one entry of the browser's storage, named by its key, and `bind` gives the ledger
 * of that entry once a product names how it sends an answer and how it reads a failure.
 */
export function keptAnswers<A, I>(response: Schema.Codec<A, I>) {
  const KeptAnswer = Schema.Struct({
    answeredAt: Schema.Finite,
    response,
    version: Version,
  });
  type KeptAnswer = typeof KeptAnswer.Type;
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

    /**
     * The kept answers of the given questions, in their order. Only a question that the caller shows gets its
     * kept answer back, so an answer kept for another paper or section is never sent.
     */
    const answersFor = Effect.fn("player.keep.answersFor")(function* <
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
    });

    /**
     * Drops the answer of a question once the server confirms the one chosen at `answeredAt`, or refuses it
     * for good. An answer chosen after that one stays, because the server has not confirmed it yet.
     */
    const confirm = Effect.fn("player.keep.confirm")(
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
    );

    /**
     * Keeps an answer before it is sent, numbered `version` and stamped with the device time, in place of the
     * answer kept for its question before, and gives back the answer it kept.
     */
    const keep = Effect.fn("player.keep.keep")(function* (
      questionId: string,
      answer: Omit<KeptAnswer, "answeredAt">
    ) {
      const kept: KeptAnswer = {
        ...answer,
        answeredAt: yield* Clock.currentTimeMillis,
      };
      yield* change((entry) => ({
        answers: { ...entry.answers, [questionId]: kept },
      }));
      return kept;
    });

    return {
      answersFor,
      /**
       * The ledger of this entry for one product. `send` is the product's call that sends one answer,
       * `refusal` reads how a failed send ends (`KeptRefusal`), `copyOf` gives the toast of a failure the
       * learner is told about, and `source` names the product in a failure report. A browser that refuses its
       * storage is reported and the answer still goes, because the server decides.
       */
      bind: <Question extends string, Failure>(binding: {
        readonly copyOf: (failure: Failure) => ToastCopy;
        readonly refusal: (failure: Failure) => KeptRefusal;
        readonly send: (
          questionId: Question,
          answer: Omit<KeptAnswer, "answeredAt">
        ) => Effect.Effect<unknown, Failure>;
        readonly source: string;
      }) => {
        /**
         * Sends one kept answer and settles it: the server's answer drops it, and so does a refusal after which
         * the server will never take it. Any other failure keeps it for the next pass. It resolves to the
         * failure, or to none when the server took the answer.
         */
        const send = Effect.fn("player.keep.send")(function* (
          questionId: Question,
          answer: KeptAnswer
        ) {
          const result = yield* Effect.result(
            binding.send(questionId, {
              response: answer.response,
              version: answer.version,
            })
          );
          if (
            Result.isFailure(result) &&
            !DROPPED(binding.refusal(result.failure))
          ) {
            return Option.some(result.failure);
          }
          yield* confirm(questionId, answer.answeredAt).pipe(
            Effect.catchTag("KeyValueStoreError", reportStorage)
          );
          return Result.isFailure(result)
            ? Option.some(result.failure)
            : Option.none<Failure>();
        });

        /**
         * Tells the learner about the failures of one pass with one toast, from the first failure it tells
         * of, and reports each failure that names no refusal. A quiet failure tells nothing. It resolves to
         * the failures it told of.
         */
        const tell = Effect.fn("player.keep.tell")(function* (
          failures: readonly Failure[]
        ) {
          const told = Arr.filter(
            failures,
            (failure) => binding.refusal(failure) !== "quiet"
          );
          yield* Effect.forEach(
            Arr.filter(
              told,
              (failure) => binding.refusal(failure) === "failed"
            ),
            (failure) =>
              reportClientException(failure, { source: binding.source }),
            { discard: true }
          );
          yield* Option.match(Arr.head(told), {
            onNone: () => Effect.void,
            onSome: (first) =>
              Effect.sync(() => {
                toast.error(binding.copyOf(first), {
                  position: "bottom-center",
                });
              }),
          });
          return told;
        });

        return {
          /**
           * Keeps one answer, then sends it and tells the learner if it failed. The answer is kept before the
           * first asynchronous step, so a fiber that runs this from a press has kept it before the press
           * returns; a browser that refuses its storage still sends the answer.
           */
          choose: Effect.fn("player.keep.choose")(function* (
            questionId: Question,
            answer: Omit<KeptAnswer, "answeredAt">
          ) {
            const kept = yield* keep(questionId, answer).pipe(
              Effect.catchTag("KeyValueStoreError", (error) =>
                Effect.flatMap(Clock.currentTimeMillis, (answeredAt) =>
                  reportStorage(error).pipe(
                    Effect.as({ ...answer, answeredAt })
                  )
                )
              )
            );
            yield* tell(Option.toArray(yield* send(questionId, kept)));
          }),
          /**
           * Sends again the kept answers of the shown questions, in their order, once its player shows them,
           * and tells the learner of the failures of the whole pass with one toast. It resolves to the failures
           * it told of, so a caller sends what waits on the answers only when there are none.
           */
          resend: Effect.fn("player.keep.resend")(function* (
            questionIds: readonly Question[]
          ) {
            const kept = yield* answersFor(questionIds).pipe(
              Effect.catchTag("KeyValueStoreError", (error) =>
                reportStorage(error).pipe(Effect.as([]))
              )
            );
            const failures = yield* Effect.forEach(
              kept,
              ({ answer, questionId }) => send(questionId, answer)
            );
            return yield* tell(Arr.getSomes(failures));
          }),
          send,
        };
      },
      confirm,
      /** Drops everything the entry keeps. */
      forget: Effect.fn("player.keep.forget")(function* () {
        const store = yield* KeyValueStore.KeyValueStore;
        yield* store.remove(key);
      }),
      keep,
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

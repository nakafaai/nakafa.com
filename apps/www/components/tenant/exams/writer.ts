import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { Data, Effect, Option, Ref, Schema, Semaphore } from "effect";

/** What one save writes: the answers and the key of a question. */
const QuestionWriteSchema = Schema.Struct({
  answers: Schema.NonEmptyArray(InteractionSchema),
  key: Schema.NullOr(Schema.NonEmptyArray(InteractionKeySchema)),
});

/** What one save writes, as `QuestionWriteSchema` describes it. Its revision comes from the draft it is built on. */
export type QuestionWrite = typeof QuestionWriteSchema.Type;

/**
 * The answers and the key of one question, with the revision the server holds them at. A save sends
 * the revision it was built on, and the server refuses a save whose revision is no longer current.
 */
const QuestionDraftSchema = Schema.Struct({
  ...QuestionWriteSchema.fields,
  revision: Schema.Natural,
});

/** A draft of one question, as `QuestionDraftSchema` describes it. */
export type QuestionDraft = typeof QuestionDraftSchema.Type;

/** A save that never reached the server, because a save queued before it was refused first. */
export class SaveDropped extends Data.TaggedError("SaveDropped") {}

/**
 * The saves of one question, in order, so that each save is built on the draft the save before it left.
 * The writer keeps the last draft the server answered. A save that starts from it applies its edit to that
 * draft and sends the revision the server returned, so two saves started together both land, and neither
 * one writes over the other. With no answered draft, a save starts from the draft its caller saw, which
 * holds the revision the server had when the question was read. A save that fails clears the answered draft,
 * so the next save starts again from what the caller sees. Every save queued before the failure is dropped
 * unsent, since each was built on the draft that failed, and a save built on the draft of a refusal could land
 * a change the server refused.
 */
export const makeQuestionWriter = <E>(
  send: (draft: QuestionDraft) => Effect.Effect<QuestionDraft, E>
) =>
  Effect.gen(function* () {
    const lane = yield* Semaphore.make(1);
    const answered = yield* Ref.make(Option.none<QuestionDraft>());
    const refusals = yield* Ref.make(0);

    const save = Effect.fn("exams.question.save")(function* (
      seen: QuestionDraft,
      edit: (draft: QuestionDraft) => QuestionWrite
    ) {
      const queuedAt = yield* Ref.get(refusals);
      return yield* lane.withPermits(1)(
        Effect.gen(function* () {
          if ((yield* Ref.get(refusals)) !== queuedAt) {
            return yield* new SaveDropped();
          }
          const base = Option.getOrElse(yield* Ref.get(answered), () => seen);
          const next = edit(base);
          const saved = yield* send({ ...next, revision: base.revision }).pipe(
            Effect.tapError(() =>
              Effect.andThen(
                Ref.set(answered, Option.none()),
                Ref.update(refusals, (count) => count + 1)
              )
            )
          );
          yield* Ref.set(answered, Option.some(saved));
        })
      );
    });

    return { save };
  });

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
 * The draft a save starts from: the draft the server answered this writer last, or the draft the render
 * holds when no save of this writer has been answered. The render wins only with a higher revision, which
 * means another editor saved the question after this writer's last answer. A tie keeps the answered draft,
 * the one the server returned for this writer's own save.
 */
const startingDraft = (
  answered: Option.Option<QuestionDraft>,
  rendered: QuestionDraft
): QuestionDraft =>
  Option.match(answered, {
    onNone: () => rendered,
    onSome: (draft) => (rendered.revision > draft.revision ? rendered : draft),
  });

/**
 * The saves of one question, in order, so that each save is built on the newest draft the writer knows.
 * Each save reads `rendered` when it starts, applies its edit to `startingDraft`, and sends the revision of
 * that draft. A save that the server answers becomes the answered draft, so two saves started together both
 * land, one after the other. A save built on a stale render is refused with nothing written. A save that
 * fails clears the answered draft, and every save queued before the failure is dropped unsent. The render can
 * still show the failed save's optimistic answers until React renders the rollback, so a save built on that
 * render could land the very change the server refused. A save queued after the failure starts from the render,
 * which may still lag the rollback for a moment, since the drop covers only the saves queued before the failure.
 */
export const makeQuestionWriter = <E>(
  send: (draft: QuestionDraft) => Effect.Effect<QuestionDraft, E>,
  rendered: Effect.Effect<QuestionDraft>
) =>
  Effect.gen(function* () {
    const lane = yield* Semaphore.make(1);
    const answered = yield* Ref.make(Option.none<QuestionDraft>());
    const refusals = yield* Ref.make(0);

    const save = Effect.fn("exams.question.save")(function* (
      edit: (draft: QuestionDraft) => QuestionWrite
    ) {
      const queuedAt = yield* Ref.get(refusals);
      return yield* lane.withPermits(1)(
        Effect.gen(function* () {
          if ((yield* Ref.get(refusals)) !== queuedAt) {
            return yield* new SaveDropped();
          }
          const base = startingDraft(yield* Ref.get(answered), yield* rendered);
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

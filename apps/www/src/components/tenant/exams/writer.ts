import { InteractionSchema } from "@nakafa/aksara-contracts/assessment/interaction";
import { InteractionKeySchema } from "@nakafa/aksara-contracts/assessment/key";
import { NETWORK_RETRY_SCHEDULE } from "@repo/backend/client/network";
import { QuestionTemplate } from "@repo/backend/confect/exams/question";
import {
  Data,
  Effect,
  Option,
  Predicate,
  Ref,
  Schedule,
  Schema,
  Semaphore,
} from "effect";

/** What one save writes: the answers, the key, and the template of a question. */
const QuestionWriteSchema = Schema.Struct({
  answers: Schema.NonEmptyArray(InteractionSchema),
  key: Schema.NullOr(Schema.NonEmptyArray(InteractionKeySchema)),
  template: QuestionTemplate,
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

/**
 * How a save that another editor overtook tries again: the render holds that editor's save a moment after the
 * server refused this one, so each try reads it anew, for a little over a second before the save fails.
 */
const OVERTAKEN_SCHEDULE = Schedule.spaced("150 millis");

/** How many times a save that another editor overtook tries again. */
const OVERTAKEN_RETRIES = 8;

/** A save that never reached the server, because a save queued before it was refused first. */
export class SaveDropped extends Data.TaggedError("SaveDropped") {}

/** Why the server does not hold a save: it refused it, or it never said no. */
const UnstoredReason = Schema.Literals(["refused", "unanswered"]);

/** What the page does with a save the server does not hold, given why. */
export type Unstored = (reason: typeof UnstoredReason.Type) => void;

/** Whether a save's call never finished, as a call the network lost or a function that ran out of time. */
const isUnanswered = (error: unknown) =>
  Predicate.isTagged(error, "ExamCallFailed");

/**
 * Whether the server never said no to a save: its call went unanswered, it stayed behind another editor, or it
 * waited behind a save that failed. Its words may be stored as they stand, so they stay with the teacher, unlike
 * a save the server refused, whose words it will never store.
 */
export const isUnrefused = (error: unknown) =>
  isUnanswered(error) ||
  Predicate.isTagged(error, "RevisionStale") ||
  Predicate.isTagged(error, "SaveDropped");

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
 * land, one after the other. A save another editor overtook is refused with nothing written, so it tries again
 * on the render once that holds the other editor's save, and two teachers writing in one question both land. A
 * call that goes unanswered goes again before it counts as a failure, since a function that ran out of time wrote
 * nothing, and the revision refuses it if it did. A save that fails clears the answered draft, and every save queued before the failure is dropped unsent. The render can
 * still show the failed save's optimistic answers until React renders the rollback, so a save built on that
 * render could land the very change the server refused. A save queued after the failure starts from the render,
 * which may still lag the rollback for a moment, since the drop covers only the saves queued before the failure.
 * `send` receives the draft it saves and the draft that save was built on, so a change of the template sends
 * the template's call and any other change sends the answers.
 */
export const makeQuestionWriter = <E>(
  send: (
    draft: QuestionDraft,
    base: QuestionDraft
  ) => Effect.Effect<QuestionDraft, E>,
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
          yield* Effect.gen(function* () {
            const base = startingDraft(
              yield* Ref.get(answered),
              yield* rendered
            );
            const saved = yield* send(
              { ...edit(base), revision: base.revision },
              base
            ).pipe(
              Effect.retry({
                schedule: NETWORK_RETRY_SCHEDULE,
                while: isUnanswered,
              }),
              Effect.tapError(() => Ref.set(answered, Option.none()))
            );
            yield* Ref.set(answered, Option.some(saved));
          }).pipe(
            Effect.retry({
              schedule: OVERTAKEN_SCHEDULE,
              times: OVERTAKEN_RETRIES,
              while: (error) => Predicate.isTagged(error, "RevisionStale"),
            }),
            Effect.tapError(() => Ref.update(refusals, (count) => count + 1))
          );
        })
      );
    });

    return { save };
  });

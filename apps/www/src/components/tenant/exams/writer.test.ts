import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Array as Arr, Data, Deferred, Effect, Fiber, Ref } from "effect";
import { TestClock } from "effect/testing";
import {
  emptyLabel,
  type OptionLabel,
  withOptionLabel,
} from "@/components/tenant/exams/answer";
import {
  isUnrefused,
  makeQuestionWriter,
  type QuestionDraft,
  SaveDropped,
} from "@/components/tenant/exams/writer";

/** A call that never finished, as `sentAction` fails with it. */
class CallUnanswered extends Data.TaggedError("ExamCallFailed") {}

/** The label of an option that holds `text` as one paragraph, the shape the option editor writes. */
const labelOf = (text: string): OptionLabel => ({
  content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
  type: "doc",
});

/** The text of a label, read from the text of its paragraphs in order. */
const plainText = (label: OptionLabel) =>
  Arr.join(
    Arr.flatMap(label.content, (block) =>
      block.type === "paragraph"
        ? Arr.flatMap(block.content ?? [], (node) =>
            node.type === "text" ? [node.text] : []
          )
        : []
    ),
    ""
  );

/** The text of each option of the first choice of a draft, in order. */
const textsOf = (draft: QuestionDraft) =>
  Arr.flatMap(draft.answers, (answer) =>
    answer.kind === "choice"
      ? Arr.map(answer.options, (option) => plainText(option.label))
      : []
  );

/** A draft of one single-answer choice with four options, at the revision the server holds it at. */
const draftAt = (revision: number, texts = ["", "Paris", "Rome", "Berlin"]) => {
  const choice: Interaction = {
    id: "choice",
    kind: "choice",
    label: "Answer",
    maxChoices: 1,
    minChoices: 1,
    options: Arr.map(texts, (text, index) => ({
      id: `option-${index + 1}`,
      label: text === "" ? emptyLabel() : labelOf(text),
    })),
    shuffle: false,
  };
  return {
    answers: [choice],
    key: null,
    revision,
    template: "choice",
  } satisfies QuestionDraft;
};

/** The edit that gives the option with `optionId` the text `text`, keeping the rest of the draft. */
const typeOption =
  (optionId: string, text: string) => (draft: QuestionDraft) => ({
    answers: withOptionLabel(draft.answers, optionId, labelOf(text)),
    key: draft.key,
    template: draft.template,
  });

/** The refusal of a save whose revision is no longer the one the server holds. */
class RevisionStale extends Data.TaggedError("RevisionStale")<{
  readonly current: number;
}> {}

/** A refusal that no second try changes. */
class AnswersRefused extends Data.TaggedError("AnswersRefused") {}

/**
 * A fake server of one question. Each save it receives is recorded. A save at a revision the server no
 * longer holds is refused with the server's current revision. With `held`, a save waits at the server
 * until `release` is succeeded, and `arrived` is succeeded when the first save reaches it. While
 * `refusing` holds, every save is refused for its contents.
 */
const serverHolding = (
  initial: QuestionDraft,
  held: boolean,
  refuses = false
) =>
  Effect.gen(function* () {
    const refusing = yield* Ref.make(refuses);
    const stored = yield* Ref.make(initial);
    const sent = yield* Ref.make<readonly QuestionDraft[]>([]);
    const bases = yield* Ref.make<readonly QuestionDraft[]>([]);
    const arrived = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    if (!held) {
      yield* Deferred.succeed(release, undefined);
    }
    const send = (draft: QuestionDraft, base: QuestionDraft) =>
      Effect.gen(function* () {
        yield* Ref.update(sent, (drafts) => [...drafts, draft]);
        yield* Ref.update(bases, (drafts) => [...drafts, base]);
        yield* Deferred.succeed(arrived, undefined);
        yield* Deferred.await(release);
        if (yield* Ref.get(refusing)) {
          return yield* new AnswersRefused();
        }
        const current = yield* Ref.get(stored);
        if (draft.revision !== current.revision) {
          return yield* new RevisionStale({ current: current.revision });
        }
        const next = {
          answers: draft.answers,
          key: draft.key,
          revision: current.revision + 1,
          template: draft.template,
        } satisfies QuestionDraft;
        yield* Ref.set(stored, next);
        return next;
      });
    return { arrived, bases, refusing, release, send, sent, stored };
  });

describe("makeQuestionWriter", () => {
  it.effect(
    "two saves started together both land, the second built on the draft the first returned",
    () =>
      Effect.gen(function* () {
        const server = yield* serverHolding(draftAt(3), true);
        const writer = yield* makeQuestionWriter(
          server.send,
          Effect.succeed(draftAt(3))
        );

        const first = yield* Effect.forkChild(
          writer.save(typeOption("option-2", "Lyon"))
        );
        yield* Deferred.await(server.arrived);
        // The second save starts from the same render as the first, as two option editors do in one render.
        const second = yield* Effect.forkChild(
          writer.save(typeOption("option-3", "Milan"))
        );
        yield* Deferred.succeed(server.release, undefined);
        yield* Fiber.join(first);
        yield* Fiber.join(second);

        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(5);
        expect(textsOf(stored)).toEqual(["", "Lyon", "Milan", "Berlin"]);
        const sent = yield* Ref.get(server.sent);
        expect(Arr.map(sent, (draft) => draft.revision)).toEqual([3, 4]);
        expect(textsOf(sent[1])).toEqual(["", "Lyon", "Milan", "Berlin"]);
        // Each save also hands its call the draft it was built on: the render, then the first answer.
        const bases = yield* Ref.get(server.bases);
        expect(Arr.map(bases, (draft) => draft.revision)).toEqual([3, 4]);
        expect(textsOf(bases[1])).toEqual(["", "Lyon", "Rome", "Berlin"]);
      })
  );

  it.effect(
    "starts a save from the render when another editor saved the question after this writer's last answer",
    () =>
      Effect.gen(function* () {
        const render = yield* Ref.make(draftAt(3));
        const server = yield* serverHolding(draftAt(3), false);
        const writer = yield* makeQuestionWriter(server.send, Ref.get(render));

        yield* writer.save(typeOption("option-2", "Lyon"));
        // Another editor saved the question at revision 5, so the server and the render hold its text.
        const foreign = draftAt(5, ["", "Lyon", "Rome", "Madrid"]);
        yield* Ref.set(server.stored, foreign);
        yield* Ref.set(render, foreign);

        yield* writer.save(typeOption("option-3", "Milan"));
        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(6);
        expect(textsOf(stored)).toEqual(["", "Lyon", "Milan", "Madrid"]);
      })
  );

  it.effect(
    "lands a save that another editor overtook on the render, once the render holds that editor's save",
    () =>
      Effect.gen(function* () {
        // Another editor saved the question once more, so the server holds revision 4 with its own text.
        const foreign = draftAt(4, ["", "Paris", "Rome", "Madrid"]);
        const server = yield* serverHolding(foreign, false);
        const render = yield* Ref.make(draftAt(3));
        const writer = yield* makeQuestionWriter(server.send, Ref.get(render));

        const save = yield* Effect.forkChild(
          writer.save(typeOption("option-2", "Lyon"))
        );
        // The refused save waits for the render, which catches up a moment later.
        yield* Effect.yieldNow;
        yield* Ref.set(render, foreign);
        yield* TestClock.adjust("150 millis");
        yield* Fiber.join(save);

        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(5);
        expect(textsOf(stored)).toEqual(["", "Lyon", "Rome", "Madrid"]);
        expect(
          Arr.map(yield* Ref.get(server.sent), (draft) => draft.revision)
        ).toEqual([3, 4]);
      })
  );

  it.effect(
    "fails a save whose render never catches up, and starts the next save from the render",
    () =>
      Effect.gen(function* () {
        const foreign = draftAt(4, ["", "Paris", "Rome", "Madrid"]);
        const server = yield* serverHolding(foreign, false);
        const render = yield* Ref.make(draftAt(3));
        const writer = yield* makeQuestionWriter(server.send, Ref.get(render));

        const refused = yield* Effect.forkChild(
          Effect.flip(writer.save(typeOption("option-2", "Lyon")))
        );
        yield* Effect.yieldNow;
        yield* TestClock.adjust("2 seconds");
        expect(yield* Fiber.join(refused)).toMatchObject({
          _tag: "RevisionStale",
          current: 4,
        });
        expect(yield* Ref.get(server.stored)).toMatchObject({ revision: 4 });

        yield* Ref.set(render, foreign);
        yield* writer.save(typeOption("option-2", "Lyon"));
        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(5);
        expect(textsOf(stored)).toEqual(["", "Lyon", "Rome", "Madrid"]);
      })
  );

  it.effect(
    "drops a save queued behind a refused save unsent, and lets a save queued after the refusal land",
    () =>
      Effect.gen(function* () {
        const server = yield* serverHolding(
          draftAt(4, ["", "Paris", "Rome", "Madrid"]),
          true,
          true
        );
        const render = yield* Ref.make(draftAt(4));
        const writer = yield* makeQuestionWriter(server.send, Ref.get(render));

        const refused = yield* Effect.forkChild(
          Effect.flip(writer.save(typeOption("option-2", "Lyon")))
        );
        yield* Deferred.await(server.arrived);
        const dropped = yield* Effect.forkChild(
          Effect.flip(writer.save(typeOption("option-3", "Milan")))
        );
        // Let the second save reach the writer's queue before the server answers the first.
        yield* Effect.yieldNow;
        yield* Deferred.succeed(server.release, undefined);
        const refusal = yield* Fiber.join(refused);
        const drop = yield* Fiber.join(dropped);

        expect(refusal).toBeInstanceOf(AnswersRefused);
        expect(drop).toBeInstanceOf(SaveDropped);
        expect(yield* Ref.get(server.sent)).toHaveLength(1);
        expect(yield* Ref.get(server.stored)).toMatchObject({ revision: 4 });

        yield* Ref.set(server.refusing, false);
        yield* Ref.set(render, draftAt(4, ["", "Paris", "Rome", "Madrid"]));
        yield* writer.save(typeOption("option-4", "Bern"));
        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(5);
        expect(textsOf(stored)).toEqual(["", "Paris", "Rome", "Bern"]);
      })
  );

  it.effect(
    "sends a call that went unanswered again before it counts, so one function that ran out of time loses no words",
    () =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const writer = yield* makeQuestionWriter(
          (draft) =>
            Ref.updateAndGet(calls, (count) => count + 1).pipe(
              Effect.flatMap((count) =>
                count < 3
                  ? Effect.fail(new CallUnanswered())
                  : Effect.succeed({ ...draft, revision: draft.revision + 1 })
              )
            ),
          Effect.succeed(draftAt(4))
        );

        const landed = yield* Effect.forkChild(
          writer.save(typeOption("option-2", "Lyon"))
        );
        yield* Effect.yieldNow;
        yield* TestClock.adjust("2 seconds");
        yield* Fiber.join(landed);
        expect(yield* Ref.get(calls)).toBe(3);
      })
  );

  it.effect(
    "fails a call that stays unanswered through its retries, which the page keeps for the teacher, unlike a refusal",
    () =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const writer = yield* makeQuestionWriter(
          () =>
            Ref.update(calls, (count) => count + 1).pipe(
              Effect.andThen(Effect.fail(new CallUnanswered()))
            ),
          Effect.succeed(draftAt(4))
        );

        const failed = yield* Effect.forkChild(
          Effect.flip(writer.save(typeOption("option-2", "Lyon")))
        );
        yield* Effect.yieldNow;
        yield* TestClock.adjust("2 seconds");
        const failure = yield* Fiber.join(failed);
        expect(yield* Ref.get(calls)).toBe(3);
        expect(isUnrefused(failure)).toBe(true);
        expect(isUnrefused(new SaveDropped())).toBe(true);
        expect(isUnrefused({ _tag: "RevisionStale" })).toBe(true);
        expect(isUnrefused(new AnswersRefused())).toBe(false);
      })
  );
});

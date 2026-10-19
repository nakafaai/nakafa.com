import { describe, expect, it } from "@effect/vitest";
import type { Interaction } from "@nakafa/aksara-contracts/assessment/interaction";
import { Array as Arr, Data, Deferred, Effect, Fiber, Ref } from "effect";
import {
  emptyLabel,
  type OptionLabel,
  withOptionLabel,
} from "@/components/tenant/exams/answer";
import {
  makeQuestionWriter,
  type QuestionDraft,
  SaveDropped,
} from "@/components/tenant/exams/writer";

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
  return { answers: [choice], key: null, revision } satisfies QuestionDraft;
};

/** The edit that gives the option with `optionId` the text `text`, keeping the rest of the draft. */
const typeOption =
  (optionId: string, text: string) => (draft: QuestionDraft) => ({
    answers: withOptionLabel(draft.answers, optionId, labelOf(text)),
    key: draft.key,
  });

/** The refusal of a save whose revision is no longer the one the server holds. */
class RevisionStale extends Data.TaggedError("RevisionStale")<{
  readonly current: number;
}> {}

/**
 * A fake server of one question. Each save it receives is recorded. A save at a revision the server no
 * longer holds is refused with the server's current revision. With `held`, a save waits at the server
 * until `release` is succeeded, and `arrived` is succeeded when the first save reaches it.
 */
const serverHolding = (initial: QuestionDraft, held: boolean) =>
  Effect.gen(function* () {
    const stored = yield* Ref.make(initial);
    const sent = yield* Ref.make<readonly QuestionDraft[]>([]);
    const arrived = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    if (!held) {
      yield* Deferred.succeed(release, undefined);
    }
    const send = (draft: QuestionDraft) =>
      Effect.gen(function* () {
        yield* Ref.update(sent, (drafts) => [...drafts, draft]);
        yield* Deferred.succeed(arrived, undefined);
        yield* Deferred.await(release);
        const current = yield* Ref.get(stored);
        if (draft.revision !== current.revision) {
          return yield* new RevisionStale({ current: current.revision });
        }
        const next = {
          answers: draft.answers,
          key: draft.key,
          revision: current.revision + 1,
        } satisfies QuestionDraft;
        yield* Ref.set(stored, next);
        return next;
      });
    return { arrived, release, send, sent, stored };
  });

describe("makeQuestionWriter", () => {
  it.effect(
    "two saves started together both land, the second built on the draft the first returned",
    () =>
      Effect.gen(function* () {
        const server = yield* serverHolding(draftAt(3), true);
        const writer = yield* makeQuestionWriter(server.send);

        const first = yield* Effect.forkChild(
          writer.save(draftAt(3), typeOption("option-2", "Lyon"))
        );
        yield* Deferred.await(server.arrived);
        // The second save sees the same draft the first one saw, as two option editors do in one render.
        const second = yield* Effect.forkChild(
          writer.save(draftAt(3), typeOption("option-3", "Milan"))
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
      })
  );

  it.effect(
    "refuses a save that another editor overtook, writes nothing, and starts the next save from what the caller sees",
    () =>
      Effect.gen(function* () {
        // Another editor saved the question once more, so the server holds revision 4 with its own text.
        const server = yield* serverHolding(
          draftAt(4, ["", "Paris", "Rome", "Madrid"]),
          false
        );
        const writer = yield* makeQuestionWriter(server.send);

        const refused = yield* Effect.flip(
          writer.save(draftAt(3), typeOption("option-2", "Lyon"))
        );
        expect(refused).toMatchObject({ _tag: "RevisionStale", current: 4 });
        expect(yield* Ref.get(server.stored)).toMatchObject({ revision: 4 });
        expect(textsOf(yield* Ref.get(server.stored))).toEqual([
          "",
          "Paris",
          "Rome",
          "Madrid",
        ]);

        yield* writer.save(
          draftAt(4, ["", "Paris", "Rome", "Madrid"]),
          typeOption("option-2", "Lyon")
        );
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
          true
        );
        const writer = yield* makeQuestionWriter(server.send);

        const refused = yield* Effect.forkChild(
          Effect.flip(writer.save(draftAt(3), typeOption("option-2", "Lyon")))
        );
        yield* Deferred.await(server.arrived);
        const dropped = yield* Effect.forkChild(
          Effect.flip(writer.save(draftAt(3), typeOption("option-3", "Milan")))
        );
        // Let the second save reach the writer's queue before the server answers the first.
        yield* Effect.yieldNow;
        yield* Deferred.succeed(server.release, undefined);
        const refusal = yield* Fiber.join(refused);
        const drop = yield* Fiber.join(dropped);

        expect(refusal).toMatchObject({ _tag: "RevisionStale", current: 4 });
        expect(drop).toBeInstanceOf(SaveDropped);
        expect(yield* Ref.get(server.sent)).toHaveLength(1);
        expect(yield* Ref.get(server.stored)).toMatchObject({ revision: 4 });

        yield* writer.save(
          draftAt(4, ["", "Paris", "Rome", "Madrid"]),
          typeOption("option-4", "Bern")
        );
        const stored = yield* Ref.get(server.stored);
        expect(stored.revision).toBe(5);
        expect(textsOf(stored)).toEqual(["", "Paris", "Rome", "Bern"]);
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import {
  BatchSchema,
  encodeBatch,
  MAX_ID_LENGTH,
  MAX_STEP_BYTES,
} from "@repo/backend/confect/editor/batch";
import { DocumentInvalid } from "@repo/backend/confect/editor/document";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import { MAX_BATCH_BYTES } from "@repo/backend/confect/editor/size";
import { stepSizePlugin } from "@repo/design-system/components/editor/size";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { EditorState } from "@tiptap/pm/state";
import { Array as Arr, Effect, Option, Ref, Schema } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";
import { startSync, tick } from "@/lib/editor/sync";
import {
  makePort,
  makeServer,
  type Refusal,
  textOf,
  typeText,
} from "@/test/sync";

/**
 * A state of one empty paragraph of the assessment document. Its plugins are the step
 * bound of the editor, read from the batch module that owns the bound.
 */
const openState = () =>
  EditorState.create({
    doc: assessmentSchema.node("doc", null, [
      assessmentSchema.node("paragraph"),
    ]),
    plugins: [stepSizePlugin(MAX_STEP_BYTES)],
  });

/** The UTF-8 bytes of one step as its JSON text, which the editor's bound counts. */
const stepBytesOf = (step: { readonly toJSON: () => unknown }) =>
  utf8Bytes(encodeJsonText(step.toJSON()));

describe("editor/send step bound", () => {
  it.effect(
    "admits a step of MAX_STEP_BYTES, which one call carries at its full size, and refuses one byte more",
    () =>
      Effect.gen(function* () {
        const state = openState();
        // A letter is one byte, so the text that makes the step exactly the bound is the
        // bound less the bytes of the step without its text.
        const base = stepBytesOf(state.tr.insertText("x", 1).steps[0]) - 1;
        const room = MAX_STEP_BYTES - base;
        const atBound = state.tr.insertText("x".repeat(room), 1);
        expect(stepBytesOf(atBound.steps[0])).toBe(MAX_STEP_BYTES);
        expect(state.apply(atBound).doc.textContent).toHaveLength(room);

        const overBound = state.tr.insertText("x".repeat(room + 1), 1);
        expect(state.apply(overBound)).toBe(state);

        // The call that carries the step at the bound, with the longest ids and version,
        // is exactly the largest call the server accepts.
        const batch = yield* Schema.decodeEffect(BatchSchema)({
          baseVersion: Number.MAX_SAFE_INTEGER,
          batch: "x".repeat(MAX_ID_LENGTH),
          clientId: "x".repeat(MAX_ID_LENGTH),
          steps: [atBound.steps[0].toJSON()],
        });
        const text = yield* encodeBatch(batch);
        expect(utf8Bytes(text)).toBe(MAX_BATCH_BYTES);
      })
  );
});

describe("editor/send steps the contract refuses", () => {
  it.effect(
    "drops a queued step that the contract refuses, counts it, and never sends it",
    () =>
      Effect.gen(function* () {
        const server = yield* makeServer();
        const { port, state } = yield* makePort(
          assessmentSchema,
          assessmentSchema.node("doc", null, [
            assessmentSchema.node("paragraph"),
          ])
        );
        const session = yield* startSync(port, server.transport);
        // An ordered list that starts at 0: the editor writes it, and the contract refuses the start.
        const list = assessmentSchema.node("orderedList", { start: 0 }, [
          assessmentSchema.node("listItem", null, [
            assessmentSchema.node("paragraph"),
          ]),
        ]);
        yield* Ref.update(state, (current) =>
          current.apply(current.tr.replaceWith(0, 2, list))
        );
        const dropped = yield* tick(session);
        expect(Option.getOrNull(dropped)).toMatchObject({
          _tag: "SyncDropped",
          count: 1,
        });
        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
        yield* typeText(state, "b");
        yield* tick(session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        expect(textOf((yield* Ref.get(state)).doc)).toBe("b");
      })
  );
});

describe("editor/send steps the server refuses", () => {
  it.effect(
    "halves a batch that the document refuses, drops the one step it refuses alone, and sends the rest",
    () =>
      Effect.gen(function* () {
        // The document refuses any step whose text holds "bad", as a step that breaks it would.
        const refuseBad: Refusal = (batch) =>
          Arr.some(batch.steps, (step) => encodeJsonText(step).includes("bad"))
            ? Effect.fail(new DocumentInvalid())
            : Effect.void;
        const server = yield* makeServer(undefined, refuseBad);
        const { port, state } = yield* makePort(
          assessmentSchema,
          assessmentSchema.node("doc", null, [
            assessmentSchema.node("paragraph"),
          ])
        );
        const session = yield* startSync(port, server.transport);
        // Three letters are three steps of the editor, and the middle one is refused.
        yield* typeText(state, "a");
        yield* typeText(state, "bad");
        yield* typeText(state, "c");
        // Each round sends the first half of a refused batch, and the next round pulls the
        // steps that landed before it sends the rest, so a few rounds settle the three steps.
        const rounds = yield* Effect.forEach(
          Arr.makeBy(4, (round) => round),
          () => tick(session)
        );
        expect(
          Arr.map(
            Arr.filter(rounds, Option.isSome),
            (reported) => reported.value.count
          )
        ).toEqual([1]);
        expect(yield* server.counts).toMatchObject({ head: 2, submits: 2 });
        expect(textOf((yield* Ref.get(state)).doc)).toBe("ca");
      })
  );

  it.effect(
    "keeps a batch that waits for a fold unsent, and sends the same batch again on the next round",
    () =>
      Effect.gen(function* () {
        const waiting = yield* Ref.make(true);
        const refuseOnce: Refusal = () =>
          Effect.flatMap(Ref.getAndSet(waiting, false), (first) =>
            first ? Effect.fail(new FoldPending()) : Effect.void
          );
        const server = yield* makeServer(undefined, refuseOnce);
        const { port, state } = yield* makePort(
          assessmentSchema,
          assessmentSchema.node("doc", null, [
            assessmentSchema.node("paragraph"),
          ])
        );
        const session = yield* startSync(port, server.transport);
        yield* typeText(state, "b");
        const failed = yield* tick(session).pipe(Effect.flip);
        expect(failed).toMatchObject({ _tag: "SyncFailed" });
        expect(yield* server.counts).toMatchObject({ head: 0, submits: 0 });
        yield* tick(session);
        expect(yield* server.counts).toMatchObject({ head: 1, submits: 1 });
        expect(textOf((yield* Ref.get(state)).doc)).toBe("b");
      })
  );
});

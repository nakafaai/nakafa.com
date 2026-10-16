import { describe, expect, it } from "@effect/vitest";
import {
  BatchSchema,
  encodeBatch,
  MAX_ID_LENGTH,
  MAX_STEP_BYTES,
} from "@repo/backend/confect/editor/batch";
import { MAX_BATCH_BYTES } from "@repo/backend/confect/editor/size";
import { stepSizePlugin } from "@repo/design-system/components/editor/size";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { EditorState } from "@tiptap/pm/state";
import { Effect, Schema } from "effect";
import { assessmentSchema } from "@/lib/editor/assessment";

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

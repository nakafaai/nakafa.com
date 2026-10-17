import { describe, expect, it } from "@effect/vitest";
import { applyStoredStep } from "@repo/backend/confect/editor/apply";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import type { Step } from "@repo/backend/confect/editor/step";
import { blockquotesAtStart } from "@repo/backend/test/editor";
import { paragraphOf } from "@repo/backend/test/editor/nodes";
import { nodeDepth } from "@repo/utilities/depth";
import { Effect } from "effect";

/** The document of one paragraph of `Soal`, read with the assessment schema. */
const soal = assessmentModel.nodeFromJSON(paragraphOf("Soal"));

/** A replace step that inserts `text` at `position`, inside the paragraph of `Soal`. */
const insertAt = (position: number, text: string): Step => ({
  from: position,
  slice: { content: [{ text, type: "text" }] },
  stepType: "replace",
  to: position,
});

describe("editor/apply", () => {
  it.effect(
    "applies a step that the schema reads, and returns the document it makes",
    () =>
      Effect.gen(function* () {
        const applied = yield* applyStoredStep(
          assessmentModel,
          soal,
          insertAt(5, "!")
        );
        expect(applied.doc.textContent).toBe("Soal!");
        expect(applied.step.toJSON()).toMatchObject({ from: 5, to: 5 });
      })
  );

  it.effect(
    "skips a step that the schema cannot read, and says the document is not too deep",
    () =>
      Effect.gen(function* () {
        // A text node without its text is one the schema cannot read.
        const failure = yield* applyStoredStep(assessmentModel, soal, {
          from: 1,
          slice: { content: [{ type: "text" }] },
          stepType: "replace",
          to: 1,
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "StepSkipped", tooDeep: false });
      })
  );

  it.effect(
    "skips a step that ProseMirror refuses, and says the document is not too deep",
    () =>
      Effect.gen(function* () {
        // The document is 6 positions long, and no node starts at its end, so the step fails.
        const failure = yield* applyStoredStep(assessmentModel, soal, {
          mark: { type: "bold" },
          pos: 6,
          stepType: "addNodeMark",
        }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "StepSkipped", tooDeep: false });
      })
  );

  it.effect(
    "skips a step that ProseMirror throws on, such as a position past the end, and says the document is not too deep",
    () =>
      Effect.gen(function* () {
        const failure = yield* applyStoredStep(
          assessmentModel,
          soal,
          insertAt(999, "x")
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "StepSkipped", tooDeep: false });
      })
  );

  it.effect("applies a step that nests the document to the depth bound", () =>
    Effect.gen(function* () {
      const applied = yield* applyStoredStep(
        assessmentModel,
        soal,
        blockquotesAtStart(14)
      );
      expect(nodeDepth(applied.doc)).toBe(16);
    })
  );

  it.effect(
    "skips a step that nests the document one level past the bound, and says the document is too deep",
    () =>
      Effect.gen(function* () {
        const failure = yield* applyStoredStep(
          assessmentModel,
          soal,
          blockquotesAtStart(15)
        ).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "StepSkipped", tooDeep: true });
      })
  );
});

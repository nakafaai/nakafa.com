import { describe, expect, it } from "@effect/vitest";
import {
  foldDue,
  foldSteps,
  snapshotNode,
} from "@repo/backend/confect/editor/fold";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import type { Step } from "@repo/backend/confect/editor/step";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect } from "effect";

/** A document of one paragraph that holds `text`. */
const paragraphDocument = (text: string) =>
  assessmentModel.nodeFromJSON({
    content: [{ content: [{ text, type: "text" }], type: "paragraph" }],
    type: "doc",
  });

/** A replace step that inserts `text` at `position`. */
const insertAt = (position: number, text: string): Step => ({
  from: position,
  slice: { content: [{ text, type: "text" }] },
  stepType: "replace",
  to: position,
});

describe("editor/fold due", () => {
  it.each([
    {
      due: true,
      name: "a submit that reaches the limit makes a fold due",
      input: { after: 200, before: 199, snapshotVersion: 0 },
    },
    {
      due: true,
      name: "a submit that crosses the limit by several steps makes a fold due",
      input: { after: 250, before: 150, snapshotVersion: 0 },
    },
    {
      due: false,
      name: "a submit below the limit makes no fold due",
      input: { after: 199, before: 0, snapshotVersion: 0 },
    },
    {
      due: false,
      name: "a submit that starts at the limit does not make another fold due",
      input: { after: 201, before: 200, snapshotVersion: 0 },
    },
    {
      due: true,
      name: "the limit counts the steps after the snapshot, not the whole log",
      input: { after: 300, before: 299, snapshotVersion: 100 },
    },
    {
      due: false,
      name: "steps the snapshot already covers do not count toward the limit",
      input: { after: 150, before: 99, snapshotVersion: 100 },
    },
  ])("$name", ({ due, input }) => {
    expect(foldDue(input)).toBe(due);
  });
});

describe("editor/fold steps", () => {
  it.effect(
    "applies the steps in order and names the version of each skipped step",
    () =>
      Effect.gen(function* () {
        const folded = yield* foldSteps(
          assessmentModel,
          paragraphDocument("Soal"),
          0,
          [
            insertAt(5, "!"),
            // The document is 6 positions long, and no node starts at its end, so the step
            // fails without throwing, as ProseMirror answers a step with no node at its position.
            { mark: { type: "bold" }, pos: 6, stepType: "addNodeMark" },
            insertAt(1, "?"),
          ]
        );
        expect(folded.doc.toJSON()).toEqual(
          paragraphDocument("?Soal!").toJSON()
        );
        expect(folded.skipped).toEqual([2]);
      })
  );

  it.effect(
    "counts the version from the snapshot's version, one step at a time",
    () =>
      Effect.gen(function* () {
        const folded = yield* foldSteps(
          assessmentModel,
          paragraphDocument("Soal"),
          40,
          [insertAt(999, "x")]
        );
        expect(folded.skipped).toEqual([41]);
        expect(folded.doc.toJSON()).toEqual(paragraphDocument("Soal").toJSON());
      })
  );

  it.effect("returns the snapshot unchanged for no steps", () =>
    Effect.gen(function* () {
      const folded = yield* foldSteps(
        assessmentModel,
        paragraphDocument("Soal"),
        3,
        []
      );
      expect(folded.skipped).toEqual([]);
      expect(folded.doc.toJSON()).toEqual(paragraphDocument("Soal").toJSON());
    })
  );
});

describe("editor/fold snapshot", () => {
  it.effect(
    "reads the stored text of a snapshot back into the document it holds",
    () =>
      Effect.gen(function* () {
        const text = encodeJsonText(paragraphDocument("Soal").toJSON());
        const read = yield* snapshotNode(assessmentModel, text);
        expect(read.toJSON()).toEqual(paragraphDocument("Soal").toJSON());
      })
  );
});

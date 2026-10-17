import { describe, expect, it } from "@effect/vitest";
import {
  FOLD_BYTE_LIMIT,
  FOLD_STEP_LIMIT,
  foldDue,
  foldSteps,
  snapshotNode,
} from "@repo/backend/confect/editor/fold";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import type { Step } from "@repo/backend/confect/editor/step";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Logger, MutableList } from "effect";

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
      name: "a submit that reaches the step limit makes a fold due",
      input: {
        after: { bytes: 0, steps: FOLD_STEP_LIMIT },
        before: { bytes: 0, steps: FOLD_STEP_LIMIT - 1 },
      },
    },
    {
      due: true,
      name: "a submit that crosses the step limit by several steps makes a fold due",
      input: {
        after: { bytes: 0, steps: FOLD_STEP_LIMIT + 50 },
        before: { bytes: 0, steps: FOLD_STEP_LIMIT - 150 },
      },
    },
    {
      due: false,
      name: "a submit below the step limit makes no fold due",
      input: {
        after: { bytes: 0, steps: FOLD_STEP_LIMIT - 1 },
        before: { bytes: 0, steps: 0 },
      },
    },
    {
      due: false,
      name: "a submit that starts at the step limit does not make another fold due",
      input: {
        after: { bytes: 0, steps: FOLD_STEP_LIMIT + 1 },
        before: { bytes: 0, steps: FOLD_STEP_LIMIT },
      },
    },
    {
      due: true,
      name: "a submit that crosses the byte limit makes a fold due",
      input: {
        after: { bytes: FOLD_BYTE_LIMIT, steps: 2 },
        before: { bytes: FOLD_BYTE_LIMIT - 1, steps: 1 },
      },
    },
    {
      due: false,
      name: "a submit that starts past the byte limit does not make another fold due",
      input: {
        after: { bytes: FOLD_BYTE_LIMIT + 1, steps: 2 },
        before: { bytes: FOLD_BYTE_LIMIT, steps: 1 },
      },
    },
    {
      due: false,
      name: "a submit below the byte limit makes no fold due",
      input: {
        after: { bytes: FOLD_BYTE_LIMIT - 1, steps: 2 },
        before: { bytes: 0, steps: 1 },
      },
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
          "document",
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
          "document",
          paragraphDocument("Soal"),
          40,
          [insertAt(999, "x")]
        );
        expect(folded.skipped).toEqual([41]);
        expect(folded.doc.toJSON()).toEqual(paragraphDocument("Soal").toJSON());
      })
  );

  it.effect(
    "logs each skipped step at error level, with its document, its version, and its kind but not its text",
    () =>
      Effect.gen(function* () {
        const logged = MutableList.make<{
          level: string;
          message: string;
        }>();
        yield* foldSteps(
          assessmentModel,
          "document-1",
          paragraphDocument("Soal"),
          40,
          [insertAt(999, "secret text")]
        ).pipe(
          Effect.provide(
            Logger.layer([
              Logger.make(({ logLevel, message }) => {
                MutableList.append(logged, {
                  level: String(logLevel),
                  message: String(message),
                });
              }),
            ])
          )
        );
        const errors = Arr.filter(
          MutableList.toArray(logged),
          (entry) => entry.level === "Error"
        );
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain("41");
        expect(errors[0]?.message).toContain("document-1");
        expect(errors[0]?.message).toContain("replace");
        expect(errors[0]?.message).not.toContain("secret text");
      })
  );

  it.effect("returns the snapshot unchanged for no steps", () =>
    Effect.gen(function* () {
      const folded = yield* foldSteps(
        assessmentModel,
        "document",
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

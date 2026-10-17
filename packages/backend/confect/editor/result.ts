import type { GenericId } from "@confect/core";
import type {
  EditorSnapshotsDoc,
  EditorStepsDoc,
} from "@repo/backend/confect/_generated/docs";
import { storedDocument } from "@repo/backend/confect/editor/document";
import { FoldPending } from "@repo/backend/confect/editor/errors";
import {
  FOLD_STEP_LIMIT,
  foldSteps,
  snapshotNode,
} from "@repo/backend/confect/editor/fold";
import { assessmentModel } from "@repo/backend/confect/editor/model";
import { decodeStep, type Step } from "@repo/backend/confect/editor/step";
import { stepsAfter } from "@repo/backend/confect/editor/store";
import { encodeJsonText } from "@repo/utilities/json";
import { utf8Bytes } from "@repo/utilities/text";
import { Array as Arr, Effect } from "effect";

/**
 * The text of the document that a snapshot and the steps after it make, checked with the
 * contract as a snapshot is checked (ADR 0028). The submit and the fold both make it, so a
 * batch that the submit accepts makes the same document that the fold stores. A result that
 * the contract refuses fails with `DocumentInvalid` or `DocumentTooLarge`, and nothing is written.
 * `tooDeep` names the skipped steps whose document nests past the bound, so the submit can
 * refuse its own batch for that reason.
 */
export const foldedText = Effect.fn("editor.result.folded")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  snapshot: Pick<EditorSnapshotsDoc, "content" | "version">,
  steps: readonly Step[]
) {
  const start = yield* snapshotNode(assessmentModel, snapshot.content);
  const folded = yield* foldSteps(
    assessmentModel,
    documentId,
    start,
    snapshot.version,
    steps
  );
  const content = yield* storedDocument(encodeJsonText(folded.doc.toJSON()));
  return {
    content,
    skipped: folded.skipped.length,
    tooDeep: folded.tooDeep,
  };
});

/**
 * The steps that a snapshot lacks, as one read of `FOLD_STEP_LIMIT` steps holds them. A
 * backlog that one read does not hold fails with `FoldPending`: a submit checks the document
 * with every step the snapshot lacks, and a fold of them is already due, so the client sends
 * its batch again (ADR 0028). A submit therefore applies at most one read and one batch.
 */
export const pendingRows = Effect.fn("editor.result.pending")(function* (
  documentId: GenericId.GenericId<"editorDocuments">,
  snapshotVersion: number,
  head: number
) {
  const rows = yield* stepsAfter(documentId, snapshotVersion, FOLD_STEP_LIMIT);
  if (rows.length < head - snapshotVersion) {
    return yield* new FoldPending();
  }
  return rows;
});

/** The steps that a list of stored rows holds, decoded in order. A stored step that does not read back is a defect. */
export const decodedSteps = Effect.fn("editor.result.decoded")(function* (
  rows: readonly EditorStepsDoc[]
) {
  return yield* Effect.forEach(rows, (row) =>
    decodeStep(row.step).pipe(Effect.orDie)
  );
});

/** The UTF-8 bytes of the step text of a list of rows, which the due check of a fold reads. */
export const stepBytes = (rows: readonly Pick<EditorStepsDoc, "step">[]) =>
  Arr.reduce(rows, 0, (total, row) => total + utf8Bytes(row.step));

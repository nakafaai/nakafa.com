import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import { VersionSchema } from "@repo/backend/confect/editor/batch";
import { MAX_BATCH_STEPS } from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import { nodeDepth } from "@repo/utilities/depth";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";
import type { Node, Schema as ProseSchema } from "prosemirror-model";
import { Step as ProseStep } from "prosemirror-transform";

/**
 * The steps a snapshot may lag behind the head before a fold is due: one page of the
 * log. A fold reads one page of the log, which holds at most `MAX_BATCH_STEPS` steps
 * and `STEP_READ_BYTES` of step text (ADR 0028 Bounds). A fold made at this limit reads
 * its steps in one read, and the steps behind a snapshot stay near one page.
 */
const FOLD_STEP_LIMIT = MAX_BATCH_STEPS;

/** What a fold due check reads: the head before and after a submit, and the snapshot's version. */
const FoldDueSchema = Schema.Struct({
  after: VersionSchema,
  before: VersionSchema,
  snapshotVersion: VersionSchema,
});

/**
 * Whether a submit makes a fold due: the steps that the snapshot lacks reach the limit
 * with this submit. A submit that starts at or above the limit does not make another
 * fold due, because the fold already due reads on from the snapshot until the log is
 * level.
 */
export function foldDue(input: typeof FoldDueSchema.Type): boolean {
  return (
    input.before - input.snapshotVersion < FOLD_STEP_LIMIT &&
    input.after - input.snapshotVersion >= FOLD_STEP_LIMIT
  );
}

/**
 * A stored step that the editors skip. ProseMirror does not apply it, or the document
 * it makes nests past the bound of the contract.
 */
class StepSkipped extends Schema.TaggedError<StepSkipped>()("StepSkipped", {
  reason: Schema.String,
}) {}

/**
 * The document after one stored step, or the reason the editors skip the step (ADR
 * 0028). ProseMirror answers a step that does not apply with a failure, and it throws on
 * a position past the end of the document, so both are skipped. A document that nests
 * past `MAX_DOCUMENT_DEPTH` is skipped too, so the fold never holds a document that the
 * contract refuses for its depth.
 */
const applyStep = Effect.fn("editor.fold.applyStep")(function* (
  schema: ProseSchema,
  doc: Node,
  step: Step
) {
  const result = yield* Effect.try({
    try: () => ProseStep.fromJSON(schema, step).apply(doc),
    catch: (cause) => new StepSkipped({ reason: String(cause) }),
  });
  if (result.failed !== null) {
    return yield* new StepSkipped({ reason: result.failed });
  }
  const next = yield* Effect.fromNullishOr(result.doc).pipe(Effect.orDie);
  const depth = nodeDepth(next);
  if (depth > MAX_DOCUMENT_DEPTH) {
    return yield* new StepSkipped({
      reason: `The document it makes would nest ${depth} levels, past the ${MAX_DOCUMENT_DEPTH} the contract allows.`,
    });
  }
  return next;
});

/**
 * The document after the steps, applied in order from the snapshot's version. The steps
 * after a snapshot are contiguous from its version, so the step at index `i` makes the
 * version `startVersion + i + 1`, and a skipped step still counts in the version. A step
 * that the editors skip is logged with its version and its reason, and the result names
 * each skipped version, so the skip is never silent (ADR 0028).
 */
export const foldSteps = Effect.fn("editor.fold.steps")(function* (
  schema: ProseSchema,
  start: Node,
  startVersion: number,
  steps: readonly Step[]
) {
  return yield* Effect.reduce(
    Arr.zip(
      steps,
      Arr.makeBy(steps.length, (index) => startVersion + index + 1)
    ),
    () => ({ doc: start, skipped: Arr.empty<number>() }),
    (folded, [step, version]) =>
      applyStep(schema, folded.doc, step).pipe(
        Effect.map((doc) => ({ doc, skipped: folded.skipped })),
        Effect.catchTag("StepSkipped", (skip) =>
          Effect.logWarning(
            `The stored step at version ${version} is skipped, as every editor skips it: ${skip.reason}`
          ).pipe(
            Effect.as({
              doc: folded.doc,
              skipped: Arr.append(folded.skipped, version),
            })
          )
        )
      )
  );
});

/**
 * The document that a snapshot's text holds, read with the schema of the document. The
 * text is a contract document that the server wrote after it checked it, so a text the
 * schema cannot read is a defect of the stored row, not a refusal of the caller.
 */
export const snapshotNode = Effect.fn("editor.fold.snapshot")(function* (
  schema: ProseSchema,
  content: string
) {
  const json = yield* Schema.decodeEffect(JsonTextSchema)(content);
  return yield* Effect.try({
    try: () => schema.nodeFromJSON(json),
    catch: String,
  });
}, Effect.orDie);

import { applyStoredStep } from "@repo/backend/confect/editor/apply";
import { VersionSchema } from "@repo/backend/confect/editor/batch";
import { STEP_READ_BYTES } from "@repo/backend/confect/editor/size";
import type { Step } from "@repo/backend/confect/editor/step";
import { JsonTextSchema } from "@repo/utilities/json";
import { Array as Arr, Effect, Schema } from "effect";
import type { Node, Schema as ProseSchema } from "prosemirror-model";

/**
 * The steps that a snapshot lacks, the count and the text in UTF-8 bytes. A submit reads
 * them in one read, and a fold makes its snapshot from them (ADR 0028).
 */
const PendingSchema = Schema.Struct({
  bytes: Schema.Natural,
  steps: VersionSchema,
});
/** The steps that a snapshot lacks, as `PendingSchema` describes them. */
type Pending = typeof PendingSchema.Type;

/**
 * The count of steps that a snapshot lacks which makes a fold due, and the most steps a
 * submit reads as the backlog it checks (ADR 0028). It is set from the measured fold in the
 * Bounds table of ADR 0028: convex-test in Node, on a near-bound document of each shape (hard
 * breaks, one long text node, and a deep nesting), five runs per backlog. A fold of 24 steps
 * took at most 189 ms in any run of any shape, under a quarter of the 1 s user-code limit
 * (250 ms). A fold of 32 steps took at most 391 ms (deep nesting), so the limit is 24.
 * A submit adds one batch of `MAX_BATCH_STEPS` to the backlog it checks, so the worst backlog
 * a fold runs is 56 steps. That backlog took at most 255 ms (deep nesting; 245 ms for hard
 * breaks), so one run of five is above a quarter second by 5 ms.
 */
export const FOLD_STEP_LIMIT = 24;

/**
 * The text, in bytes, that the steps a snapshot lacks may reach before a fold is due: half
 * the read budget of `STEP_READ_BYTES`. A submit reads the steps a snapshot lacks in one
 * read, so a backlog past the budget refuses every batch until its fold runs. The fold is
 * due at half the budget, so the fold is scheduled before that refusal can happen. The
 * margin covers the bytes the read adds to each row (ADR 0028 Bounds).
 */
export const FOLD_BYTE_LIMIT = STEP_READ_BYTES / 2;

/**
 * Whether a submit makes a fold due: the steps a snapshot lacks reach the step limit or the
 * byte limit with this submit. A submit that starts at or past a limit does not make another
 * fold due, because the fold already due folds the whole log up to the head when it runs.
 */
export function foldDue(input: {
  readonly after: Pending;
  readonly before: Pending;
}): boolean {
  return (
    (input.before.steps < FOLD_STEP_LIMIT &&
      input.after.steps >= FOLD_STEP_LIMIT) ||
    (input.before.bytes < FOLD_BYTE_LIMIT &&
      input.after.bytes >= FOLD_BYTE_LIMIT)
  );
}

/**
 * The document after the steps, applied in order from the snapshot's version. The steps
 * after a snapshot are contiguous from its version, so the step at index `i` makes the
 * version `startVersion + i + 1`, and a skipped step still counts in the version. A step
 * that the editors skip is logged at error level with its document, its version, and its
 * kind, and the result names each skipped version, so the skip is never silent (ADR 0028).
 * `tooDeep` names the skipped versions whose document nests past the bound, so a submit can
 * refuse its own batch for that reason. The kind is logged and not the text, because the
 * text is the learner's content.
 */
export const foldSteps = Effect.fn("editor.fold.steps")(function* (
  schema: ProseSchema,
  documentId: string,
  start: Node,
  startVersion: number,
  steps: readonly Step[]
) {
  return yield* Effect.reduce(
    Arr.zip(
      steps,
      Arr.makeBy(steps.length, (index) => startVersion + index + 1)
    ),
    () => ({
      doc: start,
      skipped: Arr.empty<number>(),
      tooDeep: Arr.empty<number>(),
    }),
    (folded, [step, version]) =>
      applyStoredStep(schema, folded.doc, step).pipe(
        Effect.map(({ doc }) => ({ ...folded, doc })),
        Effect.catchTag("StepSkipped", (skip) =>
          Effect.logError(
            `Skipped the stored step ${version} (${step.stepType}) of document ${documentId}, as every editor skips it: ${skip.reason}`
          ).pipe(
            Effect.as({
              doc: folded.doc,
              skipped: Arr.append(folded.skipped, version),
              tooDeep: skip.tooDeep
                ? Arr.append(folded.tooDeep, version)
                : folded.tooDeep,
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

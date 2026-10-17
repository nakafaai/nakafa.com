import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import type { Step } from "@repo/backend/confect/editor/step";
import { nodeDepth } from "@repo/utilities/depth";
import { Effect, Schema } from "effect";
import type { Node, Schema as ProseSchema } from "prosemirror-model";
import { Step as ProseStep } from "prosemirror-transform";

/**
 * A stored step that every editor skips, and the fold with it (ADR 0028). `tooDeep` is
 * true when the document the step makes nests past `MAX_DOCUMENT_DEPTH`. It is false when
 * the schema cannot read the step, or ProseMirror does not apply it.
 */
class StepSkipped extends Schema.TaggedError<StepSkipped>()("StepSkipped", {
  reason: Schema.String,
  tooDeep: Schema.Boolean,
}) {}

/**
 * One stored step applied to a document, as every editor applies it (ADR 0028). It is the
 * one rule that the fold and the editors both call, so a skip is written once. The schema
 * reads the step, and ProseMirror applies it to `doc`. A step that the schema cannot read,
 * that ProseMirror refuses, or that throws (such as a position past the end of the
 * document) fails with `StepSkipped`. So does a step whose document nests past
 * `MAX_DOCUMENT_DEPTH`, so no editor or snapshot holds a document the contract refuses
 * for its depth. On success it returns the document, and the ProseMirror step that the
 * collab plugin receives.
 */
export const applyStoredStep = Effect.fn("editor.apply.step")(function* (
  schema: ProseSchema,
  doc: Node,
  step: Step
) {
  const applied = yield* Effect.try({
    try: () => {
      const proseStep = ProseStep.fromJSON(schema, step);
      return { proseStep, result: proseStep.apply(doc) };
    },
    catch: (cause) =>
      new StepSkipped({ reason: String(cause), tooDeep: false }),
  });
  if (applied.result.failed !== null) {
    return yield* new StepSkipped({
      reason: applied.result.failed,
      tooDeep: false,
    });
  }
  const next = yield* Effect.fromNullishOr(applied.result.doc).pipe(
    Effect.orDie
  );
  const depth = nodeDepth(next);
  if (depth > MAX_DOCUMENT_DEPTH) {
    return yield* new StepSkipped({
      reason: `The document it makes would nest ${depth} levels, past the ${MAX_DOCUMENT_DEPTH} the contract allows.`,
      tooDeep: true,
    });
  }
  return { doc: next, step: applied.proseStep };
});

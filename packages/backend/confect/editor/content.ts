import { MarkSchema as ContractMarkSchema } from "@nakafa/aksara-contracts/assessment/inline";
import { BatchInvalid } from "@repo/backend/confect/editor/errors";
import { checkSlice } from "@repo/backend/confect/editor/slice";
import type { Step } from "@repo/backend/confect/editor/step";
import { Effect, Match, Schema } from "effect";

/**
 * Checks one mark with the contract's mark schema: a plain mark, or a link whose
 * address is an absolute https address.
 */
const checkMark = (mark: unknown) =>
  Schema.decodeUnknownEffect(ContractMarkSchema)(mark).pipe(Effect.asVoid);

/**
 * Checks the content that one step writes. An attribute step sets one value of a node
 * that the step does not type, so the step holds no content the contract can read here,
 * and the snapshot checks the document it makes (ADR 0028). A replace-around step keeps
 * its gap, so its slice is checked with the gap's depth only when the gap has content.
 */
const checkStep = Match.type<Step>().pipe(
  Match.discriminatorsExhaustive("stepType")({
    addMark: (step) => checkMark(step.mark),
    addNodeMark: (step) => checkMark(step.mark),
    attr: () => Effect.void,
    docAttr: () => Effect.void,
    removeMark: (step) => checkMark(step.mark),
    removeNodeMark: (step) => checkMark(step.mark),
    replace: (step) => checkSlice(step.slice, 0),
    replaceAround: (step) =>
      checkSlice(step.slice, step.gapFrom < step.gapTo ? step.insert : 0),
  })
);

/**
 * Refuses a batch whose steps write content that the contract refuses at the snapshot:
 * a heading level outside the contract's levels, a link to an address that is not https,
 * or a node or mark the contract does not allow. The check runs before any write, so a
 * step the snapshot would refuse does not reach the log, and the log can still be pruned.
 * An attribute step is the exception: its value is not read here, because the step does
 * not name its node, and the snapshot checks the document it makes (ADR 0028).
 */
export const checkContent = Effect.fn("editor.content.check")(function* (
  steps: readonly Step[]
) {
  yield* Effect.forEach(steps, checkStep, { discard: true }).pipe(
    Effect.mapError(() => new BatchInvalid())
  );
});

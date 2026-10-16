import { BlockSchema } from "@nakafa/aksara-contracts/assessment/document";
import {
  MarkSchema as ContractMarkSchema,
  InlineNodeSchema,
} from "@nakafa/aksara-contracts/assessment/inline";
import { BatchInvalid } from "@repo/backend/confect/editor/errors";
import type { DocumentNode } from "@repo/backend/confect/editor/node";
import type { Step } from "@repo/backend/confect/editor/step";
import { Effect, Match, Schema } from "effect";

/**
 * A node of a slice, read as the contract reads the same node in a document: a block,
 * or an inline node such as a text run or a line break. The text marks of a text node
 * are read with it, by the contract's own mark schema.
 */
const SliceNodeSchema = Schema.Union([BlockSchema, InlineNodeSchema]);

/**
 * A node as the contract reads it. A list item belongs to its list, so the contract
 * reads it inside a list of one item. Any other node is read as it is.
 */
const readableNode = (node: DocumentNode): unknown =>
  node.type === "listItem" ? { content: [node], type: "bulletList" } : node;

/** Checks each node of a slice, with the contract's schema for its kind. */
const checkNodes = (nodes: readonly DocumentNode[]) =>
  Effect.forEach(
    nodes,
    (node) => Schema.decodeUnknownEffect(SliceNodeSchema)(readableNode(node)),
    { discard: true }
  );

/** The slice that a replace step carries. A step that only removes content holds none. */
type StepSlice = NonNullable<
  Extract<Step, { readonly stepType: "replace" }>["slice"]
>;

/** Checks the slice of a step, when it holds one. */
const checkSlice = (slice: StepSlice | undefined) =>
  slice === undefined ? Effect.void : checkNodes(slice.content);

/**
 * Checks one mark with the contract's mark schema: a plain mark, or a link whose
 * address is an absolute https address.
 */
const checkMark = (mark: unknown) =>
  Schema.decodeUnknownEffect(ContractMarkSchema)(mark).pipe(Effect.asVoid);

/**
 * Checks the content that one step writes. An attribute step sets one value of a node
 * that the step does not type, so the step holds no content the contract can read here,
 * and the snapshot checks the document it makes (ADR 0028).
 */
const checkStep = Match.type<Step>().pipe(
  Match.discriminatorsExhaustive("stepType")({
    addMark: (step) => checkMark(step.mark),
    addNodeMark: (step) => checkMark(step.mark),
    attr: () => Effect.void,
    docAttr: () => Effect.void,
    removeMark: (step) => checkMark(step.mark),
    removeNodeMark: (step) => checkMark(step.mark),
    replace: (step) => checkSlice(step.slice),
    replaceAround: (step) => checkSlice(step.slice),
  })
);

/**
 * Refuses a batch whose steps write content that the contract refuses at the snapshot:
 * a heading level outside the contract's levels, a link to an address that is not https,
 * or a node or mark the contract does not allow. The check runs before any write, so
 * a step the snapshot would refuse never reaches the log, and the log can still be
 * pruned (ADR 0028).
 */
export const checkContent = Effect.fn("editor.content.check")(function* (
  steps: readonly Step[]
) {
  yield* Effect.forEach(steps, checkStep, { discard: true }).pipe(
    Effect.mapError(() => new BatchInvalid())
  );
});

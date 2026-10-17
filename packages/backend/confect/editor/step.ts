import { MAX_DOCUMENT_DEPTH } from "@nakafa/aksara-contracts/assessment/document";
import {
  AttributeValueSchema,
  DocumentNodeSchema,
  fitsSlice,
  MarkSchema,
} from "@repo/backend/confect/editor/node";
import { Effect, Predicate, Schema, SchemaTransformation } from "effect";

/** A position in a document: a count from its start, never negative. */
const PositionSchema = Schema.Natural;

/** A count of nodes or open levels, never negative. */
const CountSchema = Schema.Natural;

/**
 * The fields of a slice as ProseMirror writes them: its nodes, and how many levels at each end
 * are open. ProseMirror writes a slice only when it holds a node: `Slice.toJSON` returns null for
 * an empty one, and the step leaves out its `slice` key. So `content` holds at least one node.
 */
const SliceFieldsSchema = Schema.Struct({
  content: Schema.NonEmptyArray(DocumentNodeSchema),
  openEnd: Schema.optionalKey(CountSchema),
  openStart: Schema.optionalKey(CountSchema),
});

/**
 * A slice of a step. Its depth is checked before any node is read, the same way
 * a document is, so a deep slice fails as a schema issue and never as a stack
 * overflow.
 */
const SliceSchema = Schema.Unknown.check(
  Schema.makeFilter(fitsSlice, {
    message: `Expected a slice whose nodes are at most ${MAX_DOCUMENT_DEPTH} levels deep.`,
  })
).pipe(
  Schema.decodeTo(
    SliceFieldsSchema,
    SchemaTransformation.passthroughSupertype()
  )
);

/** The step that replaces the content from `from` to `to` with a slice. */
const ReplaceStepSchema = Schema.Struct({
  from: PositionSchema,
  slice: Schema.optionalKey(SliceSchema),
  stepType: Schema.Literal("replace"),
  structure: Schema.optionalKey(Schema.Literal(true)),
  to: PositionSchema,
}).check(
  Schema.makeFilter((step) => step.from <= step.to, {
    message: "Expected from at or before to.",
  })
);

/**
 * The step that replaces the content between two gap positions, and keeps the
 * gap. The positions are in order: `from`, `gapFrom`, `gapTo`, and `to`.
 */
const ReplaceAroundStepSchema = Schema.Struct({
  from: PositionSchema,
  gapFrom: PositionSchema,
  gapTo: PositionSchema,
  insert: CountSchema,
  slice: Schema.optionalKey(SliceSchema),
  stepType: Schema.Literal("replaceAround"),
  structure: Schema.optionalKey(Schema.Literal(true)),
  to: PositionSchema,
}).check(
  Schema.makeFilter(
    (step) =>
      step.from <= step.gapFrom &&
      step.gapFrom <= step.gapTo &&
      step.gapTo <= step.to,
    { message: "Expected from, gapFrom, gapTo, and to in order." }
  )
);

/** The step that adds a mark to the text from `from` to `to`. */
const AddMarkStepSchema = Schema.Struct({
  from: PositionSchema,
  mark: MarkSchema,
  stepType: Schema.Literal("addMark"),
  to: PositionSchema,
}).check(
  Schema.makeFilter((step) => step.from <= step.to, {
    message: "Expected from at or before to.",
  })
);

/** The step that removes a mark from the text from `from` to `to`. */
const RemoveMarkStepSchema = Schema.Struct({
  from: PositionSchema,
  mark: MarkSchema,
  stepType: Schema.Literal("removeMark"),
  to: PositionSchema,
}).check(
  Schema.makeFilter((step) => step.from <= step.to, {
    message: "Expected from at or before to.",
  })
);

/** The step that adds a mark to the node at `pos`. */
const AddNodeMarkStepSchema = Schema.Struct({
  mark: MarkSchema,
  pos: PositionSchema,
  stepType: Schema.Literal("addNodeMark"),
});

/** The step that removes a mark from the node at `pos`. */
const RemoveNodeMarkStepSchema = Schema.Struct({
  mark: MarkSchema,
  pos: PositionSchema,
  stepType: Schema.Literal("removeNodeMark"),
});

/** The step that sets one attribute of the node at `pos`. */
const AttrStepSchema = Schema.Struct({
  attr: Schema.String,
  pos: PositionSchema,
  stepType: Schema.Literal("attr"),
  value: AttributeValueSchema,
});

/** The step that sets one attribute of the document. */
const DocAttrStepSchema = Schema.Struct({
  attr: Schema.String,
  stepType: Schema.Literal("docAttr"),
  value: AttributeValueSchema,
});

/**
 * One ProseMirror step as its `toJSON` writes it. The eight kinds are the step
 * classes that `prosemirror-transform` 1.12.2 exports, and the slice, node, and
 * mark shapes are the ones that `prosemirror-model` 1.25.12 writes. The shape is
 * checked here, and so is the order of each range. Applying a step needs the
 * document, which this module does not hold.
 */
export const StepSchema = Schema.Union([
  ReplaceStepSchema,
  ReplaceAroundStepSchema,
  AddMarkStepSchema,
  RemoveMarkStepSchema,
  AddNodeMarkStepSchema,
  RemoveNodeMarkStepSchema,
  AttrStepSchema,
  DocAttrStepSchema,
]);
/** One step, as `StepSchema` decodes it. */
export type Step = typeof StepSchema.Type;

/** The JSON text of a step: the one string field a step is stored in (ADR 0028). */
export const StepTextSchema = Schema.fromJsonString(StepSchema);

/**
 * Whether a step's slice, read as unchecked input, is within the depth bound. A
 * step holds at most one slice, and a step without one has nothing to check.
 */
function fitsStep(value: unknown): boolean {
  return !Predicate.hasProperty(value, "slice") || fitsSlice(value.slice);
}

/**
 * A step as it arrives, checked for the depth of its slice before any node is
 * read. The batch encoder reads its steps through this schema too.
 */
export const UncheckedStepSchema = Schema.Unknown.check(
  Schema.makeFilter(fitsStep, {
    message: `Expected a slice whose nodes are at most ${MAX_DOCUMENT_DEPTH} levels deep.`,
  })
);

/**
 * Writes a step as its JSON text. The depth of the slice is checked on the typed
 * input before the encoder walks it, so a deep slice fails as a schema issue.
 */
export const encodeStep = Effect.fn("editor.step.encode")(function* (
  step: Step
) {
  yield* Schema.decodeEffect(UncheckedStepSchema)(step);
  return yield* Schema.encodeEffect(StepTextSchema)(step);
});

/** Reads a stored step's JSON text back into a checked step. */
export const decodeStep = Effect.fn("editor.step.decode")(function* (
  text: string
) {
  return yield* Schema.decodeEffect(StepTextSchema)(text);
});

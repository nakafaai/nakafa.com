import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * Where a build step works: the lessons after a cursor, one surah of the
 * Quran, or the clean-up of documents that are not published any more. A build
 * walks them in this order, and a position is all it needs to resume.
 */
const positionValidator = Schema.Union([
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    phase: Schema.Literal("lessons"),
  }),
  Schema.Struct({ phase: Schema.Literal("quran"), surah: Schema.Finite }),
  Schema.Struct({
    cursor: Schema.NullOr(Schema.String),
    phase: Schema.Literal("prune"),
  }),
]);
export type Position = typeof positionValidator.Type;

/** One build step: the release it is for, if known, and where it works. */
export const stepInputValidator = Schema.Struct({
  position: Schema.optionalKey(positionValidator),
  releaseId: Schema.optionalKey(Schema.String),
});

/** The step that follows another: the release is known by then. */
const nextStepValidator = Schema.Struct({
  position: positionValidator,
  releaseId: Schema.String,
});

/**
 * What one build step did and the step that follows it: `next` is null when
 * the build is complete or `stale` says that the release changed under it.
 * `skipped` counts the documents it passed over because the index held them at
 * the right version, and `removed` the rows it deleted.
 */
const stepResultValidator = Schema.Struct({
  embedded: Schema.Finite,
  kept: Schema.Finite,
  missing: Schema.Finite,
  next: Schema.NullOr(nextStepValidator),
  position: positionValidator,
  removed: Schema.Finite,
  skipped: Schema.Finite,
  stale: Schema.Boolean,
  written: Schema.Finite,
});

/**
 * Builds the section index for the active release, one bounded step at a time.
 * It starts after a release becomes active and can be started by hand, with no
 * arguments, for the release that is active now.
 */
export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "run",
    args: () => stepInputValidator.fields,
    returns: () => stepResultValidator,
  })
);
